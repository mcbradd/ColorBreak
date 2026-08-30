import type { SlotId } from "./types";

export interface ActualOrder {
  id: string;
  slotIds: SlotId[];
  receiptCents: number;
  feeCents: number;
  reference?: string;
  shipmentId?: string;
}

export interface ActualShipment {
  id: string;
  orderIds: string[];
  postageCents: number;
  packingCents: number;
  reference?: string;
}

export interface ActualLedger { version: 1; orders: ActualOrder[]; shipments: ActualShipment[]; }
export const emptyActualLedger = (): ActualLedger => ({ version: 1, orders: [], shipments: [] });

const validCents = (n: unknown) => typeof n === "number" && Number.isSafeInteger(n) && n >= 0;
const validIds = (ids: unknown, allowed?: Set<string>) => Array.isArray(ids) && ids.length > 0 && ids.every((id) => typeof id === "string" && (!allowed || allowed.has(id))) && new Set(ids).size === ids.length;

/** Validates money and relationships at the boundary; targets can never enter this ledger. */
export function validateActualLedger(value: unknown, allowedSlots: readonly SlotId[]): ActualLedger {
  if (!value || typeof value !== "object") throw new Error("Actual ledger is not an object");
  const ledger = value as Partial<ActualLedger>;
  if (ledger.version !== 1 || !Array.isArray(ledger.orders) || !Array.isArray(ledger.shipments)) throw new Error("Actual ledger version is invalid");
  const slots = new Set<string>(allowedSlots);
  const orderIds = new Set<string>(); const ownedSlots = new Set<string>();
  for (const order of ledger.orders) {
    if (!order || typeof order.id !== "string" || !order.id || orderIds.has(order.id) || !validIds(order.slotIds, slots) || !validCents(order.receiptCents) || !validCents(order.feeCents)) throw new Error("Actual order is invalid");
    orderIds.add(order.id);
    for (const slot of order.slotIds) { if (ownedSlots.has(slot)) throw new Error("A slot belongs to more than one order"); ownedSlots.add(slot); }
    if (order.shipmentId != null && (typeof order.shipmentId !== "string" || !order.shipmentId)) throw new Error("Order shipment is invalid");
  }
  const shipmentIds = new Set<string>(); const shippedOrders = new Set<string>();
  for (const shipment of ledger.shipments) {
    if (!shipment || typeof shipment.id !== "string" || !shipment.id || shipmentIds.has(shipment.id) || !validIds(shipment.orderIds, orderIds) || !validCents(shipment.postageCents) || !validCents(shipment.packingCents)) throw new Error("Actual shipment is invalid");
    shipmentIds.add(shipment.id);
    for (const orderId of shipment.orderIds) {
      if (shippedOrders.has(orderId)) throw new Error("An order belongs to more than one shipment");
      shippedOrders.add(orderId);
      if (ledger.orders.find((o) => o.id === orderId)?.shipmentId !== shipment.id) throw new Error("Order and shipment links disagree");
    }
  }
  return ledger as ActualLedger;
}

export function actualLedgerSummary(ledger: ActualLedger, saleableSlots: readonly SlotId[], costCents?: number) {
  const sold = new Set(ledger.orders.flatMap((order) => order.slotIds));
  const pending = saleableSlots.filter((slot) => !sold.has(slot));
  const missingReceipt = ledger.orders.filter((order) => !order.reference?.trim()).map((order) => order.id);
  const missingShipment = ledger.orders.filter((order) => !order.shipmentId || !ledger.shipments.some((shipment) => shipment.id === order.shipmentId)).map((order) => order.id);
  const incomplete = costCents == null || pending.length > 0 || missingReceipt.length > 0 || missingShipment.length > 0;
  const gross = ledger.orders.reduce((sum, order) => sum + order.receiptCents, 0);
  const fees = ledger.orders.reduce((sum, order) => sum + order.feeCents, 0);
  const fulfillment = ledger.shipments.reduce((sum, shipment) => sum + shipment.postageCents + shipment.packingCents, 0);
  return { sold: sold.size, pending, missingReceipt, missingShipment, gross, fees, fulfillment, incomplete,
    profitCents: incomplete ? undefined : gross - fees - fulfillment - costCents! };
}
