import { SLOT_NAMES } from "./types";
import type { Contributor, SlotId, ValuationResult } from "./types";

export interface NamedSpot {
  key: string;
  name: string;
  set: string;
  image?: string;
  marketPrice: number;
  pullEV: number;
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

const cardKey = (row: Contributor) => row.card.id || `${row.card.set}|${row.card.collectorNumber}`;

function categoryFor(row: Contributor): { key: string; label: string } {
  const type = row.card.typeLine ?? "";
  if (/\bCreature\b/i.test(type)) {
    return { key: `creature-${row.card.slot}`, label: `${SLOT_NAMES[row.card.slot]} creatures` };
  }
  const cardType = ["Planeswalker", "Battle", "Artifact", "Enchantment", "Instant", "Sorcery", "Land"]
    .find((candidate) => new RegExp(`\\b${candidate}\\b`, "i").test(type));
  const labels: Record<string, string> = { Planeswalker: "Planeswalkers", Battle: "Battles", Artifact: "Artifacts", Enchantment: "Enchantments", Instant: "Instants", Sorcery: "Sorceries", Land: "Lands" };
  const label = cardType ? labels[cardType] : row.card.slot === "L" ? "Lands" : "Other cards";
  return { key: (cardType ?? (row.card.slot === "L" ? "Land" : "Other")).toLowerCase(), label };
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

export function createLargeBreakPlan(result: ValuationResult, spotCount: number, namedShare = .75): LargeBreakPlan {
  const safeSpots = Math.max(1, Math.round(spotCount));
  const namedTarget = Math.min(safeSpots, Math.max(0, Math.round(safeSpots * namedShare)));
  const contributors = result.slots.flatMap((slot) => slot.contributors);
  const byCard = new Map<string, NamedSpot>();
  for (const row of contributors) {
    const key = cardKey(row);
    const existing = byCard.get(key);
    const marketPrice = row.marketPrice ?? (row.finish === "foil" ? row.card.foil : row.card.nonfoil) ?? 0;
    if (existing) {
      existing.pullEV += row.sellableValue;
      existing.marketPrice = Math.max(existing.marketPrice, marketPrice);
    } else {
      byCard.set(key, { key, name: row.card.name, set: row.card.set, image: row.card.image, marketPrice, pullEV: row.sellableValue });
    }
  }
  const namedCards = [...byCard.values()]
    .sort((left, right) => right.marketPrice - left.marketPrice || right.pullEV - left.pullEV || left.name.localeCompare(right.name))
    .slice(0, namedTarget);
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
