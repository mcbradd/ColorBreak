import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUTPUT = resolve(ROOT, "data", "sealed-prices.json");
const CHECK_ONLY = process.argv.includes("--check");
const MAX_AGE_MS = 36 * 60 * 60 * 1000;

async function fetchGroup(groupId) {
  const url = `https://tcgcsv.com/tcgplayer/1/${groupId}/prices`;
  const response = await fetch(url, { headers: { Accept: "application/json", "User-Agent": "ColorBreak/4.0" } });
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  const body = await response.json();
  return Array.isArray(body) ? body : body.results ?? [];
}

async function build() {
  const catalog = JSON.parse(await readFile(resolve(ROOT, "data", "products.json"), "utf8"));
  const entries = Object.entries(catalog.sets).filter(([, set]) => set.groupId);
  const prices = {};
  let cursor = 0;
  const workers = Array.from({ length: 6 }, async () => {
    while (cursor < entries.length) {
      const [code, set] = entries[cursor++];
      const wanted = new Set(set.products.map((product) => product.id).filter(Boolean));
      for (const row of await fetchGroup(set.groupId)) {
        if (!wanted.has(row.productId)) continue;
        const amount = row.marketPrice ?? row.lowPrice;
        if (!Number.isFinite(amount) || amount <= 0) continue;
        const key = `${code}:${row.productId}`;
        if (!prices[key] || row.subTypeName === "Normal") prices[key] = amount;
      }
    }
  });
  await Promise.all(workers);
  const snapshot = {
    schemaVersion: 1,
    provider: "TCGCSV",
    observedAt: new Date().toISOString(),
    prices,
  };
  await writeFile(OUTPUT, `${JSON.stringify(snapshot)}\n`);
  console.log(`Saved ${Object.keys(prices).length} sealed-product prices.`);
}

async function check() {
  const snapshot = JSON.parse(await readFile(OUTPUT, "utf8"));
  if (snapshot.schemaVersion !== 1 || snapshot.provider !== "TCGCSV") throw new Error("Invalid sealed-price snapshot.");
  if (Date.now() - Date.parse(snapshot.observedAt) > MAX_AGE_MS) throw new Error("Sealed-price snapshot is stale.");
  if (Object.keys(snapshot.prices ?? {}).length < 100) throw new Error("Sealed-price snapshot has insufficient coverage.");
  console.log(`Sealed-price snapshot valid: ${Object.keys(snapshot.prices).length} products; observed ${snapshot.observedAt}.`);
}

await (CHECK_ONLY ? check() : build());
