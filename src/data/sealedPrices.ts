import { loadCatalog } from "./catalog";

interface PriceRow { productId: number; marketPrice?: number | null; lowPrice?: number | null; subTypeName?: string }
const memory = new Map<string, Promise<Map<number, number>>>();
const PROXIES = [
  (url: string) => `https://api.codetabs.com/v1/proxy?quest=${url}`,
  (url: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  (url: string) => `https://proxy.cors.sh/${url}`,
];

async function relay(url: string, delay: number): Promise<PriceRow[]> {
  if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6500);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const body = await response.json() as { results?: PriceRow[] } | PriceRow[];
    const rows = Array.isArray(body) ? body : body.results;
    if (!rows) throw new Error("Invalid sealed price response");
    return rows;
  } finally { clearTimeout(timeout); }
}

async function priceMap(set: string): Promise<Map<number, number>> {
  const code = set.toUpperCase();
  const cacheKey = `colorbreak:sealed-prices:${code}`;
  try {
    const cached = JSON.parse(localStorage.getItem(cacheKey) ?? "null") as { saved: number; values: Array<[number,number]> } | null;
    if (cached && Date.now() - cached.saved < 6 * 60 * 60 * 1000) return new Map(cached.values);
  } catch { /* cache is optional */ }
  const catalog = await loadCatalog();
  const groupId = catalog.sets[code]?.groupId;
  if (!groupId) return new Map();
  const target = `https://tcgcsv.com/tcgplayer/1/${groupId}/prices`;
  const rows = await Promise.any(PROXIES.map((proxy, index) => relay(proxy(target), index * 250)));
  const output = new Map<number, number>();
  for (const row of rows) {
    const value = row.marketPrice ?? row.lowPrice;
    if (value == null) continue;
    if (!output.has(row.productId) || (row.subTypeName ?? "") === "Normal") output.set(row.productId, value);
  }
  try { localStorage.setItem(cacheKey, JSON.stringify({ saved: Date.now(), values: [...output] })); } catch { /* optional */ }
  return output;
}

export async function loadSealedMarketPrice(set: string, productId: number): Promise<number | undefined> {
  const code = set.toUpperCase();
  memory.set(code, memory.get(code) ?? priceMap(code));
  return (await memory.get(code)!).get(productId);
}
