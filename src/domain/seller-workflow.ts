import {
  actualNetProfit,
  type CostLine,
  type ProductBasis,
} from "./seller-economics";
import { transactionNet } from "./marketplace";
import type { MarketplacePreset } from "./types";

/**
 * The mutable, seller-private operational portion of a launched plan.  The
 * target is planning context; locking records that a spot is accounted for;
 * only an actual records reconciled revenue.  None of these transitions edit a
 * plan revision or expose a value to buyer-facing code.
 */
export type SellerSpotState =
  | { kind: "target"; targetRevenue: number }
  | { kind: "locked"; targetRevenue: number; lockedAt: string }
  | { kind: "actual"; targetRevenue: number; actualRevenue: number; recordedAt: string };

export interface SellerRunSpot {
  id: string;
  state: SellerSpotState;
}

export interface SellerOperationalRun {
  planRevision: string;
  spots: readonly SellerRunSpot[];
}

/**
 * A receipt is deliberately an order, not an ask.  `paidAmount` is the
 * seller's hammer total for every slot in the order; it is never inferred
 * from a target allocation.
 */
export interface SellerOrderRecord {
  id: string;
  reference: string;
  slotIds: readonly string[];
  paidAmount: number;
  recordedAt: string;
  shipmentId: string;
}

export interface SellerShipmentRecord {
  id: string;
  orderIds: readonly string[];
  packingCost: number;
  sellerCoveredShipping: number;
}

export type SellerLedgerReconciliation =
  | { kind: "reconciled"; orderCount: number; shipmentCount: number; hammer: number; packingAndShipping: number }
  | { kind: "incomplete"; missingOrders: string[]; missingShipments: string[]; reason?: string };

export type SellerLedgerProfit =
  | { kind: "hidden"; reconciliation: Extract<SellerLedgerReconciliation, { kind: "incomplete" }> }
  | { kind: "actual"; hammer: number; fees: number; shipmentCosts: number; profit: number };

function assertMoney(amount: number, subject: string) {
  if (!Number.isFinite(amount) || amount < 0) throw new Error(`${subject} must be a finite non-negative amount`);
}

function assertTimestamp(value: string, subject: string) {
  if (!value || Number.isNaN(Date.parse(value))) throw new Error(`${subject} requires a recorded timestamp`);
}

function assertIds(ids: readonly string[], subject: string) {
  if (ids.length === 0 || ids.some((id) => !id)) throw new Error(`${subject} requires at least one id`);
  if (new Set(ids).size !== ids.length) throw new Error(`${subject} contains duplicate ids`);
}

function spotIndex(run: SellerOperationalRun, spotId: string) {
  const index = run.spots.findIndex((spot) => spot.id === spotId);
  if (index < 0) throw new Error(`Unknown seller spot: ${spotId}`);
  return index;
}

export function createSellerOperationalRun(
  planRevision: string,
  targets: readonly { id: string; targetRevenue: number }[],
): SellerOperationalRun {
  if (!planRevision) throw new Error("Seller run requires a plan revision");
  const ids = new Set<string>();
  return {
    planRevision,
    spots: targets.map((target) => {
      if (!target.id || ids.has(target.id)) throw new Error(`Duplicate or empty seller spot: ${target.id}`);
      ids.add(target.id);
      assertMoney(target.targetRevenue, `Target ${target.id}`);
      return { id: target.id, state: { kind: "target", targetRevenue: target.targetRevenue } };
    }),
  };
}

/** Locking is explicit: an accidental observed hammer cannot become an actual. */
export function lockSellerSpot(run: SellerOperationalRun, spotId: string, lockedAt: string): SellerOperationalRun {
  const index = spotIndex(run, spotId);
  const spot = run.spots[index];
  if (spot.state.kind !== "target") throw new Error(`Seller spot ${spotId} is already ${spot.state.kind}`);
  const spots = [...run.spots];
  spots[index] = { id: spot.id, state: { kind: "locked", targetRevenue: spot.state.targetRevenue, lockedAt } };
  return { ...run, spots };
}

