import { describe, expect, it } from "vitest";
import { manualBudgetCap } from "./manual-budget";
describe("manual budget cap", () => {
  it("uses only buyer-entered target and shipping", () => {
    expect(manualBudgetCap(60, 5, 56)).toEqual({ maximumHammer: 55, landedCost: 61, recommendation: "PASS" });
    expect(manualBudgetCap(60, 5, 55)?.recommendation).toBe("STOP HERE");
    expect(manualBudgetCap(5, 5, 1)).toEqual({ maximumHammer: 0, landedCost: 6, recommendation: "PASS" });
  });
  it("withholds a cap until both finite non-negative required values exist", () => { expect(manualBudgetCap(undefined, 5)).toBeUndefined(); expect(manualBudgetCap(5, -1)).toBeUndefined(); });
});
