import { useEffect, useState } from "react";
import { estimatedCards, resolveCosts, type CostOverrides } from "../../domain/cost-assumptions";
import type { BreakLine, ValuationResult } from "../../domain/types";
import { readCostOverrides, writeCostOverrides } from "../../persistence";

export function useBuyerCosts(lines: BreakLine[], result?: ValuationResult, spots = 8, owned = 0) {
  const [overrides, setOverrides] = useState(readCostOverrides);
  const [zone] = useState(() => Intl.DateTimeFormat().resolvedOptions().timeZone);
  useEffect(() => { writeCostOverrides(overrides); }, [overrides]);
  return { ...resolveCosts(overrides, estimatedCards(lines, result), spots, owned, zone),
    update: (patch: CostOverrides) => setOverrides((current) => ({ ...current, ...patch })) };
}
