import type { Finish } from "./types";

/**
 * Scarcity-defined collectibles do not describe a repeatable buyer outcome.
 * Keep their pull mass in the collation model, but assign them no decision
 * value so a one-of-one or serialized sale cannot dominate EV or range charts.
 */
export function isCollectorOutlierFinish(finish: Finish): boolean {
  return finish === "serialized" || finish === "double-rainbow";
}

