import {
  actualNetProfit,
  type CostLine,
  type ProductBasis,
} from "./seller-economics";

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

function assertMoney(amount: number, subject: string) {
  if (!Number.isFinite(amount) || amount < 0) throw new Error(`${subject} must be a finite non-negative amount`);
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
