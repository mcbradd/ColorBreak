import type { CardPrice, Finish } from "./types";
import { hasUnverifiablePullRate } from "./pull-rate-confidence";

/** Identifies odds that need an explicit estimate note, without removing value. */
export function isCollectorOutlier(card: CardPrice, finish: Finish): boolean {
  return hasUnverifiablePullRate(card, finish);
}

