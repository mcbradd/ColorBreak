import { describe, expect, it } from "vitest";
import { calculateProfit, requiredHammer, transactionNet, WHATNOT_US } from "./marketplace";

describe("Whatnot US economics", () => {
  it("does not return buyer-paid shipping to seller earnings", () => {
    const net = transactionNet({ slot: "G", hammer: 20, buyerShipping: 4.99, buyerTax: 0 }, WHATNOT_US);
    expect(net).toBeCloseTo(20 - 1.6 - (24.99 * 0.029 + 0.3), 6);
  });

  it("charges the fixed processing fee per transaction even in one shipment", () => {
    const result = calculateProfit(
      [
        { slot: "W", hammer: 20, buyerShipping: 4.99, buyerTax: 0 },
        { slot: "U", hammer: 20, buyerShipping: 0, buyerTax: 0 },
      ],
      [{ id: "shipment-1", slots: ["W", "U"], packingCost: 2, sellerCoveredShipping: 0 }],
      10,
      WHATNOT_US,
    );
    expect(result.fees).toBeCloseTo(40 * 0.08 + 44.99 * 0.029 + 0.6, 6);
    expect(result.shipmentCosts).toBe(2);
  });

  it("solves a target hammer using transaction fees and shipping only as processing base", () => {
    const hammer = requiredHammer(8, 16, 100, 20, 5, WHATNOT_US);
    expect(hammer).toBeGreaterThan(150);
    expect(hammer).toBeLessThan(170);
  });
});