export function recordSellerSpotActual(
  run: SellerOperationalRun,
  spotId: string,
  actualRevenue: number,
  recordedAt: string,
): SellerOperationalRun {
  assertMoney(actualRevenue, `Actual revenue for ${spotId}`);
  const index = spotIndex(run, spotId);
  const spot = run.spots[index];
  if (spot.state.kind !== "locked") throw new Error(`Seller spot ${spotId} must be locked before recording an actual`);
  const spots = [...run.spots];
  spots[index] = {
    id: spot.id,
    state: { kind: "actual", targetRevenue: spot.state.targetRevenue, actualRevenue, recordedAt },
  };
  return { ...run, spots };
}

/** Applying a plan creates target rows only; it cannot create a receipt. */
export function applySellerTargets(
  planRevision: string,
  targets: readonly { id: string; targetRevenue: number }[],
): SellerOperationalRun {
  return createSellerOperationalRun(planRevision, targets);
}

/** Records one paid order and moves each of its already-locked slots to actual. */
export function recordSellerOrder(
  run: SellerOperationalRun,
  order: SellerOrderRecord,
): SellerOperationalRun {
  if (!order.id || !order.reference.trim() || !order.shipmentId) throw new Error("Seller order requires an id, reference, and shipment");
  assertIds(order.slotIds, `Order ${order.id} slots`);
  assertMoney(order.paidAmount, `Order ${order.id} paid amount`);
  assertTimestamp(order.recordedAt, `Order ${order.id}`);
  const selected = new Set(order.slotIds);
  for (const id of selected) {
    const spot = run.spots[spotIndex(run, id)];
    if (spot.state.kind !== "locked") throw new Error(`Seller spot ${id} must be locked before recording an actual order`);
  }
  // Spot revenue is retained for the state audit trail only. The reconciled
  // result always uses the order total so a flat fee is charged once/order.
  const share = order.paidAmount / order.slotIds.length;
  return {
    ...run,
    spots: run.spots.map((spot) => selected.has(spot.id)
      ? { id: spot.id, state: { kind: "actual", targetRevenue: spot.state.targetRevenue, actualRevenue: share, recordedAt: order.recordedAt } }
      : spot),
  };
}

/**
 * Checks the private order/shipment ledger without inventing a receipt from a
 * plan target. Invalid records throw; a merely unfinished ledger is returned
 * as an explicit non-monetary reconciliation state.
 */
