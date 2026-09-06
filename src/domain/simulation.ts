import { SLOT_IDS } from "./types";
import type { SlotId } from "./types";

export interface OutcomeCard {
  id: string;
  /** Same card across alternate printings within a sheet. */
  duplicateKey?: string;
  /** Front-face mono color for collation; independent of break assignment. */
  color?: string;
  slot: SlotId;
  value: number;
  weight?: number;
  count?: number;
}

export interface OutcomeSheet {
  totalWeight: number;
  cards: OutcomeCard[];
  allowDuplicates?: boolean;
  /** Minimum distinct mono colors drawn from this sheet. */
  minColors?: number;
  /** Every identity occurs with its recorded multiplicity. */
  fixed?: boolean;
}

export interface OutcomeVariant {
  weight: number;
  picks: Record<string, number>;
}

export interface OutcomePack {
  count: number;
  variants: OutcomeVariant[];
  sheets: Record<string, OutcomeSheet>;
}

export interface PackOutcomeModel {
  cacheKey?: string;
  fixed: OutcomeCard[];
  packs: OutcomePack[];
  complete?: boolean;
}

export interface DistributionSummary {
  /** Analytic preview awaiting an opening model; not opening percentiles. */
  preview?: boolean;
  /** Model support endpoints, not the smallest/largest sampled openings. */
  min: number;
  p01: number;
  mean: number;
  p10: number;
  p25: number;
  median: number;
  p75: number;
  p90: number;
  p99: number;
  max: number;
  chanceToClearCost?: number;
  expectedShortfall?: number;
  fingerprint: number[];
}

export interface SimulationOptions {
  seed: string;
  sampleCount: number;
  remaining: SlotId[];
  landedCost?: number;
}

export interface SimulationResult {
  seed: string;
  sampleCount: number;
  slotDistributions: Record<SlotId, DistributionSummary>;
  remainingPool: DistributionSummary;
}

export type SlotBounds = Record<SlotId, { min: number; max: number }>;

const MONO_COLORS = ["W", "U", "B", "R", "G"];
function monoColorIndex(card: OutcomeCard): number { return MONO_COLORS.indexOf(card.color ?? card.slot); }
function colorCount(mask: number): number { let count = 0; for (; mask; mask &= mask - 1) count++; return count; }

function sheetSlotBounds(sheet: OutcomeSheet, picks: number, slot: SlotId): { min: number; max: number } {
  if (!Number.isInteger(picks) || picks < 0) throw new Error("Sheet picks must be a non-negative integer");
  if (picks === 0) return { min: 0, max: 0 };
  if (sheet.fixed) {
    const total = sheet.cards.reduce((sum, card) => sum + (card.weight ?? 1), 0);
    if (!total || picks % total) throw new Error("Fixed sheet must contain whole copies of its card list");
    const value = sheet.cards.reduce((sum, card) => sum + (card.slot === slot ? card.value * (card.weight ?? 1) : 0), 0) * picks / total;
    return { min: value, max: value };
  }
  const groups = Array.from({ length: 6 }, () => new Map<string, { min: number; max: number }>());
  for (const card of sheet.cards.filter((row) => (row.weight ?? 1) > 0)) {
    const color = monoColorIndex(card);
    const group = groups[color < 0 ? 5 : color];
    const key = sheet.allowDuplicates ? card.id : card.duplicateKey ?? card.id;
    const value = card.slot === slot ? card.value : 0;
    const prior = group.get(key);
    group.set(key, { min: Math.min(prior?.min ?? value, value), max: Math.max(prior?.max ?? value, value) });
  }
  let states = new Map<string, { min: number; max: number }>([["0:0", { min: 0, max: 0 }]]);
  groups.forEach((group, index) => {
    const ascending = [...group.values()].map((row) => row.min).sort((a, b) => a - b);
    const descending = [...group.values()].map((row) => row.max).sort((a, b) => b - a);
    const limit = ascending.length ? (sheet.allowDuplicates ? picks : Math.min(picks, ascending.length)) : 0;
    const next = new Map<string, { min: number; max: number }>();
    let min = 0, max = 0;
    for (let count = 0; count <= limit; count++) {
      if (count) { min += ascending[sheet.allowDuplicates ? 0 : count - 1]; max += descending[sheet.allowDuplicates ? 0 : count - 1]; }
      for (const [key, prior] of states) {
        const [used, colors] = key.split(":").map(Number);
        if (used + count > picks) continue;
        const target = `${used + count}:${colors + (index < 5 && count > 0 ? 1 : 0)}`;
        const existing = next.get(target);
        next.set(target, { min: Math.min(existing?.min ?? Infinity, prior.min + min), max: Math.max(existing?.max ?? -Infinity, prior.max + max) });
      }
    }
    states = next;
  });
  const valid = [...states].filter(([key]) => { const [count, colors] = key.split(":").map(Number); return count === picks && colors >= (sheet.minColors ?? 0); }).map(([, value]) => value);
  if (!valid.length) throw new Error("Outcome sheet cannot satisfy its count and color constraints");
  return { min: Math.min(...valid.map((row) => row.min)), max: Math.max(...valid.map((row) => row.max)) };
}

