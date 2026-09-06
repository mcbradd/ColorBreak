import type { PackOutcomeModel } from "./simulation";
import type { ValuationResult } from "./types";

/** Independent pooled draws preserve known EV without an expensive sheet per card. */
export function approximateOutcomes(valuation: ValuationResult): PackOutcomeModel {
  const rows = valuation.slots.flatMap((slot) => slot.contributors
    .filter((row) => row.sellableValue > 0 && row.marketPrice && row.sellableCopies > 0)
    .map((row) => ({ row, slot: slot.id })));
  const totalCopies = rows.reduce((sum, { row }) => sum + row.sellableCopies, 0);
  const attempts = Math.max(1, Math.ceil(totalCopies * 2));
  return {
    cacheKey: `approximate:${valuation.dataVersion}:${valuation.threshold}`,
    complete: false, fixed: [],
    packs: rows.length ? [{ count: attempts, variants: [{ weight: 1, picks: { estimated: 1 } }], sheets: {
      estimated: { totalWeight: 1, cards: [
        ...rows.map(({ row, slot }) => ({ id: `${row.card.id}:${row.finish}`, slot, value: row.marketPrice!, weight: row.sellableCopies / attempts })),
        { id: "no-hit", slot: "C", value: 0, weight: 1 - totalCopies / attempts },
      ] },
    } }] : [],
  };
}
