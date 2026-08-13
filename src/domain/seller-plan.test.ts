import { describe, expect, it } from "vitest";
import { completeCost, sellerPlanStatus } from "./seller-plan";

describe("V2 seller plan", () => {
  it("subtracts every resolved cost leaf exactly once", () => {
    expect(completeCost({
      acquisition: 100,
      packingAndCoveredShipping: 12,
      labor: 25,
      tax: 4,
      giveaways: 3,
      refundReserve: 15,
      overhead: 6,
    })).toBe(165);
  });

  it("maps buyer-value headroom to an honest run decision", () => {
    expect(sellerPlanStatus(260, 200, 240)).toEqual({ kind: "run", headroom: 20 });
    expect(sellerPlanStatus(220, 200, 240)).toEqual({ kind: "change", headroom: -20 });
    expect(sellerPlanStatus(180, 200, 240)).toEqual({ kind: "do-not-run", headroom: -60 });
  });
});