/** Exact marginal low/high values possible for every color slot. */
export function possibleSlotBounds(model: PackOutcomeModel): SlotBounds {
  return Object.fromEntries(SLOT_IDS.map((slot) => {
    const fixed = model.fixed.reduce((sum, card) => sum + (card.slot === slot ? card.value * (card.count ?? 1) : 0), 0);
    let minimum = fixed;
    let maximum = fixed;
    for (const pack of model.packs) {
      if (pack.count === 0) continue;
      if (!pack.variants.length) throw new Error("Outcome model contains no pack variants");
      const variants = pack.variants.filter((variant) => variant.weight > 0).map((variant) => {
        let min = 0;
        let max = 0;
        for (const [sheetName, picks] of Object.entries(variant.picks)) {
          const sheet = pack.sheets[sheetName];
          if (!sheet) throw new Error(`Outcome model is missing sheet ${sheetName}`);
          const bounds = sheetSlotBounds(sheet, picks, slot);
          min += bounds.min;
          max += bounds.max;
        }
        return { min, max };
      });
      if (!variants.length) throw new Error("Outcome model contains no possible pack variants");
      minimum += pack.count * Math.min(...variants.map((variant) => variant.min));
      maximum += pack.count * Math.max(...variants.map((variant) => variant.max));
    }
    return [slot, { min: minimum, max: maximum }];
  })) as SlotBounds;
}

const boundsCache = new WeakMap<PackOutcomeModel, SlotBounds>();

/** Random assignment selects one remaining slot; do not sum marginal maxima. */
export function withPossibleBounds(result: SimulationResult, model: PackOutcomeModel, remaining: SlotId[]): SimulationResult {
  let bounds = boundsCache.get(model);
  if (!bounds) { bounds = possibleSlotBounds(model); boundsCache.set(model, bounds); }
  return {
    ...result,
    slotDistributions: Object.fromEntries(SLOT_IDS.map((id) => [id, { ...result.slotDistributions[id], ...bounds[id] }])) as SimulationResult["slotDistributions"],
    remainingPool: { ...result.remainingPool,
      min: remaining.length ? Math.min(...remaining.map((id) => bounds[id].min)) : 0,
      max: remaining.length ? Math.max(...remaining.map((id) => bounds[id].max)) : 0,
    },
  };
}

