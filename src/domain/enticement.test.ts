import { describe, expect, it } from "vitest";
import { scenarioEconomics } from "./enticement";

describe("enticement economics", () => {
  it("prices fixed, triggered, and whiff-contingent seller liabilities without blending states", () => {
    expect(scenarioEconomics({ kind: "fixed-product", cost: 25, buyerValue: 18 })).toEqual({
      expectedSellerCost: 25, expectedBuyerValue: 18,
    });
    expect(scenarioEconomics({ kind: "threshold-product", cost: 25, buyerValue: 18, probability: .4 })).toEqual({
      expectedSellerCost: 10, expectedBuyerValue: 7.2,
    });
    expect(scenarioEconomics({ kind: "whiff-insurance", cost: 10, buyerValue: 10, probability: .3 })).toEqual({
      expectedSellerCost: 3, expectedBuyerValue: 3,
    });
  });
});
