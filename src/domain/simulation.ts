import { SLOT_IDS } from "./types";
import type { SlotId } from "./types";

export interface OutcomeCard {
  id: string;
  slot: SlotId;
  value: number;
  weight?: number;
  count?: number;
}

export interface OutcomeSheet {
  totalWeight: number;
  cards: OutcomeCard[];
  allowDuplicates?: boolean;
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

function sheetSlotBounds(sheet: OutcomeSheet, picks: number, slot: SlotId): { min: number; max: number } {
  if (!Number.isInteger(picks) || picks < 0) throw new Error("Sheet picks must be a non-negative integer");
  const contributions = sheet.cards
    .filter((card) => (card.weight ?? 1) > 0)
    .map((card) => card.slot === slot ? card.value : 0);
  if (!contributions.length && picks > 0) throw new Error("Outcome model contains an empty weighted choice");
  // MTGJSON's flag is optional. Repeating the same printing is only safe when
  // the source explicitly says the sheet allows it; otherwise draw distinct
  // printing identities within this sheet for the current pack.
  if (sheet.allowDuplicates !== true) {
    if (picks > contributions.length) throw new Error("Outcome model requests more unique cards than a sheet contains");
    const ordered = [...contributions].sort((a, b) => a - b);
    return {
      min: ordered.slice(0, picks).reduce((sum, value) => sum + value, 0),
      max: ordered.slice(-picks).reduce((sum, value) => sum + value, 0),
    };
  }
  return {
    min: picks * Math.min(...contributions),
    max: picks * Math.max(...contributions),
  };
}

/** Exact marginal low/high values possible for every color slot. */
export function possibleSlotBounds(model: PackOutcomeModel): SlotBounds {
  return Object.fromEntries(SLOT_IDS.map((slot) => {
    const fixed = model.fixed.reduce((sum, card) => sum + (card.slot === slot ? card.value * (card.count ?? 1) : 0), 0);
    let minimum = fixed;
    let maximum = fixed;
    for (const pack of model.packs) {
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

function distinctWeightedIndex<T>(
  table: WeightedTable<T>,
  selected: ReadonlySet<number>,
  random: () => number,
): number {
  // Most collation sheets draw only one or a few cards. Rejection sampling
  // keeps those common draws O(log n) and is equivalent to drawing from the
  // remaining weights. Fall back to a direct scan for heavily skewed sheets.
  for (let attempt = 0; attempt < 16; attempt += 1) {
    const index = weightedIndex(table, random);
    if (!selected.has(index)) return index;
  }

  let remainingWeight = 0;
  for (let index = 0; index < table.weights.length; index += 1) {
    if (!selected.has(index)) remainingWeight += table.weights[index];
  }
  let cursor = random() * remainingWeight;
  for (let index = 0; index < table.weights.length; index += 1) {
    if (selected.has(index)) continue;
    cursor -= table.weights[index];
    if (cursor < 0) return index;
  }
  throw new Error("Outcome model contains an empty weighted choice");
}

interface CompiledCard {
  slotIndex: number;
  value: number;
}

interface CompiledSheet {
  cards: WeightedTable<CompiledCard>;
  allowDuplicates: boolean;
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
  return packs.map((pack) => {
    const sheets = new Map(Object.entries(pack.sheets).map(([name, sheet]) => [name, {
      cards: compileWeightedTable(sheet.cards.map((card) => ({
        slotIndex: SLOT_INDEX.get(card.slot)!,
        value: card.value,
        weight: card.weight ?? 1,
      })), (card) => card.weight),
      allowDuplicates: sheet.allowDuplicates === true,
    }] as const));
    const variants = pack.variants.map((variant): CompiledVariant => ({
      weight: variant.weight,
      picks: Object.entries(variant.picks).map(([sheetName, count]) => {
        const sheet = sheets.get(sheetName);
        if (!sheet) throw new Error(`Outcome model is missing sheet ${sheetName}`);
        if (!Number.isInteger(count) || count < 0) throw new Error("Sheet picks must be a non-negative integer");
        if (!sheet.allowDuplicates && count > sheet.cards.rows.length) {
          throw new Error("Outcome model requests more unique cards than a sheet contains");
        }
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
          const selected = sheet.allowDuplicates ? undefined : new Set<number>();
          for (let pick = 0; pick < count; pick += 1) {
            const cardIndex = selected
              ? distinctWeightedIndex(sheet.cards, selected, random)
              : weightedIndex(sheet.cards, random);
            const card = sheet.cards.rows[cardIndex];
            slots[card.slotIndex] += card.value;
            selected?.add(cardIndex);
          }
        }
      }
    }
    for (let index = 0; index < SLOT_IDS.length; index += 1) values[index].push(slots[index]);
    const assigned = remainingIndices[Math.floor(random() * remainingIndices.length)];
    remainingValues.push(slots[assigned]);
  }

  return {
    seed: options.seed,
    sampleCount: options.sampleCount,
    slotDistributions: Object.fromEntries(SLOT_IDS.map((slot, index) => [
      slot, summarizeDistribution(values[index], options.landedCost),
    ])) as Record<SlotId, DistributionSummary>,
    remainingPool: summarizeDistribution(remainingValues, options.landedCost),
  };
}
