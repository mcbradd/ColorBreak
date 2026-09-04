import { describe, expect, it } from "vitest";
import { bidCeiling, DEFAULT_BUYER_COSTS, hasBuyerCosts, landedCost } from "./bid-ceiling";

describe("bid ceiling", () => {
  it("returns the value itself when the buyer pays no extra cost", () => {
    expect(bidCeiling(40, DEFAULT_BUYER_COSTS)).toEqual({ kind: "ceiling", hammer: 40, landed: 40 });
  });

  it("removes shipping before percentage costs are applied", () => {
    const ceiling = bidCeiling(40, { ...DEFAULT_BUYER_COSTS, shipping: 5, taxPercent: 10 });
    expect(ceiling).toEqual({ kind: "ceiling", hammer: 31.36, landed: expect.any(Number) });
    expect(landedCost(31.36, { ...DEFAULT_BUYER_COSTS, shipping: 5, taxPercent: 10 })).toBeLessThanOrEqual(40);
  });

  it("never rounds the ceiling up past the modeled value", () => {
    const costs = { ...DEFAULT_BUYER_COSTS, taxPercent: 7.25, feePercent: 3, fixedFee: 0.3 };
    const ceiling = bidCeiling(19.99, costs);
    if (ceiling.kind !== "ceiling") throw new Error("expected a ceiling");
    expect(landedCost(ceiling.hammer, costs)).toBeLessThanOrEqual(19.99);
    expect(landedCost(ceiling.hammer + 0.01, costs)).toBeGreaterThan(19.99);
  });

  it("reports no room when costs alone meet the modeled value", () => {
    expect(bidCeiling(10, { ...DEFAULT_BUYER_COSTS, shipping: 10 })).toEqual({ kind: "no-room" });
    expect(bidCeiling(0, DEFAULT_BUYER_COSTS)).toEqual({ kind: "no-room" });
  });

  it("knows whether the buyer has entered any assumption at all", () => {
    expect(hasBuyerCosts(DEFAULT_BUYER_COSTS)).toBe(false);
    expect(hasBuyerCosts({ ...DEFAULT_BUYER_COSTS, feePercent: 2 })).toBe(true);
  });
});
