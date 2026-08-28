import type { CardPrice, Omission, SetChoice } from "../domain/types";
import { slotOfCard } from "../domain/valuation";

interface ScryfallList<T> { data: T[]; has_more?: boolean; next_page?: string; not_found?: unknown[] }
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
  tcgplayer_id?: number;
  tcgplayer_etched_id?: number;
  tcgplayer?: {
    observedAt?: string;
    prices?: Partial<Record<"nonfoil" | "foil" | "etched", { market?: number | null; listed?: number | null }>>;
  };
  image_uris?: { normal?: string };
  oracle_text?: string;
  frame_effects?: string[];
  promo_types?: string[];
  full_art?: boolean;
  textless?: boolean;
  variation?: boolean;
  border_color?: string;
}
interface ScryfallSet { code: string; name: string; released_at: string; set_type: string; digital: boolean }

interface PriceSnapshotIndex {
  schemaVersion: 1;
  provider: "Scryfall";
  observedAt: string;
  generatedAt: string;
  sets: Record<string, { file: string; cards: number; sha256: string }>;
}

interface PriceSnapshotShard {
  schemaVersion: 1;
  set: string;
  provider: "Scryfall";
  observedAt: string;
  generatedAt: string;
  cards: ScryfallCard[];
}

export interface PrintingRef { set: string; collectorNumber: string }
export interface PriceLoadRequest {
  sets: Iterable<string>;
  printings?: Iterable<PrintingRef>;
  /** Sets that need every printing for a generic estimated-pack fallback. */
  fullSets?: Iterable<string>;
}
export interface PriceAvailability {
  status: "available" | "stale" | "partial" | "unavailable";
  source: "snapshot" | "live" | "mixed" | "none";
  observedAt?: string;
  message: string;
}
export interface PriceLoadResult {
  cards: CardPrice[];
  availability: PriceAvailability;
  omissions: Omission[];
}

const SNAPSHOT_STALE_MS = 72 * 60 * 60 * 1000;
const LIVE_INTERVAL_MS = 140;
const liveSetCache = new Map<string, Promise<CardPrice[]>>();
const snapshotSetCache = new Map<string, Promise<CardPrice[] | null>>();
let snapshotIndexPromise: Promise<PriceSnapshotIndex | null> | null = null;
let requestTail: Promise<void> = Promise.resolve();
let lastRequestAt = 0;

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function scheduledFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const run = requestTail.then(async () => {
    const wait = Math.max(0, LIVE_INTERVAL_MS - (Date.now() - lastRequestAt));
    if (wait) await delay(wait);
    lastRequestAt = Date.now();
    return fetch(input, init);
  });
  requestTail = run.then(() => undefined, () => undefined);
  return run;
}

async function scryfallFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers);
  headers.set("Accept", "application/json;q=0.9,*/*;q=0.8");
  let response = await scheduledFetch(input, { ...init, headers });
  for (let attempt = 0; attempt < 2 && response.status >= 500; attempt += 1) {
    await delay(250 * 2 ** attempt);
    response = await scheduledFetch(input, { ...init, headers });
  }
  if (!response.ok) {
    const kind = response.status === 429 ? "rate limited" : `HTTP ${response.status}`;
    throw new Error(`Scryfall is ${kind}; the committed price snapshot remains the primary source.`);
  }
  return response;
}

async function fetchAll<T>(initialUrl: string): Promise<T[]> {
  const output: T[] = [];
  let url: string | undefined = initialUrl;
  while (url) {
    const response = await scryfallFetch(url);
    const page = await response.json() as ScryfallList<T>;
    output.push(...page.data);
    url = page.has_more ? page.next_page : undefined;
  }
  return output;
}

export async function loadSets(): Promise<SetChoice[]> {
  const response = await scryfallFetch("https://api.scryfall.com/sets");
  const result = await response.json() as ScryfallList<ScryfallSet>;
  return result.data.filter((set) => !set.digital).map((set) => ({
    code: set.code.toUpperCase(), name: set.name, released: set.released_at,
    type: set.set_type,
  }));
}

