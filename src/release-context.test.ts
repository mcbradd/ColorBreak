import { describe, expect, it } from "vitest";
import { buyerDecisionPresentation } from "./release-context";

describe("bid ceiling availability", () => {
  it("permits a ceiling when the selected data is eligible", () => {
    expect(buyerDecisionPresentation("eligible")).toEqual({
      canShowDecision: true, heading: undefined, maxHammer: undefined,
    });
  });
  it("withholds a ceiling when the selected data is not eligible", () => {
    expect(buyerDecisionPresentation("stale")).toEqual({
      canShowDecision: false, heading: "LIMIT UNAVAILABLE", maxHammer: "—",
    });
  });
});
