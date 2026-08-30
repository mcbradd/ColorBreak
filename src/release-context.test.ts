import { describe, expect, it } from "vitest";
import { analysisOnlyReleaseContext, buyerDecisionPresentation } from "./release-context";

describe("release posture", () => {
  it("never permits an action decision in an analysis-only release, even with fresh complete data", () => {
    expect(buyerDecisionPresentation("eligible", analysisOnlyReleaseContext)).toEqual({
      canShowDecision: false, heading: "ANALYSIS ONLY — NO BID DECISION", maxHammer: "—",
    });
  });
  it("permits an eligible decision only in a decision-ready release", () => {
    expect(buyerDecisionPresentation("eligible", { posture: "decision-ready" }).canShowDecision).toBe(true);
    expect(buyerDecisionPresentation("stale", { posture: "decision-ready" }).canShowDecision).toBe(false);
  });
});
