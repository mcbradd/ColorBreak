import type { DistributionSummary } from "./simulation";

/** Possible extrema are deliberately absent from chart geometry. */
export function probableRange(summary?: DistributionSummary, fallback = 0, band: "98" | "80" = "98") {
  const low = (band === "98" ? summary?.p01 : summary?.p10) ?? fallback;
  const high = (band === "98" ? summary?.p99 : summary?.p90) ?? fallback;
  const bodyLow = Math.min(high, Math.max(low, summary?.p25 ?? fallback));
  const bodyHigh = Math.max(bodyLow, Math.min(high, summary?.p75 ?? fallback));
  return { low, high, bodyLow, bodyHigh };
}

export function chartPosition(value: number, scale: number): number {
  return Math.min(100, Math.max(0, value / Math.max(scale, .01) * 100));
}

export const CANDLE_EXPLANATION = "The whiskers show the middle 98% of modeled openings, excluding the most extreme 1% at each end. The body shows the middle half. MIN and MAX remain separate numbers and do not set the chart scale. Pack estimates and missing prices can change the range.";
