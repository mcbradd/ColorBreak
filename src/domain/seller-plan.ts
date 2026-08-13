export interface SellerCostLeaves {
  acquisition: number;
  packingAndCoveredShipping: number;
  labor: number;
  tax: number;
  giveaways: number;
  refundReserve: number;
  overhead: number;
}

export function completeCost(costs: SellerCostLeaves): number {
  return Object.values(costs).reduce((sum, cost) => {
    if (!Number.isFinite(cost) || cost < 0) {
      throw new Error("Seller cost leaves must be finite and non-negative");
    }
    return sum + cost;
  }, 0);
}

export type SellerPlanStatus =
  | { kind: "run"; headroom: number }
  | { kind: "change"; headroom: number }
  | { kind: "do-not-run"; headroom: number };

export function sellerPlanStatus(
  modeledBuyerValue: number,
  breakEvenRevenue: number,
  targetRevenue: number,
): SellerPlanStatus {
  const headroom = modeledBuyerValue - targetRevenue;
  if (modeledBuyerValue >= targetRevenue) return { kind: "run", headroom };
  if (modeledBuyerValue >= breakEvenRevenue) return { kind: "change", headroom };
  return { kind: "do-not-run", headroom };
}
