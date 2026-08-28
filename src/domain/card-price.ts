import type { CardPrice, Finish } from "./types";

export type CardPriceBasis = "exact-market" | "same-printing-foil-market" | "listed-tcg";

export interface ResolvedCardPrice {
  amount: number;
  basis: CardPriceBasis;
}

function exactFinishPrice(card: CardPrice, finish: Finish): number | null {
  return card.prices?.[finish]
    ?? (finish === "foil" ? card.foil : finish === "nonfoil" ? card.nonfoil : null);
}

/**
 * Resolve a price without crossing printings or foil classes. New treatments are
 * commonly listed by TCGplayer under the printing's foil price before a
 * treatment-specific market observation exists, so that listing is the safe
 * fallback for premium finishes.
 */
export function resolveCardPrice(card: CardPrice, finish: Finish): ResolvedCardPrice | null {
  const exact = exactFinishPrice(card, finish);
  if (exact != null) return { amount: exact, basis: "exact-market" };

  const exactListing = card.listedPrices?.[finish];
  if (exactListing != null) return { amount: exactListing, basis: "listed-tcg" };

  if (finish !== "nonfoil" && finish !== "foil" && finish !== "serialized") {
    const samePrintingFoilMarket = card.prices?.foil ?? card.foil;
    if (samePrintingFoilMarket != null) return { amount: samePrintingFoilMarket, basis: "same-printing-foil-market" };
    const listedFoil = card.listedPrices?.foil;
    if (listedFoil != null) return { amount: listedFoil, basis: "listed-tcg" };
  }

  return null;
}
