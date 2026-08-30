export type ManualBudgetRecommendation = "BID" | "STOP HERE" | "DO NOT BID";
export type ManualBudgetStatus = "under" | "at" | "over";

export type ManualBudgetResult = {
  /** All amounts are normalized once at this boundary and returned in dollars. */
  totalLandedCostCap: number;
  addedShipping: number;
  maximumHammer: number;
  currentHammer?: number;
  landedCost?: number;
  /** Positive is room under the total cap; negative is the all-in overage. */
  roomToCap?: number;
  roomUnderCap?: number;
  overage?: number;
  recommendation?: ManualBudgetRecommendation;
  status?: ManualBudgetStatus;
  /** Positive only when the current hammer exceeds the bid-only limit. */
  hammerAboveMaximum?: number;
};

const toCents = (amount: number) => Math.round(amount * 100);
const fromCents = (cents: number) => cents / 100;

/** Deliberately separate from valuation: this is only the buyer's own budget. */
export function manualBudgetCap(target?: number, shipping?: number, hammer?: number): ManualBudgetResult | undefined {
  if (!Number.isFinite(target) || !Number.isFinite(shipping) || target! < 0 || shipping! < 0) return undefined;

  const totalCapCents = toCents(target!);
  const shippingCents = toCents(shipping!);
  const maximumHammerCents = Math.max(0, totalCapCents - shippingCents);
  const result: ManualBudgetResult = {
    totalLandedCostCap: fromCents(totalCapCents),
    addedShipping: fromCents(shippingCents),
    maximumHammer: fromCents(maximumHammerCents),
  };

  // NumberField prevents negatives; direct callers get the same optional-hammer contract.
  if (!Number.isFinite(hammer) || hammer! < 0) return result;

  const hammerCents = toCents(hammer!);
  const landedCostCents = hammerCents + shippingCents;
  const roomToCapCents = totalCapCents - landedCostCents;
  const status: ManualBudgetStatus = roomToCapCents > 0 ? "under" : roomToCapCents === 0 ? "at" : "over";
  return {
    ...result,
    currentHammer: fromCents(hammerCents),
    landedCost: fromCents(landedCostCents),
    roomToCap: fromCents(roomToCapCents),
    roomUnderCap: roomToCapCents > 0 ? fromCents(roomToCapCents) : undefined,
    overage: roomToCapCents < 0 ? fromCents(-roomToCapCents) : undefined,
    status,
    recommendation: status === "under" ? "BID" : status === "at" ? "STOP HERE" : "DO NOT BID",
    hammerAboveMaximum: hammerCents > maximumHammerCents ? fromCents(hammerCents - maximumHammerCents) : undefined,
  };
}
