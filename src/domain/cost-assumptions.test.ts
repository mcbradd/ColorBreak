import { afterEach, describe, expect, it } from "vitest";
import { estimatedCards, estimatedLabel, estimatedTax, labelPrice, resolveCosts } from "./cost-assumptions";
import { calculateBreak } from "./valuation";
import { clearColorBreakBrowserStorage, costOverridesKey, readCostOverrides, writeCostOverrides } from "../persistence";

describe("Whatnot standing assumptions", () => {
  afterEach(() => sessionStorage.clear());
  it("uses inclusive ounce boundaries and the 1–5 lb bundled rate", () => {
    expect([4, 5, 8, 9, 12, 13, 15.9, 16, 80].map(labelPrice)).toEqual([4.47, 4.85, 4.85, 5.25, 5.25, 6.75, 6.75, 7.75, 7.75]);
    expect(estimatedLabel(420, 8)).toBe(4.85);
    expect(estimatedLabel(420, 8, 0)).toBe(0);
  });
  it("deducts incremental bundled shipping, but charges every per-item purchase", () => {
    const first = resolveCosts({}, 420, 8, 0, "America/Phoenix");
    const second = resolveCosts({}, 420, 8, 1, "America/Phoenix");
    expect(first.costs.shipping).toBe(4.85);
    expect(second.amount).toBe(4.85);
    expect(second.costs.shipping).toBe(0);
    expect(resolveCosts({}, 420, 8, 2, "UTC").costs.shipping).toBe(.4);
    expect(resolveCosts({ shipping: 6, shippingMode: "per-item" }, 420, 8, 1, "UTC").costs.shipping).toBe(6);
    expect(resolveCosts({ shipping: 6, shippingMode: "flat" }, 420, 8, 1, "UTC").costs.shipping).toBe(0);
  });
  it("keeps physical weight independent of bulk filters and missing card prices", () => {
    const input = { prices: [], draws: [{ set: "TST", collectorNumber: "1", copies: 420, foil: false, source: "test" }] };
    const lines = [{ id: "box", set: "TST", productKey: "box", productLabel: "Play Booster Box", quantity: 1, packCount: 30 }];
    expect(estimatedCards(lines, calculateBreak({ ...input, threshold: 0 }))).toBe(420);
    expect(estimatedCards(lines, calculateBreak({ ...input, threshold: 200 }))).toBe(420);
    expect(estimatedCards([{ ...lines[0], quantity: 2 }])).toBe(840);
  });
  it("discloses coarse location and falls back without requiring geolocation", () => {
    expect(estimatedTax("America/Phoenix").rate).toBe(8.54);
    expect(estimatedTax("America/Los_Angeles").note).toMatch(/not your address/);
    expect(estimatedTax("Europe/London")).toMatchObject({ rate: 7.53, note: expect.stringContaining("Delivery location is unknown") });
  });
  it("preserves deliberate zeros and mode across changing contents and remounts, until all data is cleared", () => {
    writeCostOverrides({ shipping: 0, taxPercent: 0, shippingMode: "per-item" });
    expect(resolveCosts(readCostOverrides(), 4200, 8, 0, "America/Phoenix").costs).toEqual({ shipping: 0, taxPercent: 0 });
    expect(readCostOverrides()).toEqual({ shipping: 0, taxPercent: 0, shippingMode: "per-item" });
    clearColorBreakBrowserStorage();
    expect(sessionStorage.getItem(costOverridesKey)).toBeNull();
    expect(resolveCosts(readCostOverrides(), 420, 8, 0, "America/Phoenix").amount).toBe(4.85);
  });
  it("migrates old entered shipping as per-purchase and drops seller fees", () => {
    sessionStorage.setItem("colorbreak:buyer:costs:v1", JSON.stringify({ shipping: 5, taxPercent: 8, feePercent: 8, fixedFee: .3 }));
    expect(readCostOverrides()).toEqual({ shipping: 5, taxPercent: 8, shippingMode: "per-item" });
  });
});
