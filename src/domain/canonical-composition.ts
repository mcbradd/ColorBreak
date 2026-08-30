import type { BreakLine } from "./types";

/**
 * The material, public description of a break.  IDs and labels deliberately
 * do not participate: they are UI/storage details and must not change a
 * decision or persistence boundary.
 */
export type CanonicalCompositionLine = Readonly<{
  set: string;
  productKey: string;
  quantity: number;
  packCount: number;
}>;

export function canonicalComposition(lines: readonly BreakLine[]): CanonicalCompositionLine[] {
  return lines
    .map((line) => ({
      set: line.set.trim().toUpperCase(),
      productKey: line.productKey.trim(),
      quantity: line.quantity,
      packCount: Math.max(1, line.packCount ?? 1),
    }))
    .sort((left, right) =>
      left.set.localeCompare(right.set)
      || left.productKey.localeCompare(right.productKey)
      || left.packCount - right.packCount
      || left.quantity - right.quantity,
    );
}

export function canonicalCompositionFingerprint(lines: readonly BreakLine[]): string {
  return JSON.stringify(canonicalComposition(lines));
}
