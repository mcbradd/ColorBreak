import type { BreakLine, SlotId } from "../../domain/types";

/**
 * A stable, versioned description of the facts a buyer has acknowledged.
 * This deliberately contains only calculation inputs and resolved output --
 * never a presentation string or the wall clock.
 */
export interface BuyerDecisionFingerprintInput {
  lines?: BreakLine[];
  selected: SlotId;
  assignmentMode: string;
  remaining: SlotId[];
  bid?: number;
  shipping?: number;
  risk: string;
  omissionIds: string[];
  valuationVersion?: string;
  priceSource?: string;
  observedAt?: string;
  distribution: unknown | "pending";
}

const normalize = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === "object") return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([, entry]) => entry !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, normalize(entry)]),
  );
  return value;
};

const normalizedLines = (lines: BreakLine[] = []) => lines.map((line) => ({
  set: line.set.toUpperCase(), productKey: line.productKey,
  quantity: line.quantity, packCount: line.packCount ?? 1,
})).sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));

export function decisionFingerprint(input: BuyerDecisionFingerprintInput): string {
  return JSON.stringify(normalize({
    v: 1,
    composition: normalizedLines(input.lines),
    selected: input.selected,
    assignmentMode: input.assignmentMode,
    remaining: [...input.remaining].sort(),
    bid: input.bid ?? null,
    shipping: input.shipping ?? null,
    risk: input.risk,
    omissionIds: [...input.omissionIds].sort(),
    valuationVersion: input.valuationVersion ?? null,
    priceSource: input.priceSource ?? null,
    observedAt: input.observedAt ?? null,
    distribution: input.distribution,
  }));
}