function toPrice(card: ScryfallCard, observedAt: string, fetchedAt = observedAt): CardPrice {
  const face = card.card_faces?.[0];
  const tcgPrices = card.tcgplayer?.prices;
  const scryfallPrices = {
    nonfoil: card.prices?.usd ? Number(card.prices.usd) : null,
    foil: card.prices?.usd_foil ? Number(card.prices.usd_foil) : null,
    etched: card.prices?.usd_etched ? Number(card.prices.usd_etched) : null,
  };
  const nonfoil = scryfallPrices.nonfoil ?? tcgPrices?.nonfoil?.market ?? null;
  const foil = scryfallPrices.foil ?? tcgPrices?.foil?.market ?? null;
  const etched = scryfallPrices.etched ?? tcgPrices?.etched?.market ?? null;
  const quotes = [
    ["nonfoil", nonfoil], ["foil", foil], ["etched", etched],
  ].flatMap(([finish, amount]) => typeof amount === "number" ? [{
    provider: scryfallPrices[finish as "nonfoil" | "foil" | "etched"] == null ? "TCGplayer via TCGCSV" : "Scryfall",
    currency: "USD" as const,
    finish: finish as "nonfoil" | "foil" | "etched",
    observedAt: scryfallPrices[finish as "nonfoil" | "foil" | "etched"] == null
      ? card.tcgplayer?.observedAt ?? observedAt
      : observedAt,
    fetchedAt,
    amount,
    rightsStatus: "public-value-add" as const,
  }] : []);
  return {
    id: card.id,
    set: card.set.toUpperCase(),
    collectorNumber: card.collector_number,
    name: card.name,
    treatment: printingTreatment(card),
    rarity: card.rarity,
    typeLine: face?.type_line ?? card.type_line,
    slot: slotOfCard({
      typeLine: card.type_line,
      colors: card.colors,
      frontFace: face ? { typeLine: face.type_line, colors: face.colors } : undefined,
    }),
    nonfoil,
    foil,
    prices: { nonfoil, foil, etched },
    listedPrices: {
      nonfoil: tcgPrices?.nonfoil?.listed ?? null,
      foil: tcgPrices?.foil?.listed ?? null,
      etched: tcgPrices?.etched?.listed ?? null,
    },
    quotes,
    priceObservedAt: card.tcgplayer?.observedAt && card.tcgplayer.observedAt > observedAt
      ? card.tcgplayer.observedAt
      : observedAt,
    priceFetchedAt: fetchedAt,
    image: card.image_uris?.normal ?? face?.image_uris?.normal,
    oracleText: card.oracle_text ?? card.card_faces?.map((item) => item.oracle_text ?? "").join("\n—\n"),
  };
}

function printingTreatment(card: ScryfallCard): string | undefined {
  const effects = new Set(card.frame_effects ?? []);
  if (effects.has("extendedart")) return "Extended Art";
  if (effects.has("showcase")) return "Showcase";
  if (card.textless) return "Textless";
  if (card.full_art) return "Full Art";
  if (effects.has("inverted")) return "Inverted";
  if (effects.has("colorshifted")) return "Colorshifted";
  if (card.border_color === "borderless" || card.promo_types?.includes("borderless")) return "Borderless";
  if (card.variation) return "Alternate Art";
  return undefined;
}

function loadSnapshotIndex(): Promise<PriceSnapshotIndex | null> {
  snapshotIndexPromise ??= fetch("data/prices/index.json")
    .then(async (response) => {
      if (!response.ok) return null;
      const index = await response.json() as PriceSnapshotIndex;
      return index.schemaVersion === 1 && index.provider === "Scryfall" ? index : null;
    })
    .catch(() => null);
  return snapshotIndexPromise;
}

function loadSnapshotSet(set: string, index: PriceSnapshotIndex): Promise<CardPrice[] | null> {
  const code = set.toUpperCase();
  if (!snapshotSetCache.has(code)) {
    const entry = index.sets[code];
    const promise = !entry ? Promise.resolve(null) : fetch(`data/prices/${entry.file}`)
      .then(async (response) => {
        if (!response.ok) return null;
        const shard = await response.json() as PriceSnapshotShard;
        if (shard.schemaVersion !== 1 || shard.set !== code || shard.observedAt !== index.observedAt) return null;
        return shard.cards.map((card) => toPrice(card, shard.observedAt, shard.generatedAt));
      })
      .catch(() => null);
    snapshotSetCache.set(code, promise);
  }
  return snapshotSetCache.get(code)!;
}

function loadLiveSet(set: string): Promise<CardPrice[]> {
  const code = set.toUpperCase();
  if (!liveSetCache.has(code)) {
    const promise = (async () => {
      const fetchedAt = new Date().toISOString();
      return (await fetchAll<ScryfallCard>(
        `https://api.scryfall.com/cards/search?unique=prints&order=set&q=${encodeURIComponent(`e:${code.toLowerCase()}`)}`,
      )).map((card) => toPrice(card, fetchedAt));
    })();
    liveSetCache.set(code, promise);
    void promise.catch(() => liveSetCache.delete(code));
  }
  return liveSetCache.get(code)!;
}

