import type { BreakAnalysis } from "./evaluate";
import { calculateBreak, worstStatus } from "../domain/valuation";
import type { BreakLine, Contributor, DataStatus } from "../domain/types";

const cache = new Map<string, { quantity: number; analysis: BreakAnalysis }>();
const key = (line: BreakLine, threshold: number) => `${line.set}:${line.productKey}:${line.packCount ?? 1}:${threshold}`;

export function rememberAnswer(line: BreakLine, threshold: number, analysis: BreakAnalysis) {
  if (analysis.priceAvailability.status === "unavailable" && cache.has(key(line, threshold))) return;
  cache.set(key(line, threshold), { quantity: line.quantity, analysis });
  if (cache.size > 100) cache.delete(cache.keys().next().value!);
}

function scaledContributor(row: Contributor, scale: number): Contributor {
  return { ...row, copies: row.copies * scale, sellableCopies: row.sellableCopies * scale,
    foilCopies: row.foilCopies * scale, sellableFoilCopies: row.sellableFoilCopies * scale,
    marketValue: row.marketValue * scale, sellableValue: row.sellableValue * scale,
    pullProbability: 1 - (1 - row.pullProbability) ** scale,
    sellablePullProbability: 1 - (1 - row.sellablePullProbability) ** scale };
}

/** Reuse only matching products: a different mix must never inherit old values. */
export function bestAvailableAnalysis(lines: BreakLine[], threshold: number): BreakAnalysis {
  const entries = lines.map((line) => ({ line, cached: cache.get(key(line, threshold)) }));
  const valuation = calculateBreak({ draws: [], prices: [], threshold, sourceStatus: "incomplete", pricedAt: "", dataVersion: `preview:${lines.map((line) => `${key(line, threshold)}:${line.quantity}`).join("|")}` });
  valuation.omissions = entries.flatMap(({ line, cached }) => cached?.analysis.valuation.omissions ?? [{ code: "pending-product", message: `${line.productLabel}: card prices have not loaded yet. Only the known portion is counted.`, material: true }]);
  valuation.status = entries.reduce<DataStatus>((status, { cached }) => worstStatus(status, cached?.analysis.valuation.status ?? "incomplete"), "verified");
  valuation.pricedAt = entries.map(({ cached }) => cached?.analysis.valuation.pricedAt ?? "").sort()[0] ?? "";
  valuation.priceSource = [...new Set(entries.flatMap(({ cached }) => cached?.analysis.valuation.priceSource ? [cached.analysis.valuation.priceSource] : []))].join(", ") || undefined;
  valuation.statusReason = entries.every(({ cached }) => cached) ? "Uses matching product values with quantities updated while newer data loads." : "Some products have not loaded yet. Their unknown value is not included in the known subtotal.";

  for (const slot of valuation.slots) {
    const contributors = new Map<string, Contributor>();
    for (const { line, cached } of entries) {
      if (!cached) continue;
      const scale = line.quantity / cached.quantity;
      const source = cached.analysis.valuation.slots.find((row) => row.id === slot.id)!;
      slot.marketEV += source.marketEV * scale;
      slot.sellableEV += source.sellableEV * scale;
      slot.knownEV += source.knownEV * scale;
      for (const row of source.contributors) {
        const id = `${row.card.id}:${row.finish}`;
        const next = scaledContributor(row, scale), previous = contributors.get(id);
        if (previous) {
          next.marketValue += previous.marketValue; next.sellableValue += previous.sellableValue;
          next.copies += previous.copies; next.sellableCopies += previous.sellableCopies;
          next.foilCopies += previous.foilCopies; next.sellableFoilCopies += previous.sellableFoilCopies;
          next.pullProbability = 1 - (1 - next.pullProbability) * (1 - previous.pullProbability);
          next.sellablePullProbability = 1 - (1 - next.sellablePullProbability) * (1 - previous.sellablePullProbability);
        }
        contributors.set(id, next);
      }
    }
    slot.contributors = [...contributors.values()].sort((a, b) => b.sellableValue - a.sellableValue);
    const chase = slot.contributors[0]?.sellableValue ?? 0;
    slot.chaseShare = slot.sellableEV ? chase / slot.sellableEV : 0;
    slot.withoutChase = Math.max(0, slot.sellableEV - chase);
  }
  valuation.marketEV = valuation.slots.reduce((sum, slot) => sum + slot.marketEV, 0);
  valuation.sellableEV = valuation.slots.reduce((sum, slot) => sum + slot.sellableEV, 0);
  valuation.knownEV = valuation.slots.reduce((sum, slot) => sum + slot.knownEV, 0);
  valuation.priceOnlyContributors = entries.flatMap(({ line, cached }) => (cached?.analysis.valuation.priceOnlyContributors ?? []).map((row) => scaledContributor(row, line.quantity / cached!.quantity)));
  const complete = entries.every(({ cached }) => cached?.analysis.outcomeModel.complete === true);
  return { valuation,
    outcomeModel: {
      cacheKey: valuation.dataVersion, complete,
      fixed: entries.flatMap(({ line, cached }) => (cached?.analysis.outcomeModel.fixed ?? []).map((card) => ({ ...card, count: (card.count ?? 1) * line.quantity / cached!.quantity }))),
      packs: entries.flatMap(({ line, cached }) => (cached?.analysis.outcomeModel.packs ?? []).map((pack) => ({ ...pack, count: Math.round(pack.count * line.quantity / cached!.quantity) }))),
    },
    outcomeOmissions: entries.flatMap(({ cached }) => cached?.analysis.outcomeOmissions ?? []),
    priceAvailability: { status: "unavailable", source: "none", message: "Using the best currently loaded card prices." },
  };
}
