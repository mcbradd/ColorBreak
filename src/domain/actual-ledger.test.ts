import { describe, expect, it } from "vitest";
import { actualLedgerSummary, validateActualLedger } from "./actual-ledger";

describe("actual receipt ledger", () => {
  const full = { version: 1 as const, orders: [{ id: "o1", slotIds: ["W", "U"], receiptCents: 5000, feeCents: 575, reference: "receipt-1", shipmentId: "s1" }], shipments: [{ id: "s1", orderIds: ["o1"], postageCents: 500, packingCents: 200 }] };
  it("charges a fee and fulfillment once for a multi-slot order", () => {
    const ledger = validateActualLedger(full, ["W", "U"]);
    expect(actualLedgerSummary(ledger, ["W", "U"], 3000)).toMatchObject({ gross: 5000, fees: 575, fulfillment: 700, profitCents: 725 });
  });
  it("rejects duplicate slot ownership and hides profit when evidence is absent", () => {
    expect(() => validateActualLedger({ ...full, orders: [...full.orders, { ...full.orders[0], id: "o2", slotIds: ["W"] }] }, ["W", "U"])).toThrow("more than one order");
    expect(actualLedgerSummary(validateActualLedger({ ...full, shipments: [] }, ["W", "U"]), ["W", "U"], 3000).profitCents).toBeUndefined();
  });
});
