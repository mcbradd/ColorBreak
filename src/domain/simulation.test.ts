import { describe, expect, it } from "vitest";
import { possibleSlotBounds, simulateOutcomes, summarizeDistribution } from "./simulation";
import type { PackOutcomeModel } from "./simulation";

const coinFlipPack: PackOutcomeModel = {
  fixed: [],
  packs: [{
    count: 1,
    variants: [
      { weight: 1, picks: { white: 1 } },
      { weight: 1, picks: { blue: 1 } },
    ],
    sheets: {
      white: { totalWeight: 1, cards: [{ id: "w", slot: "W", value: 10, weight: 1 }] },
      blue: { totalWeight: 1, cards: [{ id: "u", slot: "U", value: 20, weight: 1 }] },
    },
  }],
};

describe("outcome simulation", () => {
  it("is reproducible and summarizes the random remaining-slot assignment", () => {
    const first = simulateOutcomes(coinFlipPack, {
      seed: "break-1", sampleCount: 10_000, remaining: ["W", "U"], landedCost: 8,
    });
    const again = simulateOutcomes(coinFlipPack, {
      seed: "break-1", sampleCount: 10_000, remaining: ["W", "U"], landedCost: 8,
    });

    expect(again).toEqual(first);
    expect(first.remainingPool.mean).toBeCloseTo(7.5, 0);
    expect(first.remainingPool.chanceToClearCost).toBeCloseTo(0.5, 1);
    expect(first.slotDistributions.W.mean).toBeCloseTo(5, 0);
    expect(first.slotDistributions.U.mean).toBeCloseTo(10, 0);
    expect(first.remainingPool.min).toBe(0);
    expect(first.remainingPool.max).toBe(20);
    expect(first.sampleCount).toBe(10_000);
  });

  it("returns a partial distribution for an incomplete model", () => {
    const result = simulateOutcomes({ ...coinFlipPack, complete: false }, {
      seed: "blocked", sampleCount: 100, remaining: ["W"],
    });
    expect(result.slotDistributions.W.mean).toBeGreaterThan(0);
    expect(result.sampleCount).toBe(100);
  });

  it("derives exact possible slot bounds from variants and replacement rules", () => {
    const model: PackOutcomeModel = {
      fixed: [{ id: "fixed", slot: "W", value: 2, count: 1 }],
      packs: [{
        count: 2,
        variants: [{ weight: 1, picks: { noRepeat: 2, repeat: 1 } }],
        sheets: {
          noRepeat: {
            totalWeight: 3,
            allowDuplicates: false,
            cards: [
              { id: "w10", slot: "W", value: 10, weight: 1 },
              { id: "w4", slot: "W", value: 4, weight: 1 },
              { id: "u20", slot: "U", value: 20, weight: 1 },
            ],
          },
          repeat: {
            totalWeight: 2,
            cards: [
              { id: "w3", slot: "W", value: 3, weight: 1 },
              { id: "u5", slot: "U", value: 5, weight: 1 },
            ],
          },
        },
      }],
    };

    const bounds = possibleSlotBounds(model);

    expect(bounds.W).toEqual({ min: 10, max: 36 });
    expect(bounds.U).toEqual({ min: 0, max: 50 });
  });

  it("defaults uncertain sheet collation to no duplicate printing in one pack", () => {
    const model: PackOutcomeModel = {
      fixed: [],
      packs: [{
        count: 1,
        variants: [{ weight: 1, picks: { wildcard: 2 } }],
        sheets: { wildcard: { totalWeight: 2, cards: [
          { id: "chase", slot: "G", value: 100, weight: 1 },
          { id: "other", slot: "G", value: 10, weight: 1 },
        ] } },
      }],
    };

    const result = simulateOutcomes(model, { seed: "no-repeat", sampleCount: 100, remaining: ["G"] });
    expect(result.slotDistributions.G.min).toBe(110);
    expect(result.slotDistributions.G.max).toBe(110);
    expect(possibleSlotBounds(model).G.max).toBe(110);
  });

  it("guarantees one card of each color from a color-balanced sheet", () => {
    // MTGJSON marks draft common sheets as color balanced: the pack always
    // contains at least one card of each mono color. Without that, an opening
    // could miss white entirely and the white floor would read $0.
    const balanced: PackOutcomeModel = {
      fixed: [],
      packs: [{
        count: 1,
        variants: [{ weight: 1, picks: { common: 6 } }],
        sheets: {
          common: {
            totalWeight: 10,
            balanceColors: true,
            cards: [
              { id: "w1", slot: "W", value: 1, weight: 1 },
              { id: "w2", slot: "W", value: 3, weight: 1 },
              { id: "u1", slot: "U", value: 1, weight: 1 },
              { id: "b1", slot: "B", value: 1, weight: 1 },
              { id: "r1", slot: "R", value: 1, weight: 1 },
              { id: "g1", slot: "G", value: 1, weight: 1 },
              { id: "c1", slot: "C", value: 50, weight: 1 },
              { id: "c2", slot: "C", value: 50, weight: 1 },
              { id: "c3", slot: "C", value: 50, weight: 1 },
              { id: "c4", slot: "C", value: 50, weight: 1 },
            ],
          },
        },
      }],
    };

    const result = simulateOutcomes(balanced, { seed: "balanced", sampleCount: 2_000, remaining: ["W"] });
    expect(result.slotDistributions.W.min).toBeGreaterThanOrEqual(1);
    expect(result.slotDistributions.U.min).toBe(1);
    expect(result.slotDistributions.G.min).toBe(1);
    // Five picks are spent on the color guarantee, so at most one of the six
    // is colorless.
    expect(result.slotDistributions.C.max).toBe(50);

    const bounds = possibleSlotBounds(balanced);
    expect(bounds.W).toEqual({ min: 1, max: 4 });
    expect(bounds.U).toEqual({ min: 1, max: 1 });
    expect(bounds.C).toEqual({ min: 0, max: 50 });
  });

  it("draws a balanced sheet unbalanced when a whole color has no printing", () => {
    // Balancing a color the resolved sheet no longer contains is impossible.
    // The simulation must not invent a card; the outcome model names the gap.
    const model: PackOutcomeModel = {
      fixed: [],
      packs: [{
        count: 1,
        variants: [{ weight: 1, picks: { common: 5 } }],
        sheets: {
          common: {
            totalWeight: 5,
            balanceColors: true,
            cards: [
              { id: "w1", slot: "W", value: 1, weight: 1 },
              { id: "u1", slot: "U", value: 1, weight: 1 },
              { id: "b1", slot: "B", value: 1, weight: 1 },
              { id: "r1", slot: "R", value: 1, weight: 1 },
              { id: "c1", slot: "C", value: 1, weight: 1 },
            ],
          },
        },
      }],
    };

    const result = simulateOutcomes(model, { seed: "unbalanceable", sampleCount: 200, remaining: ["G"] });
    expect(result.slotDistributions.G.max).toBe(0);
    expect(possibleSlotBounds(model).W).toEqual({ min: 1, max: 1 });
  });

  it("publishes one-percent range endpoints instead of sampled jackpots", () => {
    const values = Array.from({ length: 100 }, (_, index) => index);
    const summary = summarizeDistribution(values);
    expect(summary.p01).toBeCloseTo(.99);
    expect(summary.p99).toBeCloseTo(98.01);
  });

  // Guards the P0-3 fix: a heavily bulk-filtered slot can legitimately return
  // $0 for the 10th/50th/90th percentiles while the 99th percentile and mean
  // are pulled up by rare valuable hits. This must stay a correct, right-
  // skewed result — never silently collapse into an actual computation bug.
  it("lets p10/median/p90 all read zero while p99 and mean stay positive, for a right-skewed mostly-zero distribution", () => {
    const values = [...Array(95).fill(0), ...Array(5).fill(200)];
    const summary = summarizeDistribution(values);
    expect(summary.p10).toBe(0);
    expect(summary.median).toBe(0);
    expect(summary.p90).toBe(0);
    expect(summary.p99).toBeGreaterThan(0);
    expect(summary.mean).toBeGreaterThan(0);
    // Quantiles must stay monotone non-decreasing — if they didn't, the
    // all-zero reading really would indicate broken math, not a fair skew.
    const ordered = [summary.p01, summary.p10, summary.p25, summary.median, summary.p75, summary.p90, summary.p99];
    for (let i = 1; i < ordered.length; i += 1) expect(ordered[i]).toBeGreaterThanOrEqual(ordered[i - 1]);
  });
});
