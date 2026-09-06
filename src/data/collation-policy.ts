import registry from "../../data/collation-rules.json";
import type { Booster } from "./sealed";

export type CollationTier = "official" | "community" | "inferred";
type Fact = { kind: "sheet-count"; sheet: string; count: number }
  | { kind: "structure"; cardCount: number; minFoils?: number }
  | { kind: "color-balance"; sheet: string; minColors: number }
  | { kind: "variant-rate"; sheet: string; probability: number }
  | { kind: "sheet-rate"; sheet: string; cardSet: string; probability: number };
export interface CollationRule {
  id: string; set: string; booster: string; product?: string; tier: CollationTier;
  source: string; reviewedAt: string; fact: Fact; note: string;
}
export interface CollationMatch {
  product: string; booster: string; recipe: Booster;
  evidence: Array<{ fact: string; tier: CollationTier; source: string; rule?: string }>;
  notes: string[];
  conflicts: string[];
}
export const COLLATION_VERSION = registry.version;
export const COLLATION_RULES = registry.rules as CollationRule[];
const PRIORITY = { official: 0, community: 1, inferred: 2 };
const UPSTREAM = "https://mtgjson.com/data-models/booster/";
const BALANCE_SOURCE = "https://github.com/taw/magic-sealed-data#recommended-algorithms";

