/**
 * Turns a modeled slot value into the highest hammer price a buyer can pay
 * without going past that value, once the costs the buyer actually pays are
 * removed.
 *
 * The buyer sets these once and never touches them again during an auction:
 * an auction gives about ten seconds to decide, which is not enough time to
 * type a bid into a form. Everything here is a cost the *buyer* pays on a
 * winning purchase. Seller-side commission is not modeled here.
 */
export interface BuyerCosts {
  /** Shipping this one purchase adds, in dollars. */
  shipping: number;
  /** Sales tax charged on hammer plus shipping, as a percentage. */
  taxPercent: number;
  /** Platform or payment fees charged on hammer plus shipping, as a percentage. */
  feePercent: number;
  /** Any flat per-purchase fee, in dollars. */
  fixedFee: number;
}

export const DEFAULT_BUYER_COSTS: BuyerCosts = {
  shipping: 0,
  taxPercent: 0,
  feePercent: 0,
  fixedFee: 0,
};

export type BidCeiling =
  | { kind: "ceiling"; hammer: number; landed: number }
  /** Costs alone already meet or exceed the modeled value: no hammer clears it. */
  | { kind: "no-room" };

/** Total a buyer pays for a given hammer price under these assumptions. */
export function landedCost(hammer: number, costs: BuyerCosts): number {
  const rate = Math.max(0, costs.taxPercent + costs.feePercent) / 100;
  return (hammer + Math.max(0, costs.shipping)) * (1 + rate) + Math.max(0, costs.fixedFee);
}

/**
 * Highest hammer price whose landed cost still fits inside `value`.
 * Rounded down to the cent so the ceiling is never one cent optimistic.
 */
export function bidCeiling(value: number, costs: BuyerCosts): BidCeiling {
  if (!Number.isFinite(value) || value <= 0) return { kind: "no-room" };
  const rate = Math.max(0, costs.taxPercent + costs.feePercent) / 100;
  const hammer = (value - Math.max(0, costs.fixedFee)) / (1 + rate) - Math.max(0, costs.shipping);
  const rounded = Math.floor(hammer * 100) / 100;
  if (!(rounded > 0)) return { kind: "no-room" };
  return { kind: "ceiling", hammer: rounded, landed: landedCost(rounded, costs) };
}

/** True when the buyer has entered anything beyond the zero defaults. */
export function hasBuyerCosts(costs: BuyerCosts): boolean {
  return costs.shipping > 0 || costs.taxPercent > 0 || costs.feePercent > 0 || costs.fixedFee > 0;
}
