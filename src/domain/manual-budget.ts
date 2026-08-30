export type ManualBudgetResult = { maximumHammer: number; landedCost?: number; recommendation?: "BID" | "STOP HERE" | "PASS" };

/** Deliberately separate from valuation: this is only the buyer's own budget. */
export function manualBudgetCap(target?: number, shipping?: number, hammer?: number): ManualBudgetResult | undefined {
  if (!Number.isFinite(target) || !Number.isFinite(shipping) || (target ?? -1) < 0 || (shipping ?? -1) < 0) return undefined;
  const maximumHammer = Math.max(0, Math.round(((target as number) - (shipping as number)) * 100) / 100);
  if (!Number.isFinite(hammer) || (hammer ?? -1) < 0) return { maximumHammer };
  const landedCost = Math.round(((hammer as number) + (shipping as number)) * 100) / 100;
  return { maximumHammer, landedCost, recommendation: hammer! < maximumHammer ? "BID" : hammer === maximumHammer ? "STOP HERE" : "PASS" };
}