/** Match facts independently: an official insert rate cannot certify unrelated sheet odds. */
export function resolveCollation(set: string, booster: string, raw: Booster, product: string, rules = COLLATION_RULES): CollationMatch {
  const recipe: Booster = structuredClone(raw);
  const result: CollationMatch = { product, booster: `${set}/${booster}`, recipe, evidence: [
    { fact: "weighted pack variants and printing pools", tier: "community", source: UPSTREAM },
  ], notes: [], conflicts: [] };
  const chosen = new Map<string, CollationRule>();
  const matches = rules.filter((rule) => rule.set === set && rule.booster === booster && (!rule.product || rule.product === product))
    .sort((a, b) => PRIORITY[a.tier] - PRIORITY[b.tier] || Number(Boolean(b.product)) - Number(Boolean(a.product)) || b.reviewedAt.localeCompare(a.reviewedAt) || a.id.localeCompare(b.id));
  for (const rule of matches) {
    const key = `${rule.fact.kind}:${"sheet" in rule.fact ? rule.fact.sheet : "pack"}`;
    if (!chosen.has(key)) chosen.set(key, rule);
  }
  for (const rule of chosen.values()) {
    const fact = rule.fact;
    try {
      if ("probability" in fact && (!Number.isFinite(fact.probability) || fact.probability < 0 || fact.probability > 1)) throw new Error("probability must be between zero and one");
      if (fact.kind === "color-balance" && (!Number.isInteger(fact.minColors) || fact.minColors < 0 || fact.minColors > 5)) throw new Error("color count must be an integer from zero to five");
      if (fact.kind === "sheet-count") {
        const valid = recipe.variants.filter((variant) => variant.picks[fact.sheet] === fact.count);
        if (!valid.length) throw new Error(`stored branches cannot honor the ${fact.sheet} guarantee`);
        recipe.variants = valid;
      } else if (fact.kind === "structure") {
        const valid = recipe.variants.filter((variant) => Object.values(variant.picks).reduce((a, b) => a + b, 0) === fact.cardCount
          && Object.entries(variant.picks).reduce((sum, [name, n]) => sum + (recipe.sheets[name]?.foil && (!recipe.sheets[name].finish || recipe.sheets[name].finish === "foil") ? n : 0), 0) >= (fact.minFoils ?? 0));
        if (!valid.length) throw new Error("stored pack branches do not match the published card count or foil guarantee");
        recipe.variants = valid;
      } else if (fact.kind === "color-balance") {
        if (!recipe.sheets[fact.sheet]) throw new Error(`the ${fact.sheet} pool is missing`);
        recipe.sheets[fact.sheet].minColors = fact.minColors;
      } else if (fact.kind === "sheet-rate") {
        const sheet = recipe.sheets[fact.sheet];
        if (!sheet) throw new Error(`the ${fact.sheet} pool is missing`);
        const belongs = (tuple: (typeof sheet.cards)[number]) => (tuple.length === 3 ? tuple[0] : set).toUpperCase() === fact.cardSet;
        const totals = [0, 0];
        for (const tuple of sheet.cards) totals[Number(belongs(tuple))] += Number(tuple.at(-1));
        if (!totals[0] || !totals[1]) throw new Error("the published insert pool or its alternative is missing");
        sheet.cards = sheet.cards.map((tuple) => { const copy = [...tuple] as typeof tuple; const yes = Number(belongs(tuple)); copy[copy.length - 1] = Number(tuple.at(-1)) / totals[yes] * (yes ? fact.probability : 1 - fact.probability); return copy; });
        sheet.total = 1;
      }
      // Rate constraints are fitted together below, preserving known joint branches.
      result.evidence.push({ fact: rule.note, tier: rule.tier, source: rule.source, rule: rule.id });
    } catch (error) { result.conflicts.push(`${rule.id}: ${error instanceof Error ? error.message : "source mismatch"}. The available product recipe is retained as an estimate.`); }
  }
  const rates = [...chosen.values()].filter((rule): rule is CollationRule & { fact: Extract<Fact, { kind: "variant-rate" }> } => rule.fact.kind === "variant-rate" && result.evidence.some((row) => row.rule === rule.id));
  const beforeRates = structuredClone(recipe.variants);
  try {
    for (let iteration = 0; iteration < 100 && rates.length; iteration++) for (const { fact } of rates) {
      const totals = [0, 0];
      for (const variant of recipe.variants) totals[Number((variant.picks[fact.sheet] ?? 0) > 0)] += variant.weight;
      if (!totals[1] || (!totals[0] && fact.probability < 1)) throw new Error(`published ${fact.sheet} replacement cannot be represented by the stored pack branches`);
      for (const variant of recipe.variants) { const yes = Number((variant.picks[fact.sheet] ?? 0) > 0); variant.weight *= (yes ? fact.probability : 1 - fact.probability) / totals[yes]; }
    }
    for (const { fact } of rates) {
      const total = recipe.variants.reduce((n, variant) => n + variant.weight, 0);
      const actual = recipe.variants.reduce((n, variant) => n + ((variant.picks[fact.sheet] ?? 0) > 0 ? variant.weight : 0), 0) / total;
      if (Math.abs(actual - fact.probability) > 1e-7) throw new Error("published rates conflict with available joint pack branches");
    }
  } catch (error) {
    recipe.variants = beforeRates;
    result.evidence = result.evidence.filter((row) => !rates.some((rule) => rule.id === row.rule));
    result.conflicts.push(`${String(error)}. Community branch rates remain the provisional answer.`);
  }
  for (const [name, sheet] of Object.entries(recipe.sheets)) {
    if (sheet.minColors == null && sheet.balanceColors) {
      sheet.minColors = 5;
      result.evidence.push({ fact: `${name}: five-color balance`, tier: "community", source: BALANCE_SOURCE });
    } else if (sheet.minColors == null && booster === "play" && /^common/.test(name)) {
      // Set-specific sheets still decide contents. The broad Play design supplies
      // only a disclosed fallback for unpublished color ordering, never Set packs.
      sheet.minColors = 4;
      result.evidence.push({ fact: `${name}: inferred four-color balance`, tier: "inferred", source: "https://magic.wizards.com/en/news/announcements/play-booster-discord-q-and-a" });
    }
  }
  if (Object.values(recipe.sheets).some((sheet) => sheet.fixed)) result.evidence.push({ fact: "fixed theme contents and card multiplicities", tier: "community", source: "https://mtgjson.com/data-models/booster/booster-sheet/" });
  if (Object.values(recipe.sheets).some((sheet) => sheet.minColors)) result.notes.push("Color guarantees are enforced. The order of cards on factory sheets is not published here; which cards appear together is estimated.");
  if (result.evidence.some((row) => row.tier === "inferred")) result.notes.push("This product's unpublished color pattern uses an estimate from its booster family.");
  result.notes.push("Published facts take priority; other card odds use community data. Packs are treated independently because box print runs are not known.");
  const total = recipe.variants.reduce((n, variant) => n + variant.weight, 0);
  if (total > 0) {
    recipe.picks = {};
    for (const variant of recipe.variants) for (const [name, count] of Object.entries(variant.picks)) recipe.picks[name] = (recipe.picks[name] ?? 0) + variant.weight / total * count;
  }
  return result;
}
