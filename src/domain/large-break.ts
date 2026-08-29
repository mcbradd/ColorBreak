import type { Contributor, ValuationResult } from "./types";

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

/** The 17 catch-all listings used by the observed live character-break format. */
export const CATCH_ALL_SPOTS = [
  { key: "ancient-elder-dragon", label: "Ancient Elder Dragon" },
  { key: "unlisted-white-creature", label: "White Creature (All Unlisted)" },
  { key: "unlisted-blue-creature", label: "Blue Creature (All Unlisted)" },
  { key: "unlisted-black-creature", label: "Black Creature (All Unlisted)" },
  { key: "unlisted-red-creature", label: "Red Creature (All Unlisted)" },
  { key: "unlisted-green-creature", label: "Green Creature (All Unlisted)" },
  { key: "unlisted-multicolor-creature", label: "Multicolor Creature (All Unlisted)" },
  { key: "unlisted-colorless-creature", label: "Colorless Creature (All Unlisted)" },
  { key: "equipment", label: "Equipment (All Unlisted)" },
  { key: "vehicle", label: "Vehicle" },
  { key: "legendary-land", label: "Legendary Land" },
  { key: "land", label: "Land (Excluding Legendary)" },
  { key: "enchantment", label: "Enchantment (Excluding Creature)" },
  { key: "instant", label: "Instant" },
  { key: "sorcery", label: "Sorcery" },
  { key: "planeswalker-other", label: "Planeswalker & Other Cards" },
  { key: "artifact", label: "Artifact (Excluding Creature, Vehicle, Land & Equipment)" },
] as const;

export function sortNamedCards<T extends Pick<NamedSpot, "name" | "marketPrice" | "pullEV"> & { pullRateVerified?: boolean }>(cards: T[], sort: TopCardSort): T[] {
  return cards.filter((card) => sort !== "expected-value" || card.pullRateVerified !== false).sort((left, right) => sort === "expected-value"
    ? right.pullEV - left.pullEV || right.marketPrice - left.marketPrice || left.name.localeCompare(right.name)
    : right.marketPrice - left.marketPrice || right.pullEV - left.pullEV || left.name.localeCompare(right.name));
}

const normalizedName = (name: string) => name.trim().toLocaleLowerCase();

function isCharacterCard(row: Contributor): boolean {
  const type = row.card.typeLine ?? "";
  return /\bPlaneswalker\b/i.test(type) || (/\bLegendary\b/i.test(type) && /\bCreature\b/i.test(type));
}

function explicitCharacterName(row: Contributor): string | undefined {
  if (!isCharacterCard(row)) return undefined;
  const name = row.card.name.trim();
  for (const faceName of name.split(/\s*\/\/\s*/)) {
    const comma = faceName.indexOf(",");
    if (comma > 0) return faceName.slice(0, comma).trim();
  }
  const planeswalkerSubtype = (row.card.typeLine ?? "").match(/\bPlaneswalker\s+[—-]\s+(.+)$/i)?.[1]?.trim();
  if (planeswalkerSubtype) return planeswalkerSubtype;
  if (!/\s/.test(name)) return name;
  return undefined;
}

function createCardSlotIdentity(rows: Contributor[]): (row: Contributor) => { key: string; name: string } {
  const characters = new Map<string, string>();
  for (const row of rows) {
    const character = explicitCharacterName(row);
    if (character) characters.set(normalizedName(character), character);
  }
  const characterKeys = [...characters.keys()].sort((left, right) => right.length - left.length);
  return (row) => {
    const exactKey = normalizedName(row.card.name);
    if (isCharacterCard(row)) {
      const explicitCharacter = explicitCharacterName(row);
      if (explicitCharacter) {
        const characterKey = normalizedName(explicitCharacter);
        return { key: `character:${characterKey}`, name: characters.get(characterKey) ?? explicitCharacter };
      }
      const characterKey = characterKeys.find((candidate) => exactKey === candidate
        || exactKey.startsWith(`${candidate},`)
        || exactKey.startsWith(`${candidate} `));
      if (characterKey) return { key: `character:${characterKey}`, name: characters.get(characterKey)! };
    }
    return { key: `card:${exactKey}`, name: row.card.name.trim() };
  };
}

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
  if (/\bPlaneswalker\b/i.test(type)) return { key: "planeswalker-other", label: "Planeswalker & Other Cards" };
  if (/\bArtifact\b/i.test(type)) return { key: "artifact", label: "Artifact (Excluding Creature, Vehicle, Land & Equipment)" };
  return { key: "planeswalker-other", label: "Planeswalker & Other Cards" };
}

export function createLargeBreakPlan(result: ValuationResult, spotCount: number): LargeBreakPlan {
  const safeSpots = Math.max(1, Math.round(spotCount));
  const contributors = result.slots.flatMap((slot) => slot.contributors);
  const priceCandidates = [...contributors, ...(result.priceOnlyContributors ?? [])];
  const cardSlotIdentity = createCardSlotIdentity(priceCandidates);
  const byCard = new Map<string, NamedSpot>();
  for (const row of priceCandidates) {
    const identity = cardSlotIdentity(row);
    const key = identity.key;
    const existing = byCard.get(key);
    const marketPrice = row.marketPrice ?? (row.finish === "foil" ? row.card.foil : row.card.nonfoil) ?? 0;
    if (existing) {
      existing.pullEV += row.sellableValue;
      existing.pullRateVerified = existing.pullRateVerified && row.pullRateVerified !== false;
      if (marketPrice > existing.marketPrice) {
        existing.marketPrice = marketPrice;
        existing.set = row.card.set;
        existing.image = row.card.image;
        existing.row = row;
      }
    } else {
      byCard.set(key, { key, name: identity.name, set: row.card.set, image: row.card.image, marketPrice, pullEV: row.sellableValue, pullRateVerified: row.pullRateVerified !== false, row });
    }
  }
  const rankedCards = [...byCard.values()]
    .sort((left, right) => right.marketPrice - left.marketPrice || right.pullEV - left.pullEV || left.name.localeCompare(right.name));
  const categoryCount = Math.min(safeSpots, CATCH_ALL_SPOTS.length);
  const namedTarget = Math.max(0, safeSpots - categoryCount);
  const namedCards = rankedCards.slice(0, namedTarget);
  const namedKeys = new Set(namedCards.map((card) => card.key));
  const grouped = new Map<string, { key: string; label: string; pullEV: number; cards: Set<string> }>(
    CATCH_ALL_SPOTS.map((category) => [category.key, { ...category, pullEV: 0, cards: new Set<string>() }]),
  );
  for (const row of contributors) {
    const identity = cardSlotIdentity(row);
    if (namedKeys.has(identity.key)) continue;
    const category = categoryFor(row);
    const group = grouped.get(category.key);
    if (!group) continue;
    group.pullEV += row.sellableValue;
    group.cards.add(identity.key);
  }
  const categoryRows = CATCH_ALL_SPOTS.map((category) => grouped.get(category.key)!);
  const categories = categoryRows.slice(0, categoryCount).map((row) => ({
    key: row.key,
    label: row.label,
    pullEV: row.pullEV,
    cardCount: row.cards.size,
  }));
  return { spotCount: safeSpots, namedTarget, namedCards, categories, totalPullEV: result.sellableEV };
}
