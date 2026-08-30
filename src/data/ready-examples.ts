import type { BreakLine } from "../domain/types";
export const READY_EXAMPLES = [{ set: "SPM", productKey: "marvels-spider-man-play-booster-pack", productLabel: "Spider Man Play Booster Pack", quantity: 1, packCount: 1 }] as const;
export function readyExampleLine(): BreakLine { const example = READY_EXAMPLES[0]; return { id: "ready-bid-check", ...example, productKey: `sealed:${example.productKey}` }; }
