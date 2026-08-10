// Published-rates sidecar validator (S3c). Node stdlib only — no network, no deps.
//
// Cross-checks data/published-rates/{set}.json (hand-transcribed real-world odds) against a
// collation built from the same normalized MTGJSON input, per tools/README.md's frozen
// resolution/tolerance/coverage rules. Needs the normalized source alongside the built
// collation (not just data/collation/{set}.json) because rarityMix requires per-card rarity,
// which the v2 output format doesn't carry.

import { readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { buildCollation, resolveCardsById } from "./build-collation.mjs";

// selector.slot means "union of every layout entry carrying that label"; selector.sheet
// narrows within that union (tools/README.md).
function layoutEntriesFor(product, selector) {
  return product.layout.filter((l) => {
    if (selector.slot && l.slot !== selector.slot) return false;
    if (selector.sheet && l.sheet !== selector.sheet) return false;
    return true;
  });
}

function perPackTotal(entries) {
  return entries.reduce((sum, l) => sum + (l.count ?? l.rate ?? 0), 0);
}

export function computeSlotRate(product, selector) {
  return perPackTotal(layoutEntriesFor(product, selector)) * 100;
}

// selector.sheet === 'topper' is a reserved keyword meaning "this product's designated box
// topper" (there's always exactly one) — resolved via boxTopper, never a literal sheet-key
// match (computeLayout never emits a layout entry for the topper sheet).
export function computePerBox(product, selector, ppbForProduct) {
  if (selector.sheet === "topper") {
    return product.boxTopper ? product.boxTopper.ratePerBox : null;
  }
  return perPackTotal(layoutEntriesFor(product, selector)) * ppbForProduct;
}

function cardMeta(triple, homeSetCode, rarityIndex) {
  const [setCode, cn, weight] = triple.length === 3 ? triple : [homeSetCode, triple[0], triple[1]];
  return { setCode, weight, rarity: rarityIndex.get(`${setCode}/${cn}`) };
}

// DES5-07: P(rarity|slot) = Σ rate_s·w_s(rarity) / Σ rate_s, over every layout entry carrying
// the slot label. DES4-02: a sheet that carries no card of the target set (home set by
// default, or selector.setCode when given) is excluded entirely — never folded in at a zero
// weight, which would still dilute the denominator.
export function computeRarityMix(product, selector, homeSetCode, rarityIndex) {
  const targetSet = selector.setCode ?? homeSetCode;
  let num = 0;
  let den = 0;
  for (const l of layoutEntriesFor(product, { slot: selector.slot, sheet: selector.sheet })) {
    const rate = l.count ?? l.rate ?? 0;
    const cards = (product.sheets[l.sheet]?.cards ?? [])
      .map((t) => cardMeta(t, homeSetCode, rarityIndex))
      .filter((c) => c.setCode === targetSet);
    const total = cards.reduce((s, c) => s + c.weight, 0);
    if (!total) continue;
    const match = cards.filter((c) => c.rarity === selector.rarity).reduce((s, c) => s + c.weight, 0);
    num += rate * (match / total);
    den += rate;
  }
  return den ? (num / den) * 100 : null;
}

// DES5-02: default ±0.5pt (slotRate/rarityMix) / ±0.05 copies (perBox). Magnitude clause
// (README: stated for slotRate and perBox only, NOT rarityMix) tightens tolerance below a
// threshold; {max} entries are exempt from it and stay flat-absolute.
export function toleranceFor(stat, value, isMax = false) {
  if (stat === "perBox") return isMax || value >= 0.5 ? 0.05 : Math.min(0.05, value * 0.2);
  if (stat === "slotRate") return isMax || value >= 5 ? 0.5 : Math.min(0.5, value * 0.2);
  return 0.5; // rarityMix
}

export function checkEntry(collation, rarityIndex, entry) {
  const product = collation.products[entry.product];
  if (!product) return { entry, pass: false, reason: `no product '${entry.product}'` };
  const isMax = entry.max != null;
  const target = isMax ? entry.max : entry.value;
  let actual;
  if (entry.stat === "slotRate") actual = computeSlotRate(product, entry.selector);
  else if (entry.stat === "perBox") actual = computePerBox(product, entry.selector, collation.ppb[entry.product]);
  else if (entry.stat === "rarityMix") actual = computeRarityMix(product, entry.selector, collation.set, rarityIndex);
  else return { entry, pass: false, reason: `unknown stat '${entry.stat}'` };
  if (actual == null) return { entry, actual, pass: false, reason: "no matching layout/sheet data" };
  const tolerance = toleranceFor(entry.stat, target, isMax);
  const pass = isMax ? actual <= target + tolerance : Math.abs(actual - target) <= tolerance;
  return { entry, actual, expected: target, tolerance, pass };
}

// Coverage law (DES4-03/DES5-01): a (set, product) tiers COMPUTED only if it has a ppb entry
// AND every distinct slot label in its layout is addressed by >= 1 slotRate/rarityMix entry
// carrying selector.slot (a perBox/no-slot entry satisfies nothing — pinned by
// build-collation.test.mjs) AND every layout sheet carrying a foreign/bonus setCode is
// addressed by >= 1 entry naming that sheet — otherwise RED unless listed in exemptions.
// Uncovered-and-unlisted is a build failure, never a silent skip.
export function tierOf(setCode, productKey, product, sidecar, manifest) {
  if (sidecar?.ppb?.[productKey] == null) return { tier: "RED", reason: `no ppb entry for '${productKey}'` };

  const exempt = new Set(
    (manifest?.exemptions ?? []).filter((x) => x.set === setCode && x.product === productKey).map((x) => x.slot)
  );

  const slotLabels = new Set(product.layout.map((l) => l.slot));
  const coveredSlots = new Set(
    (sidecar.entries ?? [])
      .filter((e) => e.product === productKey && e.selector?.slot && (e.stat === "slotRate" || e.stat === "rarityMix"))
      .map((e) => e.selector.slot)
  );
  const uncoveredSlots = [...slotLabels].filter((s) => !coveredSlots.has(s) && !exempt.has(s));

  const foreignSheets = product.layout
    .map((l) => l.sheet)
    .filter((sheet) => (product.sheets[sheet]?.cards ?? []).some((c) => c.length === 3));
  const addressedSheets = new Set((sidecar.entries ?? []).filter((e) => e.product === productKey && e.selector?.sheet).map((e) => e.selector.sheet));
  const uncoveredForeign = foreignSheets.filter((s) => !addressedSheets.has(s) && !exempt.has(s));

  const uncovered = [...uncoveredSlots, ...uncoveredForeign];
  if (uncovered.length) return { tier: "RED", reason: `uncovered: ${uncovered.join(", ")}` };
  return { tier: "COMPUTED" };
}

export function validateRates(normalized, slotMap, ppbTable, sidecar, manifest = { exemptions: [], consistency: [] }) {
  const collation = buildCollation(normalized, slotMap, ppbTable);
  const d = normalized.data ?? normalized;
  const cardsById = resolveCardsById(d);
  const rarityIndex = new Map(Object.values(cardsById).map((c) => [`${c.setCode}/${c.number}`, c.rarity]));

  const entries = (sidecar.entries ?? []).map((e) => checkEntry(collation, rarityIndex, e));
  const tiers = Object.fromEntries(
    Object.keys(collation.products).map((productKey) => [
      productKey,
      tierOf(collation.set, productKey, collation.products[productKey], sidecar, manifest),
    ])
  );
  return { set: collation.set, entries, tiers };
}

// CLI: node tools/validate-rates.mjs <normalized-set.json> <slot-map.json> <ppb.json> <published-rates.json> [manifest.json]
if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  const [, , setPath, slotMapPath, ppbPath, sidecarPath, manifestPath] = process.argv;
  if (!setPath || !slotMapPath || !ppbPath || !sidecarPath) {
    console.error("usage: node validate-rates.mjs <normalized-set.json> <slot-map.json> <ppb.json> <published-rates.json> [manifest.json]");
    process.exit(1);
  }
  const readJSON = (p) => JSON.parse(readFileSync(p, "utf8"));
  const normalized = readJSON(setPath);
  const slotMap = readJSON(slotMapPath);
  const ppbTable = readJSON(ppbPath);
  const sidecar = readJSON(sidecarPath);
  const manifest = manifestPath ? readJSON(manifestPath) : undefined;

  const report = validateRates(normalized, slotMap, ppbTable, sidecar, manifest);
  console.log(JSON.stringify(report, null, 2));

  const failed = report.entries.some((r) => !r.pass) || Object.values(report.tiers).some((t) => t.tier === "RED");
  if (failed) process.exit(1);
}
