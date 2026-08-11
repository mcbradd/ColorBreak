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
  fixed: OutcomeCard[];
  packs: OutcomePack[];
  complete?: boolean;
}

export interface DistributionSummary {
  mean: number;
  p10: number;
  p25: number;
  median: number;
  p75: number;
  p90: number;
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

function weighted<T>(rows: readonly T[], weightOf: (row: T) => number, random: () => number): T {
  const total = rows.reduce((sum, row) => sum + Math.max(0, weightOf(row)), 0);
  if (!rows.length || total <= 0) throw new Error("Outcome model contains an empty weighted choice");
  let cursor = random() * total;
  for (const row of rows) {
    cursor -= Math.max(0, weightOf(row));
    if (cursor < 0) return row;
  }
  return rows.at(-1)!;
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
    mean,
    p10: quantile(sorted, .1),
    p25: quantile(sorted, .25),
    median: quantile(sorted, .5),
    p75: quantile(sorted, .75),
    p90: quantile(sorted, .9),
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
  if (model.complete === false) throw new Error("Cannot simulate a model with material omissions");
  if (!Number.isInteger(options.sampleCount) || options.sampleCount <= 0) {
    throw new Error("sampleCount must be a positive integer");
  }
  if (!options.remaining.length) throw new Error("At least one remaining slot is required");

  const random = randomSource(options.seed);
  const values = Object.fromEntries(SLOT_IDS.map((slot) => [slot, [] as number[]])) as Record<SlotId, number[]>;
  const remainingValues: number[] = [];

  for (let sample = 0; sample < options.sampleCount; sample += 1) {
    const slots = Object.fromEntries(SLOT_IDS.map((slot) => [slot, 0])) as Record<SlotId, number>;
    for (const card of model.fixed) slots[card.slot] += card.value * (card.count ?? 1);
    for (const pack of model.packs) {
      for (let unit = 0; unit < pack.count; unit += 1) {
        const variant = weighted(pack.variants, (row) => row.weight, random);
        for (const [sheetName, picks] of Object.entries(variant.picks)) {
          const sheet = pack.sheets[sheetName];
          if (!sheet) throw new Error(`Outcome model is missing sheet ${sheetName}`);
          const available = [...sheet.cards];
          for (let pick = 0; pick < picks; pick += 1) {
            const card = weighted(available, (row) => row.weight ?? 1, random);
            slots[card.slot] += card.value;
            if (sheet.allowDuplicates === false) available.splice(available.indexOf(card), 1);
          }
        }
      }
    }
    for (const slot of SLOT_IDS) values[slot].push(slots[slot]);
    const assigned = options.remaining[Math.floor(random() * options.remaining.length)];
    remainingValues.push(slots[assigned]);
  }

  return {
    seed: options.seed,
    sampleCount: options.sampleCount,
    slotDistributions: Object.fromEntries(SLOT_IDS.map((slot) => [
      slot, summarizeDistribution(values[slot], options.landedCost),
    ])) as Record<SlotId, DistributionSummary>,
    remainingPool: summarizeDistribution(remainingValues, options.landedCost),
  };
}
