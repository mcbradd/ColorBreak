import { SLOT_IDS, type SlotId, type ValuationResult } from "./types";
import { summarizeDistribution, type SimulationResult } from "./simulation";

/** Instant answer from analytic means; explicitly not a sampled opening range. */
export function quickOutcomes(valuation: ValuationResult, remaining: SlotId[], landedCost?: number): SimulationResult {
  const values = new Map((valuation.slots ?? []).map((slot) => [slot.id, slot.sellableEV]));
  return {
    seed: "analytic-preview", sampleCount: 0,
    slotDistributions: Object.fromEntries(SLOT_IDS.map((id) => [id, { ...summarizeDistribution([values.get(id) ?? 0], landedCost), preview: true }])) as SimulationResult["slotDistributions"],
    remainingPool: { ...summarizeDistribution(remaining.map((id) => values.get(id) ?? 0), landedCost), preview: true },
  };
}
