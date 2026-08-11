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
  prices?: { usd?: string | null; usd_foil?: string | null };
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

function toPrice(card: ScryfallCard): CardPrice {
  const face = card.card_faces?.[0];
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
    nonfoil: card.prices?.usd ? Number(card.prices.usd) : null,
    foil: card.prices?.usd_foil ? Number(card.prices.usd_foil) : null,
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
        if (cached && Date.now() - cached.saved < 6 * 60 * 60 * 1000) return cached.cards;
      } catch { /* private mode or invalid cache */ }
      const cards = (await fetchAll<ScryfallCard>(
        `https://api.scryfall.com/cards/search?unique=prints&order=set&q=${encodeURIComponent(`e:${code}`)}`,
      )).map(toPrice);
      try { localStorage.setItem(cacheKey, JSON.stringify({ saved: Date.now(), cards })); } catch { /* cache is optional */ }
      return cards;
    })());
  }
  return cardCache.get(code)!;
}

export function clearPriceCache(): void { cardCache.clear(); }
