import { afterEach, describe, expect, it } from "vitest";
import {
  defaultSellerPlanDraft,
  readSellerPlanDraft,
  sellerCompositionFingerprint,
  sellerPlanKey,
  sellerPlanKeyFor,
  writeSellerPlanDraft,
} from "./persistence";

const fingerprint = sellerCompositionFingerprint([{ id: "one", set: "TST", productKey: "box", productLabel: "Box", quantity: 1 }], "model-v1");

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

    writeSellerPlanDraft(fingerprint, plan);

    expect(readSellerPlanDraft(fingerprint)).toEqual(plan);
    expect(localStorage.getItem(sellerPlanKeyFor(fingerprint))).toBeNull();
  });

  it("rejects malformed, negative, and unknown persisted fields", () => {
    sessionStorage.setItem(sellerPlanKeyFor(fingerprint), JSON.stringify({ schemaVersion: 2, compositionFingerprint: fingerprint, draft: {
      buyerShipping: -4,
      commission: "free",
      acceptedEstimateIds: ["safe", 2],
      minimumAsk: Number.NaN,
      lockedAsks: { W: 20, NOPE: 44, U: -1 },
      actualAsks: { R: 15, bad: 4 },
      unsoldSlots: ["G", "bogus"],
    }}));

    expect(readSellerPlanDraft(fingerprint)).toMatchObject({
      buyerShipping: 5,
      commission: 8,
      acceptedEstimateIds: ["safe"],
      minimumAsk: 1,
      lockedAsks: { W: 20 },
      actualAsks: { R: 15 },
      unsoldSlots: ["G"],
    });
  });

  it("deletes unsafe global v1 data instead of reusing it for a new composition", () => {
    sessionStorage.setItem(sellerPlanKey, JSON.stringify({ actualAsks: { W: 42 } }));
    expect(readSellerPlanDraft(fingerprint).actualAsks).toEqual({});
    expect(sessionStorage.getItem(sellerPlanKey)).toBeNull();
  });
});
