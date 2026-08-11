import { describe, expect, it } from "vitest";
import { canExportScenario, WHATNOT_ENTICEMENTS } from "./compliance";

describe("Whatnot enticement compliance", () => {
  it("exports permitted scenarios and blocks prohibited scenarios", () => {
    expect(canExportScenario(WHATNOT_ENTICEMENTS.fixedCollectorBooster)).toEqual({ allowed: true });
    expect(canExportScenario(WHATNOT_ENTICEMENTS.shippingSubsidy)).toEqual({ allowed: true });
    expect(canExportScenario(WHATNOT_ENTICEMENTS.everythingShips)).toEqual({ allowed: true });
    expect(canExportScenario(WHATNOT_ENTICEMENTS.whiffInsurance)).toEqual({
      allowed: false,
      reason: "Prohibited on Whatnot: outcome-contingent guarantees and bonuses are not permitted.",
    });
  });

  it("requires evidence before exporting an approval-required threshold pack", () => {
    expect(canExportScenario(WHATNOT_ENTICEMENTS.thresholdPack)).toEqual({
      allowed: false,
      reason: "Written Whatnot approval must be recorded before export.",
    });
    expect(canExportScenario({ ...WHATNOT_ENTICEMENTS.thresholdPack, approvalEvidence: "case-123" }))
      .toEqual({ allowed: true });
  });
});
