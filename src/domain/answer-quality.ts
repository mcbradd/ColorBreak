import type { Omission, ValuationResult } from "./types";

/** Evidence changes the explanation, never whether an estimate exists. */
export function answerFactors(valuation: ValuationResult, complete = true, pending = false, outcomeOmissions: Omission[] = []): string[] {
  const codes = valuation.omissions.filter((row) => row.material).map((row) => row.code);
  const factors: string[] = [];
  const namedGap = valuation.omissions.find(row => row.material && row.message.length <= 140 && !/uuid|sheet|weight|MTGJSON|collation/i.test(row.message));
  if (namedGap) factors.push(namedGap.message);
  const collation = outcomeOmissions.filter((row) => /^collation-/.test(row.code));
  if (collation.length) {
    factors.push("Some pack rules are estimated; actual factory collation can differ.");
  }
  if (pending) factors.push("Better data is loading. This is the best estimate available now.");
  if (codes.includes("pending-product")) factors.push("Products without loaded prices currently add $0 to the known total. This does not mean they are worthless.");
  if (codes.some((code) => /price|printing/.test(code))) factors.push("Some card prices are missing. Unpriced cards add $0, so the total may be low.");
  if (codes.some((code) => /pull-rate/.test(code))) factors.push("Some rare-card chances are estimated.");
  if (!complete || codes.some((code) => /sealed|sheet|contents|outcomes/.test(code))) factors.push("Missing pack details use a simpler estimate.");
  if (!Number.isFinite(Date.parse(valuation.pricedAt)) || Date.now() - Date.parse(valuation.pricedAt) > 6 * 60 * 60 * 1000) factors.push("Prices are older or their date is unknown. Today's selling prices may differ.");
  if (valuation.status === "estimated") factors.push("Some pull chances use simplified pack rules.");
  if (valuation.slots.some((slot) => slot.contributors.some((card) => card.priceBasis != null && card.priceBasis !== "exact-market"))) factors.push("Some card versions use the closest listed price for the same printing and foil type.");
  if (valuation.threshold > 0) factors.push(`Cards below $${valuation.threshold.toFixed(2)} are ignored by your bulk filter.`);
  return factors;
}
