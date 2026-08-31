export type ValueRule =
  | { kind: "median" }
  | { kind: "coverage"; coverage: number }
  | { kind: "average" };

export type CapResult =
  | { kind: "cap"; amount: number; allInAtCap: number }
  | { kind: "unknown-cost" }
  | { kind: "no-room" };

export interface CapInput {
  valueTarget: number;
  acceptedAmounts: readonly number[];
  addedCost?: (hammer: number) => number;
}

export function empiricalValueTarget(
  samples: readonly number[],
  rule: ValueRule,
): { value: number; coverage: number } {
  if (!samples.length) throw new Error("At least one modeled outcome is required");
  const sorted = [...samples].sort((left, right) => left - right);
  let value: number;
  if (rule.kind === "average") {
    value = sorted.reduce((sum, sample) => sum + sample, 0) / sorted.length;
  } else if (rule.kind === "median") {
    value = sorted[Math.ceil(sorted.length / 2) - 1];
  } else {
    if (!(rule.coverage > 0 && rule.coverage <= 1)) {
      throw new Error("Coverage must be greater than zero and at most one");
    }
    const index = sorted.length - Math.ceil(rule.coverage * sorted.length);
    value = sorted[index];
  }
  const coverage = sorted.filter((sample) => sample >= value).length / sorted.length;
  return { value, coverage };
}

export function solveFinancialCap(input: CapInput): CapResult {
  if (!input.addedCost) return { kind: "unknown-cost" };
  const domain = [...new Set(input.acceptedAmounts)]
    .filter((amount) => Number.isFinite(amount) && amount > 0)
    .sort((left, right) => left - right);
  if (!domain.length) return { kind: "no-room" };

  let amount: number | undefined;
  let allInAtCap: number | undefined;
  let previousAllIn = Number.NEGATIVE_INFINITY;
  for (const candidate of domain) {
    const cost = input.addedCost(candidate);
    const allIn = candidate + cost;
    if (!Number.isFinite(cost) || cost < 0 || allIn < previousAllIn) {
      throw new Error("Added cost must define a finite, non-negative, monotone schedule");
    }
    previousAllIn = allIn;
    if (allIn <= input.valueTarget) {
      amount = candidate;
      allInAtCap = allIn;
    }
  }
  return amount == null
    ? { kind: "no-room" }
    : { kind: "cap", amount, allInAtCap: allInAtCap! };
}

export type BidComparison =
  | { kind: "under"; difference: number }
  | { kind: "at"; difference: 0 }
  | { kind: "over"; difference: number };

export function compareNextBid(nextTotal: number, activeCeiling: number): BidComparison {
  const difference = Math.abs(activeCeiling - nextTotal);
  if (nextTotal < activeCeiling) return { kind: "under", difference };
  if (nextTotal > activeCeiling) return { kind: "over", difference };
  return { kind: "at", difference: 0 };
}

export type BidRecommendation =
  | { action: "enter-bid"; tone: "neutral" }
  | { action: "bid"; tone: "positive"; room: number }
  | { action: "stop"; tone: "warning"; room: 0 }
  | { action: "pass"; tone: "negative"; room: number }
  // A fully resolved verdict: the cap solver had complete data and determined
  // no positive hammer clears cost (e.g. shipping alone meets or exceeds the
  // modeled value). This is a computed fact, not missing data — keep it
  // distinct from `unknown-cost` so callers never render the two identically.
  | { action: "no-room"; tone: "negative" }
  // Genuinely missing inputs (no cost function, or an unresolved value
  // target/shipping upstream) — the ceiling cannot be computed at all.
  | { action: "unknown-cost"; tone: "neutral" };

export type ComparableBidRecommendation = Extract<BidRecommendation, { action: "bid" | "stop" | "pass" }>;

export function recommendBid(
  currentHammer: number,
  cap: Extract<CapResult, { kind: "cap" }>,
): ComparableBidRecommendation;

export function recommendBid(
  currentHammer: number | undefined,
  cap: CapResult,
): BidRecommendation;

export function recommendBid(
  currentHammer: number | undefined,
  cap: CapResult,
): BidRecommendation {
  if (cap.kind === "unknown-cost") return { action: "unknown-cost", tone: "neutral" };
  if (cap.kind === "no-room") return { action: "no-room", tone: "negative" };
  if (currentHammer == null) return { action: "enter-bid", tone: "neutral" };
  const room = cap.amount - currentHammer;
  if (room > 0) return { action: "bid", tone: "positive", room };
  if (room < 0) return { action: "pass", tone: "negative", room };
  return { action: "stop", tone: "warning", room: 0 };
}

export interface SavedCap {
  amount: number;
  revision: string;
}

export function updateActiveCeiling(
  saved: SavedCap,
  latest: CapResult,
  revision: string,
): { saved: SavedCap; active?: SavedCap } {
  return {
    saved,
    ...(latest.kind === "cap"
      ? { active: { amount: Math.min(saved.amount, latest.amount), revision } }
      : {}),
  };
}
