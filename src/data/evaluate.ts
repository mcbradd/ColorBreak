import type { BreakLine, CardPrice, ExpectedDraw, Omission, ValuationResult } from "../domain/types";
import type { PackOutcomeModel } from "../domain/simulation";
import { calculateBreak } from "../domain/valuation";
import { outcomeModelForProduct } from "./outcome-model";
import { expectedDraws, loadSealed } from "./sealed";
import type { SealedDocument } from "./sealed";
import { loadPrices } from "./scryfall";
import type { PriceAvailability } from "./scryfall";
import { pullRateOmissions } from "../domain/pull-rate-confidence";

function genericPackDraws(set: string, cards: CardPrice[], packs: number): ExpectedDraw[] {
  const byRarity = new Map<string, CardPrice[]>();
  for (const card of cards) {
    const rarity = card.rarity ?? "common";
    byRarity.set(rarity, [...(byRarity.get(rarity) ?? []), card]);
  }
  const draws: ExpectedDraw[] = [];
  const add = (rarity: string, copies: number) => {
    const pool = byRarity.get(rarity) ?? [];
    if (!pool.length) return;
    for (const card of pool) draws.push({
      set,
      collectorNumber: card.collectorNumber,
      copies: copies / pool.length,
      pullProbability: 1 - Math.pow(1 - 1 / pool.length, copies),
      foil: false,
      source: "estimated-pack",
    });
  };
  add("common", 10 * packs);
  add("uncommon", 3 * packs);
  add("rare", .875 * packs);
  add("mythic", .125 * packs);
  return draws;
}

export interface BreakAnalysis {
  valuation: ValuationResult;
  outcomeModel: PackOutcomeModel;
  outcomeOmissions: Omission[];
  priceAvailability: PriceAvailability;
}

export async function evaluateBreakAnalysis(lines: BreakLine[], threshold: number): Promise<BreakAnalysis> {
  const allSets = new Set(lines.map((line) => line.set));
  const lineResults = await Promise.all(lines.map(async (line) => {
    if (line.productKey.startsWith("sealed:")) {
      const document = await loadSealed(line.set);
      if (!document) return {
        draws: [] as ExpectedDraw[],
        omissions: [{ code: "missing-sealed", message: `${line.set} has no exact sealed record.`, material: true }] as Omission[],
        status: "incomplete" as const,
        document: null as SealedDocument | null,
        productKey: line.productKey.slice(7),
      };
      const result = await expectedDraws(document, line.productKey.slice(7), line.quantity);
      result.draws.forEach((draw) => allSets.add(draw.set));
      return { ...result, document, productKey: line.productKey.slice(7) };
    }
    return {
      draws: [] as ExpectedDraw[], omissions: [] as Omission[], status: "estimated" as const,
      document: null as SealedDocument | null, productKey: line.productKey,
    };
  }));
  const exactDraws = lineResults.flatMap((result) => result.draws);
  const priceResult = await loadPrices({
    sets: allSets,
    printings: exactDraws.map((draw) => ({ set: draw.set, collectorNumber: draw.collectorNumber })),
    fullSets: lineResults.flatMap((result, index) => result.draws.length ? [] : [lines[index].set]),
  });
  const prices = priceResult.cards;
  const draws = lineResults.flatMap((result, index) => {
    if (result.draws.length) return result.draws;
    const line = lines[index];
    const setCards = prices.filter((card) => card.set === line.set);
    return genericPackDraws(line.set, setCards, (line.packCount ?? 1) * line.quantity);
  });
  const rateOmissions = pullRateOmissions(draws, prices);
  const valuation = calculateBreak({
    draws,
    prices,
    threshold,
    sourceStatus: lineResults.some((result) => result.status === "incomplete") ? "incomplete"
      : lineResults.some((result) => result.status === "estimated") ? "estimated" : "verified",
    omissions: [...lineResults.flatMap((result) => result.omissions), ...priceResult.omissions, ...rateOmissions],
    pricedAt: prices.map((card) => card.priceObservedAt).filter((value): value is string => Boolean(value)).sort()[0],
    dataVersion: `${lines.map((line) => `${line.set}:${line.productKey}:${line.quantity}`).join("|")}@${prices.map((card) => card.priceObservedAt).filter(Boolean).sort()[0] ?? "unpriced"}`,
  });
  const outcomeResults = await Promise.all(lineResults.map((result, index) => {
    if (!result.document) {
      const omission: Omission = {
        code: "estimated-product-outcomes",
        message: `${lines[index].productLabel} has no generative sealed-product model.`,
        material: true,
      };
      return { model: { fixed: [], packs: [], complete: false } as PackOutcomeModel, omissions: [omission] };
    }
    return outcomeModelForProduct(result.document, result.productKey, lines[index].quantity, prices, threshold);
  }));
  const outcomeOmissions = outcomeResults.flatMap((result) => result.omissions);
  const outcomeModel: PackOutcomeModel = {
    cacheKey: `${valuation.dataVersion}|${threshold}|${lines.map((line) => `${line.set}:${line.productKey}:${line.quantity}`).join("|")}`,
    fixed: outcomeResults.flatMap((result) => result.model.fixed),
    packs: outcomeResults.flatMap((result) => result.model.packs),
    complete: outcomeResults.every((result) => result.model.complete !== false),
  };
  return { valuation, outcomeModel, outcomeOmissions, priceAvailability: priceResult.availability };
}

export async function evaluateBreak(lines: BreakLine[], threshold: number): Promise<ValuationResult> {
  return (await evaluateBreakAnalysis(lines, threshold)).valuation;
}
