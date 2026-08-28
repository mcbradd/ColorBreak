import type { CardPrice, Finish } from "./types";
import { hasUnverifiablePullRate } from "./pull-rate-confidence";

/**
 * A market price is not enough to value a pull when the exact per-card chance
 * is unpublished. Keep the pull mass in the collation model, but assign it no
 * decision value so an imported estimate cannot dominate EV or range charts.
 */
export function isCollectorOutlier(card: CardPrice, finish: Finish): boolean {
  return hasUnverifiablePullRate(card, finish);
}