export function reconcileSellerLedger(
  run: SellerOperationalRun,
  orders: readonly SellerOrderRecord[],
  shipments: readonly SellerShipmentRecord[],
): SellerLedgerReconciliation {
  const orderIds = new Set<string>();
  const orderSlotIds = new Set<string>();
  const runSlotIds = new Set(run.spots.map((spot) => spot.id));
  for (const order of orders) {
    if (!order.id || orderIds.has(order.id)) throw new Error(`Duplicate or empty seller order: ${order.id}`);
    if (!order.reference.trim() || !order.shipmentId) throw new Error(`Seller order ${order.id} requires a reference and shipment`);
    assertIds(order.slotIds, `Order ${order.id} slots`);
    assertMoney(order.paidAmount, `Order ${order.id} paid amount`);
    assertTimestamp(order.recordedAt, `Order ${order.id}`);
    orderIds.add(order.id);
    for (const slotId of order.slotIds) {
      if (!runSlotIds.has(slotId)) throw new Error(`Order ${order.id} has unknown seller spot: ${slotId}`);
      if (orderSlotIds.has(slotId)) throw new Error(`Seller spot ${slotId} belongs to more than one order`);
      orderSlotIds.add(slotId);
    }
  }
  const shipmentIds = new Set<string>();
  const shippedOrders = new Set<string>();
  for (const shipment of shipments) {
    if (!shipment.id || shipmentIds.has(shipment.id)) throw new Error(`Duplicate or empty seller shipment: ${shipment.id}`);
    assertIds(shipment.orderIds, `Shipment ${shipment.id} orders`);
    assertMoney(shipment.packingCost, `Shipment ${shipment.id} packing cost`);
    assertMoney(shipment.sellerCoveredShipping, `Shipment ${shipment.id} shipping cost`);
    shipmentIds.add(shipment.id);
    for (const orderId of shipment.orderIds) {
      if (!orderIds.has(orderId)) throw new Error(`Shipment ${shipment.id} has unknown order: ${orderId}`);
      if (shippedOrders.has(orderId)) throw new Error(`Seller order ${orderId} belongs to more than one shipment`);
      shippedOrders.add(orderId);
      const order = orders.find((candidate) => candidate.id === orderId)!;
      if (order.shipmentId !== shipment.id) throw new Error(`Order ${orderId} is linked to shipment ${order.shipmentId}, not ${shipment.id}`);
    }
  }
  const missingOrders = run.spots.filter((spot) => spot.state.kind !== "actual" || !orderSlotIds.has(spot.id)).map((spot) => spot.id);
  const missingShipments = orders.filter((order) => !shippedOrders.has(order.id)).map((order) => order.id);
  if (missingOrders.length || missingShipments.length) return { kind: "incomplete", missingOrders, missingShipments };
  return {
    kind: "reconciled",
    orderCount: orders.length,
    shipmentCount: shipments.length,
    hammer: orders.reduce((sum, order) => sum + order.paidAmount, 0),
    packingAndShipping: shipments.reduce((sum, shipment) => sum + shipment.packingCost + shipment.sellerCoveredShipping, 0),
  };
}

/**
 * Settles actual revenue at the order level.  In particular, the marketplace
 * flat processing fee is applied once for each recorded order, never once for
 * each slot inside a multi-slot order.
 */
export function actualSellerLedgerProfit(
  run: SellerOperationalRun,
  orders: readonly SellerOrderRecord[],
  shipments: readonly SellerShipmentRecord[],
  acquisitionAndOtherCosts: number,
  marketplace: MarketplacePreset,
): SellerLedgerProfit {
  assertMoney(acquisitionAndOtherCosts, "Acquisition and other costs");
  const reconciliation = reconcileSellerLedger(run, orders, shipments);
  if (reconciliation.kind === "incomplete") return { kind: "hidden", reconciliation };
  const net = orders.reduce((sum, order) => sum + transactionNet({
    slot: order.id as import("./types").SlotId, hammer: order.paidAmount, buyerShipping: 0, buyerTax: 0,
  }, marketplace), 0);
  const fees = reconciliation.hammer - net;
  return {
    kind: "actual",
    hammer: reconciliation.hammer,
    fees,
    shipmentCosts: reconciliation.packingAndShipping,
    profit: net - reconciliation.packingAndShipping - acquisitionAndOtherCosts,
  };
}

export type RealizedProfit =
  | { kind: "hidden"; reason: "spots-incomplete" | "costs-incomplete" }
  | { kind: "actual"; amount: number };

/** Actual net is intentionally withheld until the whole run and ledger reconcile. */
export function realizedSellerProfit(
  run: SellerOperationalRun,
  basis: ProductBasis,
  costs: readonly CostLine[],
): RealizedProfit {
  if (run.spots.some((spot) => spot.state.kind !== "actual")) {
    return { kind: "hidden", reason: "spots-incomplete" };
  }
  const revenue = run.spots.reduce((total, spot) =>
    total + (spot.state.kind === "actual" ? spot.state.actualRevenue : 0), 0);
  const result = actualNetProfit({ kind: "actual-hammer", amount: revenue }, basis, costs);
  return result.label === "Actual net profit"
    ? { kind: "actual", amount: result.amount }
    : { kind: "hidden", reason: "costs-incomplete" };
}
