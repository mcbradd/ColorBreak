import { afterEach, describe, expect, it } from "vitest";
import {
  defaultSellerPlanDraft,
  readSellerPlanDraft,
  sellerPlanKey,
  writeSellerPlanDraft,
} from "./persistence";

describe("seller plan session persistence", () => {
  afterEach(() => sessionStorage.clear());

  it("round-trips the private operating plan only through this browser session", () => {
    const plan = {
      ...defaultSellerPlanDraft(),
      buyerShipping: 7.25,
      commission: 9,
      acceptedEstimateIds: ["box-1"],
      minimumAsk: 3,
      lockedAsks: { W: 31 },
      actualAsks: { U: 26.5 },
      unsoldSlots: ["B" as const],
    };

    writeSellerPlanDraft(plan);

    expect(readSellerPlanDraft()).toEqual(plan);
    expect(localStorage.getItem(sellerPlanKey)).toBeNull();
  });

  it("rejects malformed, negative, and unknown persisted fields", () => {
    sessionStorage.setItem(sellerPlanKey, JSON.stringify({
      buyerShipping: -4,
      commission: "free",
      acceptedEstimateIds: ["safe", 2],
      minimumAsk: Number.NaN,
      lockedAsks: { W: 20, NOPE: 44, U: -1 },
      actualAsks: { R: 15, bad: 4 },
      unsoldSlots: ["G", "bogus"],
    }));

    expect(readSellerPlanDraft()).toMatchObject({
      buyerShipping: 5,
      commission: 8,
      acceptedEstimateIds: ["safe"],
      minimumAsk: 1,
      lockedAsks: { W: 20 },
      actualAsks: { R: 15 },
      unsoldSlots: ["G"],
    });
  });
});
