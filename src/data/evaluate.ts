import type { BreakLine, CardPrice, ExpectedDraw, Omission, ValuationResult } from "../domain/types";
import { calculateBreak } from "../domain/valuation";
import { expectedDraws, loadSealed } from "./sealed";
import { loadCardPrices } from "./scryfall";

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
    for (const card of pool) draws.push({ set, collectorNumber: card.collectorNumber, copies: copies / pool.length, foil: false, source: "estimated-pack" });
  };
  add("common", 10 * packs);
  add("uncommon", 3 * packs);
  add("rare", .875 * packs);
  add("mythic", .125 * packs);
  return draws;
}

export async function evaluateBreak(lines: BreakLine[], threshold: number): Promise<ValuationResult> {
  const allSets = new Set(lines.map((line) => line.set));
  const lineResults = await Promise.all(lines.map(async (line) => {
    if (line.productKey.startsWith("sealed:")) {
      const document = await loadSealed(line.set);
      if (!document) return {
        draws: [] as ExpectedDraw[],
        omissions: [{ code: "missing-sealed", message: `${line.set} has no exact sealed record.`, material: true }] as Omission[],
        status: "incomplete" as const,
      };
      const result = await expectedDraws(document, line.productKey.slice(7), line.quantity);
      result.draws.forEach((draw) => allSets.add(draw.set));
      return result;
    }
    return { draws: [] as ExpectedDraw[], omissions: [] as Omission[], status: "estimated" as const };
  }));
  const prices = (await Promise.all([...allSets].map(loadCardPrices))).flat();
  const draws = lineResults.flatMap((result, index) => {
    if (result.draws.length) return result.draws;
    const line = lines[index];
    const setCards = prices.filter((card) => card.set === line.set);
    return genericPackDraws(line.set, setCards, (line.packCount ?? 1) * line.quantity);
  });
  return calculateBreak({
    draws,
    prices,
    threshold,
    sourceStatus: lineResults.some((result) => result.status === "incomplete") ? "incomplete"
      : lineResults.some((result) => result.status === "estimated") ? "estimated" : "verified",
    omissions: lineResults.flatMap((result) => result.omissions),
  });
}
