// Collation format v2 builder (S3a). Node stdlib only — no network, no deps.
//
// Input shape: a NORMALIZED set config — either a raw MTGJSON per-set export, which nests
// code/releaseDate/booster/cards[] (keyed by `uuid`) all under a `data` object (with `meta`
// alongside `data`, not inside it), or the pre-flattened test-fixture form with those same
// fields at the top level and `cardsById: {id: {...}}` instead of `cards[]`. Both are accepted
// — see buildCollation below, which resolves `data ?? normalized` once and reads everything
// through that.
//   { code, releaseDate, meta: { version, date }, cardsById?: { id: { number, setCode, rarity } },
//     data?: { code, releaseDate, cards: [{ uuid, number, setCode, rarity }, …],
//              booster: { <rawConfigName>: { boosters: [...], sheets: {...} } } },
//     booster?: { <rawConfigName>: { boosters: [{ contents: {sheet: count}, weight }], sheets: { name: { foil, cards: {id: weight} } } } } }
//
// Cross-set foreign cards (bonus sheets — SPG, PLST, …): the builder resolves ONLY uuids
// present in this document's own cardsById/cards[]. It does not fetch or merge foreign sets
// itself. A real per-set MTGJSON export's own file may not embed foreign bonus-sheet cards —
// pre-merge the foreign set's cardsById into the input (or build from an AllPrintings-derived
// document) before calling buildCollation. An unresolved uuid fails loudly by name (see
// buildSheets) rather than being guessed or silently dropped.
//
// Output: collation format v2, frozen per plan §3.2.

import { readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

const DROPPED_CONFIGS = new Set(["jumpstart", "arena", "box", "sample"]);
const KNOWN_CONFIGS = new Set(["play", "collector", "draft", "set"]);

// Hand-maintained packs-per-box table (tools/ppb.json), loaded once at module scope so
// defaultPpb has a real default without every caller having to thread the table through.
const PPB = JSON.parse(readFileSync(new URL("./ppb.json", import.meta.url), "utf8"));

// Config-name mapping (DES5-05): MTGJSON booster config key -> v2 product key.
export function mapConfigName(rawKey, releaseDate) {
  if (DROPPED_CONFIGS.has(rawKey)) return null;
  if (rawKey === "default") {
    return new Date(releaseDate) < new Date("2024-01-01") ? "draft" : "play";
  }
  if (KNOWN_CONFIGS.has(rawKey)) return rawKey;
  return null; // unrecognized config, dropped defensively
}

// ppb table lookup (§3.2): Feb-2025 DFT cutover, play 36->30; others flat. Reads tools/ppb.json
// (or whatever table is passed in) so the JSON's `defaults`/`cutoverDate` are load-bearing.
export function defaultPpb(product, releaseDate, table = PPB) {
  const d = (table.defaults ?? PPB.defaults)?.[product];
  if (d == null) return null;
  if (typeof d === "number") return d;
  return new Date(releaseDate) < new Date(table.cutoverDate) ? d.before : d.atOrAfter;
}

// One layout entry per (sheet, slot label) pair. count = fixed per-pack quantity when every
// booster variant contributes the same amount; rate = probability-weighted average otherwise.
function computeLayout(boosterCfg, productSlotMap) {
  const boosters = boosterCfg.boosters || [];
  const totalWeight = boosters.reduce((sum, b) => sum + b.weight, 0);
  const topperSheet = productSlotMap.topper?.sheet ?? null;
  const layout = [];
  const unmapped = [];
  for (const sheetName of Object.keys(boosterCfg.sheets || {})) {
    const slotLabels = productSlotMap.slots?.[sheetName];
    if (!slotLabels) {
      // Only a real failure if the sheet actually contributes cards to a pack; a topper-only
      // sheet legitimately carries no slot label.
      const contributes = boosters.some((b) => (b.contents[sheetName] || 0) > 0);
      if (contributes && sheetName !== topperSheet) unmapped.push(sheetName);
      continue;
    }
    let weightedSum = 0;
    let allSame = true;
    let firstVal = null;
    for (const b of boosters) {
      const c = b.contents[sheetName] || 0;
      weightedSum += c * b.weight;
      if (firstVal === null) firstVal = c;
      else if (c !== firstVal) allSame = false;
    }
    const avg = totalWeight ? weightedSum / totalWeight : 0;
    for (const slot of Array.isArray(slotLabels) ? slotLabels : [slotLabels]) {
      layout.push(allSame ? { sheet: sheetName, slot, count: firstVal } : { sheet: sheetName, slot, rate: avg });
    }
  }
  if (unmapped.length) {
    throw new Error(
      `build-collation: sheet(s) contribute cards but have no slot-map entry (uncovered-and-unlisted is a failure, never a silent skip): ${unmapped.join(", ")}`
    );
  }
  return layout;
}

function buildSheets(boosterCfg, sheetNames, cardsById, setCode) {
  const sheets = {};
  const missing = [];
  for (const sheetName of sheetNames) {
    const raw = boosterCfg.sheets[sheetName];
    if (!raw) continue;
    sheets[sheetName] = {
      foil: !!raw.foil,
      // [setCode?, cn, weight]: 3-element when foreign (setCode !== file's own set), else 2-element.
      cards: Object.entries(raw.cards).map(([cardId, weight]) => {
        const card = cardsById[cardId];
        if (!card) {
          missing.push(`${sheetName}/${cardId}`);
          return null;
        }
        return card.setCode === setCode ? [card.number, weight] : [card.setCode, card.number, weight];
      }),
    };
  }
  if (missing.length) {
    // Real per-set MTGJSON exports don't embed foreign bonus-sheet cards (e.g. SPG) in their
    // own cardsById/cards[] — those live in the foreign set's own file. ponytail: this builder
    // only resolves uuids present in the input document; it does not fetch or merge foreign
    // sets itself. Upgrade path: pre-merge the foreign set's cardsById into the input (or build
    // from an AllPrintings-derived document) before calling buildCollation. Fail loudly by name
    // rather than guessing or silently dropping cards, matching the unmapped-sheet rule above.
    throw new Error(
      `build-collation: sheet(s) reference card uuid(s) absent from this document's cards (cross-set bonus cards are never silently dropped): ${missing.join(", ")}`
    );
  }
  return sheets;
}

// Accepts either the pre-flattened `cardsById` map or a raw MTGJSON per-set export's
// `cards[]` array (`{ uuid, … }` entries), whichever the resolved data section carries.
export function resolveCardsById(d) {
  if (d.cardsById) return d.cardsById;
  const cards = d.cards ?? [];
  return Object.fromEntries(cards.map((c) => [c.uuid, c]));
}

export function buildCollation(normalized, slotMap, ppbTable) {
  // Real MTGJSON per-set exports nest code/releaseDate/booster/cards under `data`
  // (top-level `meta` sits alongside `data`, not inside it); the pre-flattened test-fixture
  // form has no `data` wrapper and carries those fields at the top level directly. Both are
  // the same document shape family — resolve once here so every reader below agrees.
  const d = normalized.data ?? normalized;
  const setCode = d.code;
  const releaseDate = d.releaseDate;
  const cardsById = resolveCardsById(d);
  const rawEntries = Object.entries(d.booster || {});

  // Resolve explicit config names first; 'default' only fills a still-empty slot (era rule
  // never clobbers an explicitly-named product that already resolved to the same v2 key).
  const resolved = new Map();
  for (const [rawKey, cfg] of rawEntries) {
    if (rawKey === "default") continue;
    const v2Key = mapConfigName(rawKey, releaseDate);
    if (v2Key) resolved.set(v2Key, cfg);
  }
  for (const [rawKey, cfg] of rawEntries) {
    if (rawKey !== "default") continue;
    const v2Key = mapConfigName(rawKey, releaseDate);
    if (v2Key && !resolved.has(v2Key)) resolved.set(v2Key, cfg);
  }

  const products = {};
  const ppb = {};
  for (const [v2Key, boosterCfg] of resolved) {
    const productSlotMap = slotMap?.[setCode]?.[v2Key] || {};
    const layout = computeLayout(boosterCfg, productSlotMap);
    const topperCfg = productSlotMap.topper || null;

    const usedSheets = new Set(layout.map((l) => l.sheet));
    if (topperCfg?.sheet) usedSheets.add(topperCfg.sheet);

    products[v2Key] = {
      layout,
      sheets: buildSheets(boosterCfg, usedSheets, cardsById, setCode),
      boxTopper: topperCfg?.sheet ? { sheet: topperCfg.sheet, ratePerBox: topperCfg.ratePerBox } : null,
    };
    ppb[v2Key] = ppbTable?.overrides?.[setCode]?.[v2Key] ?? defaultPpb(v2Key, releaseDate, ppbTable ?? PPB);
  }

  return {
    v: 2,
    set: setCode,
    src: {
      mtgjsonVersion: normalized.meta?.version ?? null,
      mtgjsonDate: normalized.meta?.date ?? null,
      builtAt: new Date().toISOString(),
    },
    ppb,
    products,
  };
}

// CLI: node tools/build-collation.mjs <normalized-set.json> [slot-map.json] [ppb.json]
if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  const [, , setPath, slotMapPath = fileURLToPath(new URL("./slot-map.json", import.meta.url)), ppbPath = fileURLToPath(new URL("./ppb.json", import.meta.url))] = process.argv;
  if (!setPath) {
    console.error("usage: node build-collation.mjs <normalized-set.json> [slot-map.json] [ppb.json]");
    process.exit(1);
  }
  const normalized = JSON.parse(readFileSync(setPath, "utf8"));
  const slotMap = JSON.parse(readFileSync(slotMapPath, "utf8"));
  const ppbTable = JSON.parse(readFileSync(ppbPath, "utf8"));
  process.stdout.write(JSON.stringify(buildCollation(normalized, slotMap, ppbTable)));
}
