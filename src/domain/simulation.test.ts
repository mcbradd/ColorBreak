import { describe, expect, it } from "vitest";
import { simulateOutcomes } from "./simulation";
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
    expect(first.sampleCount).toBe(10_000);
  });

  it("refuses to claim distributions for an incomplete model", () => {
    expect(() => simulateOutcomes({ ...coinFlipPack, complete: false }, {
      seed: "blocked", sampleCount: 100, remaining: ["W"],
    })).toThrow("material omissions");
  });
});
