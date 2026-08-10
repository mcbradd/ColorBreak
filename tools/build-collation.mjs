// Collation format v2 builder (S3a). Node stdlib only — no network, no deps.
//
// Input shape: a NORMALIZED set config, not a raw MTGJSON file:
//   { code, releaseDate, meta: { version, date }, cardsById: { id: { number, setCode, rarity } },
//     booster: { <rawConfigName>: { boosters: [{ contents: {sheet: count}, weight }], sheets: { name: { foil, cards: {id: weight} } } } } }
// Real MTGJSON set files key sheet cards by UUID inside an array-of-cards document and don't
// carry ratePerBox for box toppers at all; turning that raw shape into cardsById/booster above is
// a thin, mechanical adapter left for S3b (when real per-set data lands against this frozen
// format) — writing it now would mean fetching/vendoring live MTGJSON data, which this story's
// AC (Node stdlib, no build step, <40KB fixtures) doesn't call for.
//
// Output: collation format v2, frozen per plan §3.2.

import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const DROPPED_CONFIGS = new Set(["jumpstart", "arena", "box", "sample"]);
const KNOWN_CONFIGS = new Set(["play", "collector", "draft", "set"]);

// Config-name mapping (DES5-05): MTGJSON booster config key -> v2 product key.
export function mapConfigName(rawKey, releaseDate) {
  if (DROPPED_CONFIGS.has(rawKey)) return null;
  if (rawKey === "default") {
    return new Date(releaseDate) < new Date("2024-01-01") ? "draft" : "play";
  }
  if (KNOWN_CONFIGS.has(rawKey)) return rawKey;
  return null; // unrecognized config, dropped defensively
}

// ppb table lookup (§3.2): Feb-2025 DFT cutover, play 36->30; others flat.
export function defaultPpb(product, releaseDate) {
  switch (product) {
    case "set": return 30;
    case "collector": return 12;
    case "draft": return 36;
    case "play": return new Date(releaseDate) < new Date("2025-02-01") ? 36 : 30;
    default: return null;
  }
}

// One layout entry per (sheet, slot label) pair. count = fixed per-pack quantity when every
// booster variant contributes the same amount; rate = probability-weighted average otherwise.
function computeLayout(boosterCfg, productSlotMap) {
  const boosters = boosterCfg.boosters || [];
  const totalWeight = boosters.reduce((sum, b) => sum + b.weight, 0);
  const layout = [];
  for (const sheetName of Object.keys(boosterCfg.sheets || {})) {
    const slotLabels = productSlotMap.slots?.[sheetName];
    if (!slotLabels) continue; // not a per-pack slot sheet (e.g. a topper-only sheet)
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
  return layout;
}

function buildSheets(boosterCfg, sheetNames, cardsById, setCode) {
  const sheets = {};
  for (const sheetName of sheetNames) {
    const raw = boosterCfg.sheets[sheetName];
    if (!raw) continue;
    sheets[sheetName] = {
      foil: !!raw.foil,
      // [setCode?, cn, weight]: 3-element when foreign (setCode !== file's own set), else 2-element.
      cards: Object.entries(raw.cards).map(([cardId, weight]) => {
        const card = cardsById[cardId];
        return card.setCode === setCode ? [card.number, weight] : [card.setCode, card.number, weight];
      }),
    };
  }
  return sheets;
}

export function buildCollation(normalized, slotMap, ppbTable) {
  const setCode = normalized.code;
  const releaseDate = normalized.releaseDate;
  const rawEntries = Object.entries(normalized.booster || {});

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
      sheets: buildSheets(boosterCfg, usedSheets, normalized.cardsById, setCode),
      boxTopper: topperCfg?.sheet ? { sheet: topperCfg.sheet, ratePerBox: topperCfg.ratePerBox } : null,
    };
    ppb[v2Key] = ppbTable?.overrides?.[setCode]?.[v2Key] ?? defaultPpb(v2Key, releaseDate);
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
  const [, , setPath, slotMapPath = new URL("./slot-map.json", import.meta.url).pathname, ppbPath = new URL("./ppb.json", import.meta.url).pathname] = process.argv;
  if (!setPath) {
    console.error("usage: node build-collation.mjs <normalized-set.json> [slot-map.json] [ppb.json]");
    process.exit(1);
  }
  const normalized = JSON.parse(readFileSync(setPath, "utf8"));
  const slotMap = JSON.parse(readFileSync(slotMapPath, "utf8"));
  const ppbTable = JSON.parse(readFileSync(ppbPath, "utf8"));
  process.stdout.write(JSON.stringify(buildCollation(normalized, slotMap, ppbTable)));
}