async function loadLivePrintings(printings: PrintingRef[]): Promise<CardPrice[]> {
  const cards: CardPrice[] = [];
  for (let offset = 0; offset < printings.length; offset += 75) {
    const batch = printings.slice(offset, offset + 75);
    const response = await scryfallFetch("https://api.scryfall.com/cards/collection", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifiers: batch.map((item) => ({
        set: item.set.toLowerCase(), collector_number: item.collectorNumber,
      })) }),
    });
    const fetchedAt = new Date().toISOString();
    const result = await response.json() as ScryfallList<ScryfallCard>;
    cards.push(...result.data.map((card) => toPrice(card, fetchedAt)));
  }
  return cards;
}

function uniqueCards(cards: CardPrice[]): CardPrice[] {
  return [...new Map(cards.map((card) => [`${card.set}|${card.collectorNumber}`, card])).values()];
}

export async function loadPrices(request: PriceLoadRequest): Promise<PriceLoadResult> {
  const sets = [...new Set([...request.sets].map((set) => set.toUpperCase()))];
  const fullSets = new Set([...(request.fullSets ?? [])].map((set) => set.toUpperCase()));
  const printings = [...new Map([...(request.printings ?? [])].map((item) => {
    const normalized = { set: item.set.toUpperCase(), collectorNumber: String(item.collectorNumber) };
    return [`${normalized.set}|${normalized.collectorNumber}`, normalized];
  })).values()];
  const requestedKeys = new Set(printings.map((item) => `${item.set}|${item.collectorNumber}`));
  const index = await loadSnapshotIndex();
  const snapshotResults = index
    ? await Promise.all(sets.map(async (set) => ({ set, cards: await loadSnapshotSet(set, index) })))
    : sets.map((set) => ({ set, cards: null as CardPrice[] | null }));
  const cards = snapshotResults.flatMap((result) => result.cards ?? []);
  const snapshotSets = new Set(snapshotResults.filter((result) => result.cards).map((result) => result.set));
  const foundKeys = new Set(cards.map((card) => `${card.set}|${card.collectorNumber}`));
  const missingPrintings = printings.filter((item) => !foundKeys.has(`${item.set}|${item.collectorNumber}`));
  const missingWholeSets = sets.filter((set) =>
    fullSets.has(set) || (!snapshotSets.has(set) && !printings.some((item) => item.set === set)));
  const failures: string[] = [];
  let liveCards: CardPrice[] = [];

  if (missingPrintings.length) {
    try { liveCards.push(...await loadLivePrintings(missingPrintings)); }
    catch (error) { failures.push(error instanceof Error ? error.message : String(error)); }
  }
  for (const set of missingWholeSets) {
    try { liveCards.push(...await loadLiveSet(set)); }
    catch (error) { failures.push(error instanceof Error ? error.message : String(error)); }
  }
  liveCards = uniqueCards(liveCards);
  const combined = uniqueCards([...cards, ...liveCards]);
  const resolvedKeys = new Set(combined.map((card) => `${card.set}|${card.collectorNumber}`));
  const unresolvedCount = [...requestedKeys].filter((key) => !resolvedKeys.has(key)).length;
  const omissions: Omission[] = failures.length || unresolvedCount ? [{
    code: "price-source-unavailable",
    message: failures[0] ?? `${unresolvedCount} exact printing prices are temporarily unavailable.`,
    expectedCards: unresolvedCount || undefined,
    material: true,
    source: "Scryfall availability",
  }] : [];
  const observedCandidates = combined.map((card) => card.priceObservedAt).filter((value): value is string => Boolean(value)).sort();
  const observedAt = observedCandidates[0];
  const usedSnapshot = snapshotSets.size > 0;
  const usedLive = liveCards.length > 0;
  const source = usedSnapshot && usedLive ? "mixed" : usedSnapshot ? "snapshot" : usedLive ? "live" : "none";
  const age = observedAt ? Date.now() - Date.parse(observedAt) : Number.POSITIVE_INFINITY;
  const status = omissions.length
    ? combined.length ? "partial" : "unavailable"
    : age > SNAPSHOT_STALE_MS ? "stale" : "available";
  const message = status === "available"
    ? `Exact-printing prices loaded from the ${source === "snapshot" ? "published snapshot" : source}.`
    : status === "stale"
      ? "Exact-printing prices are available, but the published snapshot is older than 72 hours."
      : status === "partial"
        ? "Some exact-printing prices could not be loaded; values are a lower bound."
        : "Exact-printing prices are temporarily unavailable; product contents remain intact.";
  return { cards: combined, availability: { status, source, observedAt, message }, omissions };
}

/** Compatibility adapter for callers that truly require a complete set. */
export async function loadCardPrices(set: string): Promise<CardPrice[]> {
  return (await loadPrices({ sets: [set] })).cards;
}

export function clearPriceCache(): void {
  liveSetCache.clear();
  snapshotSetCache.clear();
  snapshotIndexPromise = null;
  requestTail = Promise.resolve();
  lastRequestAt = 0;
}
