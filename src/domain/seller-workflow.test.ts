import { describe, expect, it } from "vitest";
import {
  createSellerOperationalRun,
  lockSellerSpot,
  realizedSellerProfit,
  recordSellerSpotActual,
  recordSellerOrder,
  reconcileSellerLedger,
  actualSellerLedgerProfit,
  applySellerTargets,
} from "./seller-workflow";
import { WHATNOT_US } from "./marketplace";

const basis = { kind: "cash" as const, amount: 80, source: "receipt" };
const measuredCosts = [{ id: "labor", label: "Labor", state: { kind: "measured" as const, amount: 10 } }];

describe("seller operational workflow", () => {
  it("applies a plan as targets only, never as actual revenue", () => {
    const run = applySellerTargets("plan-r1", [{ id: "W", targetRevenue: 20 }]);
    expect(run.spots[0].state).toEqual({ kind: "target", targetRevenue: 20 });
    expect(realizedSellerProfit(run, basis, measuredCosts)).toEqual({ kind: "hidden", reason: "spots-incomplete" });
  });

  it("moves a seller spot from target to locked to actual without mutating the prior run", () => {
    const target = createSellerOperationalRun("plan-r1", [{ id: "W", targetRevenue: 20 }]);
    const locked = lockSellerSpot(target, "W", "2026-08-29T19:00:00Z");
    const actual = recordSellerSpotActual(locked, "W", 22, "2026-08-29T19:01:00Z");
    expect(target.spots[0].state.kind).toBe("target");
    expect(locked.spots[0].state.kind).toBe("locked");
    expect(actual.spots[0].state).toMatchObject({ kind: "actual", actualRevenue: 22 });
    expect(actual.planRevision).toBe("plan-r1");
  });

  it("hides realized profit until every target is actual", () => {
    let run = createSellerOperationalRun("plan-r1", [
      { id: "W", targetRevenue: 20 }, { id: "U", targetRevenue: 20 },
    ]);
    run = lockSellerSpot(run, "W", "2026-08-29T19:00:00Z");
    run = recordSellerSpotActual(run, "W", 22, "2026-08-29T19:01:00Z");
    expect(realizedSellerProfit(run, basis, measuredCosts)).toEqual({ kind: "hidden", reason: "spots-incomplete" });
  });

  it("shows realized profit only with reconciled actual revenue and measured costs", () => {
    let run = createSellerOperationalRun("plan-r1", [{ id: "W", targetRevenue: 20 }]);
    run = lockSellerSpot(run, "W", "2026-08-29T19:00:00Z");
    run = recordSellerSpotActual(run, "W", 100, "2026-08-29T19:01:00Z");
    expect(realizedSellerProfit(run, basis, measuredCosts)).toEqual({ kind: "actual", amount: 10 });
    expect(realizedSellerProfit(run, basis, [
      { id: "labor", label: "Labor", state: { kind: "estimated", amount: 10 } },
    ])).toEqual({ kind: "hidden", reason: "costs-incomplete" });
  });

  it("reconciles an order/shipment ledger once per order and shipment", () => {
    let run = createSellerOperationalRun("plan-r1", [{ id: "W", targetRevenue: 20 }, { id: "U", targetRevenue: 20 }]);
    run = lockSellerSpot(run, "W", "2026-08-29T19:00:00Z");
    run = lockSellerSpot(run, "U", "2026-08-29T19:00:00Z");
    run = recordSellerOrder(run, {
      id: "order-1", reference: "whatnot-123", slotIds: ["W", "U"], paidAmount: 50,
      recordedAt: "2026-08-29T19:01:00Z", shipmentId: "shipment-1",
    });
    expect(reconcileSellerLedger(run, [{
      id: "order-1", reference: "whatnot-123", slotIds: ["W", "U"], paidAmount: 50,
      recordedAt: "2026-08-29T19:01:00Z", shipmentId: "shipment-1",
    }], [{ id: "shipment-1", orderIds: ["order-1"], packingCost: 2, sellerCoveredShipping: 5 }]))
      .toEqual({ kind: "reconciled", orderCount: 1, shipmentCount: 1, hammer: 50, packingAndShipping: 7 });

    expect(actualSellerLedgerProfit(run, [{
      id: "order-1", reference: "whatnot-123", slotIds: ["W", "U"], paidAmount: 50,
      recordedAt: "2026-08-29T19:01:00Z", shipmentId: "shipment-1",
    }], [{ id: "shipment-1", orderIds: ["order-1"], packingCost: 2, sellerCoveredShipping: 5 }], 0, WHATNOT_US))
      .toMatchObject({ kind: "actual", fees: 5.75, shipmentCosts: 7 });
  });

  it("rejects duplicate slots and withholds an unfinished ledger", () => {
    const run = createSellerOperationalRun("plan-r1", [{ id: "W", targetRevenue: 20 }, { id: "U", targetRevenue: 20 }]);
    expect(() => recordSellerOrder(run, {
      id: "order-1", reference: "receipt", slotIds: ["W"], paidAmount: 20,
      recordedAt: "", shipmentId: "shipment-1",
    })).toThrow("timestamp");
    expect(reconcileSellerLedger(run, [], [])).toEqual({ kind: "incomplete", missingOrders: ["W", "U"], missingShipments: [] });
    expect(() => reconcileSellerLedger(run, [{
      id: "order-1", reference: "receipt", slotIds: ["W", "W"], paidAmount: 20,
      recordedAt: "2026-08-29T19:00:00Z", shipmentId: "shipment-1",
    }], [])).toThrow("duplicate");
  });
});
