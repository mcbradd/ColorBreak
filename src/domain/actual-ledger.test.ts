import { describe, expect, it } from "vitest";
import { actualLedgerSummary, missingShipmentOrderIds, validateActualLedger } from "./actual-ledger";

describe("actual receipt ledger", () => {
  const full = { version: 1 as const, orders: [{ id: "o1", slotIds: ["W", "U"], receiptCents: 5000, feeCents: 575, reference: "receipt-1", shipmentId: "s1" }], shipments: [{ id: "s1", orderIds: ["o1"], postageCents: 500, packingCents: 200 }] };
  it("charges a fee and fulfillment once for a multi-slot order", () => {
    const ledger = validateActualLedger(full, ["W", "U"]);
    expect(actualLedgerSummary(ledger, ["W", "U"], 3000)).toMatchObject({ gross: 5000, fees: 575, fulfillment: 700, profitCents: 725 });
  });
  it("rejects duplicate slot ownership and hides profit when evidence is absent", () => {
    expect(() => validateActualLedger({ ...full, orders: [...full.orders, { ...full.orders[0], id: "o2", slotIds: ["W"] }] }, ["W", "U"])).toThrow("more than one order");
    const unshipped = validateActualLedger({ ...full, orders: [{ ...full.orders[0], shipmentId: undefined }], shipments: [] }, ["W", "U"]);
    expect(actualLedgerSummary(unshipped, ["W", "U"], 3000).profitCents).toBeUndefined();
  });
  it("derives shipment gaps only from validated persisted links", () => {
    const none = validateActualLedger({ version: 1, orders: [], shipments: [] }, ["W", "U"]);
    const one = validateActualLedger({ version: 1, orders: [{ id: "o1", slotIds: ["W"], receiptCents: 1, feeCents: 0 }], shipments: [] }, ["W", "U"]);
    const many = validateActualLedger({ version: 1, orders: [{ id: "o1", slotIds: ["W"], receiptCents: 1, feeCents: 0, shipmentId: "s1" }, { id: "o2", slotIds: ["U"], receiptCents: 1, feeCents: 0 }], shipments: [{ id: "s1", orderIds: ["o1"], postageCents: 0, packingCents: 0 }] }, ["W", "U"]);
    expect(missingShipmentOrderIds(none)).toEqual([]);
    expect(missingShipmentOrderIds(one)).toEqual(["o1"]);
    expect(missingShipmentOrderIds(many)).toEqual(["o2"]);
  });
  it("rejects duplicate, orphan, split, and removed-order shipment links", () => {
    expect(() => validateActualLedger({ ...full, shipments: [...full.shipments, { ...full.shipments[0], id: "s2" }] }, ["W", "U"])).toThrow("more than one shipment");
    expect(() => validateActualLedger({ ...full, shipments: [{ ...full.shipments[0], orderIds: ["gone"] }] }, ["W", "U"])).toThrow("Actual shipment is invalid");
    expect(() => validateActualLedger({ ...full, orders: [{ ...full.orders[0], shipmentId: "gone" }], shipments: [] }, ["W", "U"])).toThrow("missing shipment");
  });
});
