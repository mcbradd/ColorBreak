import type { CardPrice, SetChoice } from "../domain/types";
import { slotOfCard } from "../domain/valuation";

interface ScryfallList<T> { data: T[]; has_more?: boolean; next_page?: string }
interface ScryfallCard {
  id: string;
  set: string;
  collector_number: string;
  name: string;
  rarity: string;
  type_line: string;
  colors?: string[];
  card_faces?: Array<{ type_line?: string; colors?: string[]; oracle_text?: string; image_uris?: { normal?: string } }>;
  prices?: { usd?: string | null; usd_foil?: string | null; usd_etched?: string | null };
  image_uris?: { normal?: string };
  oracle_text?: string;
}
interface ScryfallSet { code: string; name: string; released_at: string; set_type: string; digital: boolean }

const cardCache = new Map<string, Promise<CardPrice[]>>();

async function fetchAll<T>(initialUrl: string): Promise<T[]> {
  const output: T[] = [];
  let url: string | undefined = initialUrl;
  while (url) {
    const response = await fetch(url, { headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error(`Scryfall: HTTP ${response.status}`);
    const page = await response.json() as ScryfallList<T>;
    output.push(...page.data);
    url = page.has_more ? page.next_page : undefined;
    if (url) await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return output;
}

export async function loadSets(): Promise<SetChoice[]> {
  const response = await fetch("https://api.scryfall.com/sets", { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`Scryfall sets: HTTP ${response.status}`);
  const result = await response.json() as ScryfallList<ScryfallSet>;
  return result.data.filter((set) => !set.digital).map((set) => ({
    code: set.code.toUpperCase(), name: set.name, released: set.released_at,
    type: set.set_type,
  }));
}

function toPrice(card: ScryfallCard, fetchedAt: string): CardPrice {
  const face = card.card_faces?.[0];
  const nonfoil = card.prices?.usd ? Number(card.prices.usd) : null;
  const foil = card.prices?.usd_foil ? Number(card.prices.usd_foil) : null;
  const etched = card.prices?.usd_etched ? Number(card.prices.usd_etched) : null;
  const quotes = [
    ["nonfoil", nonfoil], ["foil", foil], ["etched", etched],
  ].flatMap(([finish, amount]) => typeof amount === "number" ? [{
    provider: "Scryfall",
    currency: "USD" as const,
    finish: finish as "nonfoil" | "foil" | "etched",
    observedAt: fetchedAt,
    fetchedAt,
    amount,
    rightsStatus: "public-value-add" as const,
  }] : []);
  return {
    id: card.id,
    set: card.set.toUpperCase(),
    collectorNumber: card.collector_number,
    name: card.name,
    rarity: card.rarity,
    slot: slotOfCard({
      typeLine: card.type_line,
      colors: card.colors,
      frontFace: face ? { typeLine: face.type_line, colors: face.colors } : undefined,
    }),
    nonfoil,
    foil,
    prices: { nonfoil, foil, etched },
    quotes,
    priceObservedAt: fetchedAt,
    priceFetchedAt: fetchedAt,
    image: card.image_uris?.normal ?? face?.image_uris?.normal,
    oracleText: card.oracle_text ?? card.card_faces?.map((item) => item.oracle_text ?? "").join("\n—\n"),
  };
}

export function loadCardPrices(set: string): Promise<CardPrice[]> {
  const code = set.toLowerCase();
  if (!cardCache.has(code)) {
    const cacheKey = `colorbreak:prices:${code}`;
    cardCache.set(code, (async () => {
      try {
        const cached = JSON.parse(localStorage.getItem(cacheKey) ?? "null") as { saved: number; cards: CardPrice[] } | null;
        if (cached && Date.now() - cached.saved < 6 * 60 * 60 * 1000) {
          const savedAt = new Date(cached.saved).toISOString();
          return cached.cards.map((card) => ({
            ...card,
            priceObservedAt: card.priceObservedAt ?? savedAt,
            priceFetchedAt: card.priceFetchedAt ?? savedAt,
          }));
        }
      } catch { /* private mode or invalid cache */ }
      const fetchedAt = new Date().toISOString();
      const cards = (await fetchAll<ScryfallCard>(
        `https://api.scryfall.com/cards/search?unique=prints&order=set&q=${encodeURIComponent(`e:${code}`)}`,
      )).map((card) => toPrice(card, fetchedAt));
      try { localStorage.setItem(cacheKey, JSON.stringify({ saved: Date.now(), cards })); } catch { /* cache is optional */ }
      return cards;
    })());
  }
  return cardCache.get(code)!;
}

export function clearPriceCache(): void { cardCache.clear(); }
