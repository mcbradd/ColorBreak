import { DECISION_FRESHNESS_MS } from "./valuation";
import type { DataStatus, Omission } from "./types";

/** The prospective counterpart to composed `decisionEligibility`.  It never
 * creates a value or makes a network request; it only explains whether a line
 * could participate in an actionable buyer decision from published evidence. */
export type DecisionReadiness = {
  eligibility: "ready" | "stale" | "incomplete" | "unavailable";
  contentsStatus: DataStatus;
  priceObservedAt?: string;
  priceAgeMs?: number;
  freshnessThresholdMs: number;
  materialBlockers: string[];
};

export function decisionReadiness(input: {
  contentsStatus: DataStatus;
  priceObservedAt?: string;
  materialOmissions?: Pick<Omission, "message" | "material">[];
  now?: number | Date;
  freshnessThresholdMs?: number;
}): DecisionReadiness {
  const freshnessThresholdMs = input.freshnessThresholdMs ?? DECISION_FRESHNESS_MS;
  const now = input.now instanceof Date ? input.now.getTime() : input.now ?? Date.now();
  const materialBlockers = (input.materialOmissions ?? []).filter((item) => item.material).map((item) => item.message);
  const observed = Date.parse(input.priceObservedAt ?? "");
  if (input.contentsStatus === "incomplete" || materialBlockers.length) return {
    eligibility: "incomplete", contentsStatus: input.contentsStatus, priceObservedAt: input.priceObservedAt,
    freshnessThresholdMs, materialBlockers,
  };
  if (!Number.isFinite(observed) || !Number.isFinite(now) || input.contentsStatus !== "verified") return {
    eligibility: "unavailable", contentsStatus: input.contentsStatus, priceObservedAt: input.priceObservedAt,
    freshnessThresholdMs, materialBlockers,
  };
  const priceAgeMs = Math.max(0, now - observed);
  return {
    eligibility: priceAgeMs <= freshnessThresholdMs ? "ready" : "stale",
    contentsStatus: input.contentsStatus, priceObservedAt: input.priceObservedAt, priceAgeMs,
    freshnessThresholdMs, materialBlockers,
  };
}
