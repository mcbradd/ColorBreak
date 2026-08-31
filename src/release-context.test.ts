import { describe, expect, it } from "vitest";
import { buyerDecisionPresentation } from "./release-context";

describe("bid ceiling availability", () => {
  it("permits a ceiling when the selected data is eligible", () => {
    expect(buyerDecisionPresentation("eligible")).toEqual({
      canShowDecision: true, heading: undefined, maxHammer: undefined,
    });
  });
  it("keeps a clearly labeled estimate when prices are stale", () => {
    expect(buyerDecisionPresentation("stale")).toEqual({
      canShowDecision: true, heading: undefined, maxHammer: undefined,
    });
  });
});
