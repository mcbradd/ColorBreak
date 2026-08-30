import { describe, expect, it } from "vitest";
import { manualBudgetCap } from "./manual-budget";

describe("manual budget cap", () => {
  it.each([
    [88, 12, 80, 76, 92, -4, "DO NOT BID"],
    [100, 12, 80, 88, 92, 8, "BID"],
    [100, 12, 88, 88, 100, 0, "STOP HERE"],
    [60, 5, 55.99, 55, 60.99, -0.99, "DO NOT BID"],
    [5, 5, 0, 0, 5, 0, "STOP HERE"],
    [5, 7, 0, 0, 7, -2, "DO NOT BID"],
  ] as const)("normalizes the all-in boundary for cap $%s, shipping $%s, hammer $%s", (cap, shipping, hammer, maximumHammer, landedCost, roomToCap, recommendation) => {
    expect(manualBudgetCap(cap, shipping, hammer)).toMatchObject({ totalLandedCostCap: cap, addedShipping: shipping, currentHammer: hammer, maximumHammer, landedCost, roomToCap, recommendation });
  });

  it("withholds a cap until both finite non-negative required values exist, while hammer stays optional", () => {
    expect(manualBudgetCap(undefined, 5)).toBeUndefined();
    expect(manualBudgetCap(5, -1)).toBeUndefined();
    expect(manualBudgetCap(Number.NaN, 5)).toBeUndefined();
    expect(manualBudgetCap(5, Number.POSITIVE_INFINITY)).toBeUndefined();
    expect(manualBudgetCap(60, 5)).toEqual({ totalLandedCostCap: 60, addedShipping: 5, maximumHammer: 55 });
    expect(manualBudgetCap(60, 5, -1)).toEqual({ totalLandedCostCap: 60, addedShipping: 5, maximumHammer: 55 });
  });

  it("rounds accepted fractional cents once at the domain boundary", () => {
    expect(manualBudgetCap(10.005, 1.004, 8.996)).toMatchObject({ totalLandedCostCap: 10.01, addedShipping: 1, maximumHammer: 9.01, currentHammer: 9, landedCost: 10, roomToCap: 0.01, recommendation: "BID" });
  });

  it("preserves cent-exact invariants across a broad deterministic matrix", () => {
    for (let capCents = 0; capCents <= 20_000; capCents += 997) for (let shippingCents = 0; shippingCents <= 20_000; shippingCents += 887) for (let hammerCents = 0; hammerCents <= 20_000; hammerCents += 769) {
      const result = manualBudgetCap(capCents / 100, shippingCents / 100, hammerCents / 100)!;
      expect(result.landedCost).toBe((hammerCents + shippingCents) / 100);
      expect(result.maximumHammer).toBe(Math.max(0, capCents - shippingCents) / 100);
      const room = capCents - hammerCents - shippingCents;
      expect(result.roomToCap).toBe(room / 100);
      expect(result.recommendation).toBe(room > 0 ? "BID" : room === 0 ? "STOP HERE" : "DO NOT BID");
      if (shippingCents <= capCents) {
        const hammerRelation = hammerCents - (capCents - shippingCents);
        expect(result.recommendation).toBe(hammerRelation < 0 ? "BID" : hammerRelation === 0 ? "STOP HERE" : "DO NOT BID");
      }
    }
  });
});
