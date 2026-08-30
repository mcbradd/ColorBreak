import { afterEach, describe, expect, it } from "vitest";
import {
  buyerDecisionKey,
  buyerDecisionFingerprint,
  defaultSellerPlanDraft,
  readBuyerDecisionRecord,
  readSellerPlanDraft,
  sellerPlanKey,
  sellerPlanMatches,
  sellerPlanOwner,
  writeBuyerDecisionRecord,
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
      unsoldSlots: ["G", "bogus"],
    }));

    expect(readSellerPlanDraft()).toMatchObject({
      buyerShipping: 5,
      commission: 8,
      acceptedEstimateIds: ["safe"],
      minimumAsk: 1,
      lockedAsks: { W: 20 },
      unsoldSlots: ["G"],
    });
  });

  it("drops legacy actual asks instead of silently treating targets as receipts", () => {
    sessionStorage.setItem(sellerPlanKey, JSON.stringify({
      ...defaultSellerPlanDraft(), actualAsks: { W: 42 },
    }));
    expect(readSellerPlanDraft()).toMatchObject({
      lockedAsks: {}, reconciliationNeeded: true,
    });
    expect(readSellerPlanDraft()).not.toHaveProperty("actualAsks");
  });

  it("binds seller locks and accepted estimates to the exact composition and valuation version", () => {
    const lines = [{ id: "one", set: "TST", productKey: "box", productLabel: "Box", quantity: 1 }];
    const owner = sellerPlanOwner(lines, "prices-a");
    const plan = { ...defaultSellerPlanDraft(), owner, lockedAsks: { W: 25 }, unsoldSlots: ["B" as const], acceptedEstimateIds: ["one"] };
    expect(sellerPlanMatches(plan, owner)).toBe(true);
    expect(sellerPlanMatches(plan, sellerPlanOwner([{ ...lines[0], quantity: 2 }], "prices-a"))).toBe(false);
    expect(sellerPlanMatches(plan, sellerPlanOwner(lines, "prices-b"))).toBe(false);
    expect(sellerPlanMatches(plan, sellerPlanOwner([{ ...lines[0], id: "imported" }], "prices-a"))).toBe(true);
  });
});

describe("buyer decision session persistence", () => {
  const state = {
    lines: [{ id: "line-1", set: "TST", productKey: "play-box", productLabel: "Play Booster Box", quantity: 1 }],
    dataVersion: "TST:play-box:1@2026-08-30",
    assignmentMode: "random" as const,
    selectedSlot: "U" as const,
    remaining: ["W", "U", "B"] as const,
    bulkEnabled: true,
    bulkThreshold: 2,
    largeSpots: 120,
  };

  afterEach(() => sessionStorage.clear());

  it("round-trips one atomic, composition-bound private buyer snapshot", () => {
    writeBuyerDecisionRecord(state, { bid: 12.5, shipping: 4.25 });
    expect(readBuyerDecisionRecord(state)).toMatchObject({
      fingerprint: buyerDecisionFingerprint(state),
      remaining: ["W", "U", "B"], bid: 12.5, shipping: 4.25,
    });
  });

  it("rejects money and auction state after any decision-relevant change", () => {
    writeBuyerDecisionRecord(state, { bid: 12.5, shipping: 4.25 });
    expect(readBuyerDecisionRecord({ ...state, dataVersion: "new-price-snapshot" })).toBeUndefined();
    expect(sessionStorage.getItem(buyerDecisionKey)).toBeNull();

    writeBuyerDecisionRecord(state, { bid: 12.5, shipping: 4.25 });
    expect(readBuyerDecisionRecord({ ...state, lines: [{ ...state.lines[0], quantity: 2 }] })).toBeUndefined();
  });

  it("removes malformed or legacy records rather than partially hydrating them", () => {
    sessionStorage.setItem(buyerDecisionKey, JSON.stringify({ bid: 99, shipping: 2, remaining: ["U"] }));
    expect(readBuyerDecisionRecord()).toBeUndefined();
    expect(sessionStorage.getItem(buyerDecisionKey)).toBeNull();
  });
});
