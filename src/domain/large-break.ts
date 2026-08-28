import type { Contributor, SlotId, ValuationResult } from "./types";

export interface NamedSpot {
  key: string;
  name: string;
  set: string;
  image?: string;
  marketPrice: number;
  pullEV: number;
  pullRateVerified: boolean;
  row: Contributor;
}

export interface CategorySpot {
  key: string;
  label: string;
  pullEV: number;
  spots: number;
  evPerSpot: number;
  cardCount: number;
}

export interface LargeBreakPlan {
  spotCount: number;
  namedTarget: number;
  namedCards: NamedSpot[];
  categories: CategorySpot[];
  totalPullEV: number;
}

export type TopCardSort = "price" | "expected-value";

/** Observed in a 100-spot live character break: 83 named spots and 17 catch-alls. */
export const DEFAULT_NAMED_SPOT_SHARE = 83 / 100;

export function sortNamedCards<T extends Pick<NamedSpot, "name" | "marketPrice" | "pullEV"> & { pullRateVerified?: boolean }>(cards: T[], sort: TopCardSort): T[] {
  return cards.filter((card) => sort !== "expected-value" || card.pullRateVerified !== false).sort((left, right) => sort === "expected-value"
    ? right.pullEV - left.pullEV || right.marketPrice - left.marketPrice || left.name.localeCompare(right.name)
    : right.marketPrice - left.marketPrice || right.pullEV - left.pullEV || left.name.localeCompare(right.name));
}

const cardKey = (row: Contributor) => `${row.card.id || `${row.card.set}|${row.card.collectorNumber}`}|${row.finish ?? "nonfoil"}`;

function categoryFor(row: Contributor): { key: string; label: string } {
  const type = row.card.typeLine ?? "";
  if (/\bCreature\b/i.test(type)) {
    if (/\bElder Dragon\b/i.test(type)) return { key: "ancient-elder-dragon", label: "Ancient Elder Dragon" };
    const colors = row.card.colors ?? (/[WUBRG]/.test(row.card.slot) ? [row.card.slot] : row.card.slot === "M" ? ["M"] : []);
    const color = colors.length > 1 || colors[0] === "M" ? "Multicolor" : ({ W: "White", U: "Blue", B: "Black", R: "Red", G: "Green" } as Record<string, string>)[colors[0]] ?? "Colorless";
    return { key: `unlisted-${color.toLowerCase()}-creature`, label: `${color} Creature (All Unlisted)` };
  }
  if (/\bEquipment\b/i.test(type)) return { key: "equipment", label: "Equipment (All Unlisted)" };
  if (/\bVehicle\b/i.test(type)) return { key: "vehicle", label: "Vehicle" };
  if (/\bLand\b/i.test(type)) return /\bLegendary\b/i.test(type)
    ? { key: "legendary-land", label: "Legendary Land" }
    : { key: "land", label: "Land (Excluding Legendary)" };
  if (/\bEnchantment\b/i.test(type)) return { key: "enchantment", label: "Enchantment (Excluding Creature)" };
  if (/\bInstant\b/i.test(type)) return { key: "instant", label: "Instant" };
  if (/\bSorcery\b/i.test(type)) return { key: "sorcery", label: "Sorcery" };
  if (/\bPlaneswalker\b/i.test(type)) return { key: "planeswalker", label: "Planeswalker" };
  if (/\bArtifact\b/i.test(type)) return { key: "artifact", label: "Artifact (Excluding Creature, Vehicle, Land & Equipment)" };
  return { key: "other", label: "Other cards" };
}

function allocateCategorySpots(values: number[], total: number): number[] {
  if (!values.length) return [];
  if (total <= values.length) return values.map((_, index) => index < total ? 1 : 0);
  const valueTotal = values.reduce((sum, value) => sum + value, 0);
  const remaining = total - values.length;
  const exact = values.map((value) => valueTotal ? value / valueTotal * remaining : remaining / values.length);
  const output = exact.map((value) => 1 + Math.floor(value));
  let unassigned = total - output.reduce((sum, value) => sum + value, 0);
  const order = exact.map((value, index) => ({ index, fraction: value - Math.floor(value) }))
    .sort((left, right) => right.fraction - left.fraction);
  for (let index = 0; index < unassigned; index += 1) output[order[index % order.length].index] += 1;
  return output;
}

export function createLargeBreakPlan(result: ValuationResult, spotCount: number, namedShare = DEFAULT_NAMED_SPOT_SHARE): LargeBreakPlan {
  const safeSpots = Math.max(1, Math.round(spotCount));
  const namedTarget = Math.min(safeSpots, Math.max(0, Math.round(safeSpots * namedShare)));
  const contributors = result.slots.flatMap((slot) => slot.contributors);
  const priceCandidates = [...contributors, ...(result.priceOnlyContributors ?? [])];
  const byCard = new Map<string, NamedSpot>();
  for (const row of priceCandidates) {
    const key = cardKey(row);
    const existing = byCard.get(key);
    const marketPrice = row.marketPrice ?? (row.finish === "foil" ? row.card.foil : row.card.nonfoil) ?? 0;
    if (existing) {
      existing.pullEV += row.sellableValue;
      existing.marketPrice = Math.max(existing.marketPrice, marketPrice);
    } else {
      byCard.set(key, { key, name: row.card.name, set: row.card.set, image: row.card.image, marketPrice, pullEV: row.sellableValue, pullRateVerified: row.pullRateVerified !== false, row });
    }
  }
  // Sparse or incomplete price snapshots can contain fewer valued cards than the
  // requested named-spot target. Keep the same share of that valued pool in the
  // residual categories instead of consuming every card as an individual spot.
  const availableNamedTarget = namedTarget > 0 && byCard.size > 0
    ? Math.max(1, Math.floor(byCard.size * namedShare))
    : 0;
  const namedCards = [...byCard.values()]
    .sort((left, right) => right.marketPrice - left.marketPrice || right.pullEV - left.pullEV || left.name.localeCompare(right.name))
    .slice(0, Math.min(namedTarget, availableNamedTarget));
  const namedKeys = new Set(namedCards.map((card) => card.key));
  const grouped = new Map<string, { key: string; label: string; pullEV: number; cards: Set<string> }>();
  for (const row of contributors) {
    if (namedKeys.has(cardKey(row))) continue;
    const category = categoryFor(row);
    const group = grouped.get(category.key) ?? { ...category, pullEV: 0, cards: new Set<string>() };
    group.pullEV += row.sellableValue;
    group.cards.add(cardKey(row));
    grouped.set(category.key, group);
  }
  const categoryRows = [...grouped.values()].filter((row) => row.pullEV > 0).sort((left, right) => right.pullEV - left.pullEV || left.label.localeCompare(right.label));
  const categorySpotTotal = Math.max(0, safeSpots - namedCards.length);
  const allocations = allocateCategorySpots(categoryRows.map((row) => row.pullEV), categorySpotTotal);
  const categories = categoryRows.map((row, index) => ({
    key: row.key,
    label: row.label,
    pullEV: row.pullEV,
    spots: allocations[index],
    evPerSpot: allocations[index] ? row.pullEV / allocations[index] : 0,
    cardCount: row.cards.size,
  })).filter((row) => row.spots > 0);
  return { spotCount: safeSpots, namedTarget, namedCards, categories, totalPullEV: result.sellableEV };
}