function seed32(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function randomSource(seed: string): () => number {
  let state = seed32(seed) || 1;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

interface WeightedTable<T> {
  rows: T[];
  weights: number[];
  cumulativeWeights: number[];
  totalWeight: number;
}

function compileWeightedTable<T>(rows: readonly T[], weightOf: (row: T) => number): WeightedTable<T> {
  const weightedRows = rows
    .map((row) => ({ row, weight: Math.max(0, weightOf(row)) }))
    .filter(({ weight }) => weight > 0);
  if (!weightedRows.length) throw new Error("Outcome model contains an empty weighted choice");

  let totalWeight = 0;
  const cumulativeWeights = weightedRows.map(({ weight }) => {
    totalWeight += weight;
    return totalWeight;
  });
  return {
    rows: weightedRows.map(({ row }) => row),
    weights: weightedRows.map(({ weight }) => weight),
    cumulativeWeights,
    totalWeight,
  };
}

function weightedIndex<T>(table: WeightedTable<T>, random: () => number): number {
  const target = random() * table.totalWeight;
  let low = 0;
  let high = table.cumulativeWeights.length - 1;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if (target < table.cumulativeWeights[middle]) high = middle;
    else low = middle + 1;
  }
  return low;
}

function distinctWeightedIndex<T extends { identity: number }>(
  table: WeightedTable<T>,
  selected: ReadonlySet<number>,
  random: () => number,
): number {
  // Most collation sheets draw only one or a few cards. Rejection sampling
  // keeps those common draws O(log n) and is equivalent to drawing from the
  // remaining weights. Fall back to a direct scan for heavily skewed sheets.
  for (let attempt = 0; attempt < 16; attempt += 1) {
    const index = weightedIndex(table, random);
    if (!selected.has(table.rows[index].identity)) return index;
  }

  let remainingWeight = 0;
  for (let index = 0; index < table.weights.length; index += 1) {
    if (!selected.has(table.rows[index].identity)) remainingWeight += table.weights[index];
  }
  let cursor = random() * remainingWeight;
  for (let index = 0; index < table.weights.length; index += 1) {
    if (selected.has(table.rows[index].identity)) continue;
    cursor -= table.weights[index];
    if (cursor < 0) return index;
  }
  throw new Error("Outcome model contains an empty weighted choice");
}

interface CompiledCard {
  slotIndex: number;
  value: number;
  identity: number;
  colorBit: number;
}

interface CompiledSheet {
  cards: WeightedTable<CompiledCard>;
  allowDuplicates: boolean;
  minColors: number;
  fixedValues?: number[];
  fixedCount?: number;
  newColors: Map<number, WeightedTable<CompiledCard>>;
}

interface CompiledPick {
  sheet: CompiledSheet;
  count: number;
}

interface CompiledVariant {
  weight: number;
  picks: CompiledPick[];
}

interface CompiledPack {
  count: number;
  variants: WeightedTable<CompiledVariant>;
}

const SLOT_INDEX = new Map<SlotId, number>(SLOT_IDS.map((slot, index) => [slot, index]));

function compilePacks(packs: readonly OutcomePack[]): CompiledPack[] {
  return packs.filter((pack) => pack.count > 0).map((pack) => {
    const sheets = new Map(Object.entries(pack.sheets).filter(([name]) => pack.variants.some((variant) => variant.weight > 0 && (variant.picks[name] ?? 0) > 0)).map(([name, sheet]) => {
      const identities = new Map<string, number>();
      const rows = sheet.cards.filter((card) => (card.weight ?? 1) > 0).map((card) => {
        const key = card.duplicateKey ?? card.id;
        if (!identities.has(key)) identities.set(key, identities.size);
        const color = monoColorIndex(card);
        return { slotIndex: SLOT_INDEX.get(card.slot)!, value: card.value, weight: card.weight ?? 1,
          identity: identities.get(key)!, colorBit: color < 0 ? 0 : 1 << color };
      });
      const newColors = new Map<number, WeightedTable<CompiledCard>>();
      if (sheet.minColors) for (let mask = 0; mask < 32; mask++) {
        const eligible = rows.filter((card) => card.colorBit && !(card.colorBit & mask));
        if (eligible.length) newColors.set(mask, compileWeightedTable(eligible, (card) => card.weight));
      }
      const fixedValues = sheet.fixed ? SLOT_IDS.map((_, index) => rows.reduce((sum, card) => sum + (card.slotIndex === index ? card.value * card.weight : 0), 0)) : undefined;
      return [name, { fixedValues, fixedCount: sheet.fixed ? rows.reduce((sum, card) => sum + card.weight, 0) : undefined, cards: compileWeightedTable(rows, (card) => card.weight),
        allowDuplicates: sheet.allowDuplicates === true, minColors: sheet.minColors ?? 0, newColors }] as const;
    }));
    const variants = pack.variants.filter((variant) => variant.weight > 0).map((variant): CompiledVariant => ({
      weight: variant.weight,
      picks: Object.entries(variant.picks).filter(([, count]) => count > 0).map(([sheetName, count]) => {
        const sheet = sheets.get(sheetName);
        if (!sheet) throw new Error(`Outcome model is missing sheet ${sheetName}`);
        if (!Number.isInteger(count) || count < 0) throw new Error("Sheet picks must be a non-negative integer");
        if (!sheet.fixedValues && !sheet.allowDuplicates && count > new Set(sheet.cards.rows.map((card) => card.identity)).size) {
          throw new Error("Outcome model requests more unique cards than a sheet contains");
        }
        if (sheet.fixedValues && count % sheet.fixedCount!) throw new Error("Fixed sheet must contain whole copies of its card list");
        const availableColors = sheet.cards.rows.reduce((mask, card) => mask | card.colorBit, 0);
        if (Math.min(count, colorCount(availableColors)) < sheet.minColors) throw new Error("Outcome sheet cannot satisfy its color constraint");
        return { sheet, count };
      }),
    }));
    return { count: pack.count, variants: compileWeightedTable(variants, (variant) => variant.weight) };
  });
}

function quantile(sorted: readonly number[], probability: number): number {
  if (!sorted.length) return 0;
  const index = (sorted.length - 1) * probability;
  const lower = Math.floor(index);
  const fraction = index - lower;
  return sorted[lower] + ((sorted[lower + 1] ?? sorted[lower]) - sorted[lower]) * fraction;
}

export function summarizeDistribution(values: readonly number[], landedCost?: number): DistributionSummary {
  const sorted = [...values].sort((a, b) => a - b);
  const mean = sorted.length ? sorted.reduce((sum, value) => sum + value, 0) / sorted.length : 0;
  const misses = landedCost == null ? [] : sorted.filter((value) => value < landedCost);
  return {
    min: sorted[0] ?? 0,
    p01: quantile(sorted, .01),
    mean,
    p10: quantile(sorted, .1),
    p25: quantile(sorted, .25),
    median: quantile(sorted, .5),
    p75: quantile(sorted, .75),
    p90: quantile(sorted, .9),
    p99: quantile(sorted, .99),
    max: sorted.at(-1) ?? 0,
    fingerprint: Array.from({ length: 20 }, (_, index) => quantile(sorted, (index + .5) / 20)),
    ...(landedCost == null ? {} : {
      chanceToClearCost: sorted.filter((value) => value >= landedCost).length / Math.max(1, sorted.length),
      expectedShortfall: misses.length
        ? misses.reduce((sum, value) => sum + landedCost - value, 0) / misses.length
        : 0,
    }),
  };
}

export function simulateOutcomes(model: PackOutcomeModel, options: SimulationOptions): SimulationResult {
  if (!Number.isInteger(options.sampleCount) || options.sampleCount <= 0) {
    throw new Error("sampleCount must be a positive integer");
  }
  if (!options.remaining.length) throw new Error("At least one remaining slot is required");

  const random = randomSource(options.seed);
  const values = SLOT_IDS.map(() => [] as number[]);
  const remainingValues: number[] = [];
  const fixedValues = SLOT_IDS.map(() => 0);
  for (const card of model.fixed) fixedValues[SLOT_INDEX.get(card.slot)!] += card.value * (card.count ?? 1);
  const packs = compilePacks(model.packs);
  const remainingIndices = options.remaining.map((slot) => SLOT_INDEX.get(slot)!);

  for (let sample = 0; sample < options.sampleCount; sample += 1) {
    const slots = [...fixedValues];
    for (const pack of packs) {
      for (let unit = 0; unit < pack.count; unit += 1) {
        const variant = pack.variants.rows[weightedIndex(pack.variants, random)];
        for (const { sheet, count } of variant.picks) {
          if (sheet.fixedValues) { sheet.fixedValues.forEach((value, index) => { slots[index] += value * count / sheet.fixedCount!; }); continue; }
          const selected = sheet.allowDuplicates ? undefined : new Set<number>();
          let colors = 0;
          for (let pick = 0; pick < count; pick += 1) {
            // Keep enough spaces for all required colors. Exact print-run order is
            // unpublished; this is the disclosed weighted sequential approximation.
            const needsNewColor = count - pick === sheet.minColors - colorCount(colors);
            const table = needsNewColor ? sheet.newColors.get(colors)! : sheet.cards;
            const cardIndex = selected ? distinctWeightedIndex(table, selected, random) : weightedIndex(table, random);
            const card = table.rows[cardIndex];
            slots[card.slotIndex] += card.value;
            colors |= card.colorBit;
            selected?.add(card.identity);
          }
        }
      }
    }
    for (let index = 0; index < SLOT_IDS.length; index += 1) values[index].push(slots[index]);
    const assigned = remainingIndices[Math.floor(random() * remainingIndices.length)];
    remainingValues.push(slots[assigned]);
  }

  return withPossibleBounds({
    seed: options.seed,
    sampleCount: options.sampleCount,
    slotDistributions: Object.fromEntries(SLOT_IDS.map((slot, index) => [
      slot, summarizeDistribution(values[index], options.landedCost),
    ])) as Record<SlotId, DistributionSummary>,
    remainingPool: summarizeDistribution(remainingValues, options.landedCost),
  }, model, options.remaining);
}
