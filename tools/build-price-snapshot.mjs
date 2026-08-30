import { createHash } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import { createInterface } from "node:readline";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { createGunzip } from "node:zlib";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { addTcgListingFallbacks } from "./tcg-listing-prices.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SEALED_DIR = join(ROOT, "data", "sealed");
const OUTPUT_DIR = join(ROOT, "data", "prices");
const USER_AGENT = "ColorBreak/4.0 (+https://mcbradd.github.io/ColorBreak/)";
const CHECK_ONLY = process.argv.includes("--check");
const maxAgeIndex = process.argv.indexOf("--max-age-ms");
const MAX_AGE_MS = maxAgeIndex >= 0 ? Number(process.argv[maxAgeIndex + 1]) : undefined;
const TCGCSV_HEADERS = { Accept: "application/json", "User-Agent": USER_AGENT };

function stableJson(value) {
  return `${JSON.stringify(value)}\n`;
}

function sha256(value) {
  // The generator always emits LF. Accept Git's CRLF checkout conversion without
  // weakening the content check for the canonical snapshot representation.
  return createHash("sha256").update(value.replace(/\r\n/g, "\n")).digest("hex");
}

async function requiredPrintings() {
  const required = new Map();
  for (const file of await readdir(SEALED_DIR)) {
    if (!file.endsWith(".json") || file === "index.json") continue;
    const document = JSON.parse(await readFile(join(SEALED_DIR, file), "utf8"));
    const add = (set, collectorNumber, finish = "nonfoil") => {
      const code = String(set).toUpperCase();
      const number = String(collectorNumber);
      const key = `${code}|${number}`;
      const entry = required.get(key) ?? { set: code, collectorNumber: number, finishes: new Set() };
      entry.finishes.add(finish);
      required.set(key, entry);
    };
    for (const product of document.products ?? []) {
      for (const card of product.fixed ?? []) add(card.set, card.cn, card.finish ?? (card.foil ? "foil" : "nonfoil"));
    }
    for (const booster of Object.values(document.boosters ?? {})) {
      for (const sheet of Object.values(booster.sheets ?? {})) {
        const finish = sheet.finish ?? (sheet.foil ? "foil" : "nonfoil");
        for (const tuple of sheet.cards ?? []) {
          if (tuple.length === 3) add(tuple[0], tuple[1], finish);
          else add(document.set, tuple[0], finish);
        }
      }
    }
  }
  return required;
}

function compactCard(card) {
  const meldResultId = card.layout === "meld"
    ? card.all_parts?.find((part) => part.component === "meld_result")?.id
    : undefined;
  const faces = card.card_faces?.map((face) => ({
    ...(face.name ? { name: face.name } : {}),
    ...(face.type_line ? { type_line: face.type_line } : {}),
    ...(face.colors ? { colors: face.colors } : {}),
    ...(face.oracle_text ? { oracle_text: face.oracle_text } : {}),
    ...(face.image_uris?.normal ? { image_uris: { normal: face.image_uris.normal } } : {}),
  }));
  return {
    id: card.id,
    set: card.set,
    collector_number: card.collector_number,
    name: card.name,
    rarity: card.rarity,
    type_line: card.type_line,
    ...(card.colors ? { colors: card.colors } : {}),
    ...(faces?.length > 1 ? { card_faces: faces } : {}),
    ...(card.layout ? { layout: card.layout } : {}),
    ...(meldResultId ? { meld_result_id: meldResultId } : {}),
    prices: {
      usd: card.prices?.usd ?? null,
      usd_foil: card.prices?.usd_foil ?? null,
      usd_etched: card.prices?.usd_etched ?? null,
    },
    ...(card.image_uris?.normal ? { image_uris: { normal: card.image_uris.normal } } : {}),
    ...(card.oracle_text ? { oracle_text: card.oracle_text } : {}),
    ...(card.frame_effects?.length ? { frame_effects: card.frame_effects } : {}),
    ...(card.promo_types?.length ? { promo_types: card.promo_types } : {}),
    ...(card.finishes?.length ? { finishes: card.finishes } : {}),
    full_art: Boolean(card.full_art),
    textless: Boolean(card.textless),
    variation: Boolean(card.variation),
    ...(card.border_color ? { border_color: card.border_color } : {}),
    ...(card.frame ? { frame: card.frame } : {}),
    ...(card.lang ? { lang: card.lang } : {}),
    ...(card.variation_of ? { variation_of: card.variation_of } : {}),
    ...(card.flavor_name ? { flavor_name: card.flavor_name } : {}),
    ...(card.illustration_id ? { illustration_id: card.illustration_id } : {}),
    ...(card.security_stamp ? { security_stamp: card.security_stamp } : {}),
    ...(card.tcgplayer_id ? { tcgplayer_id: card.tcgplayer_id } : {}),
    ...(card.tcgplayer_etched_id ? { tcgplayer_etched_id: card.tcgplayer_etched_id } : {}),
  };
}

async function fetchJson(url, init = {}) {
  const response = await fetch(url, {
    ...init,
    headers: { Accept: "application/json;q=0.9,*/*;q=0.8", "User-Agent": USER_AGENT, ...init.headers },
  });
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return response.json();
}

async function downloadBulk(url, destination) {
  const response = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!response.ok || !response.body) throw new Error(`${url}: HTTP ${response.status}`);
  await pipeline(Readable.fromWeb(response.body), createWriteStream(destination));
}

const tcgFinish = (subtype) => ({ normal: "nonfoil", foil: "foil", etched: "etched", glossy: "glossy" }[String(subtype).toLowerCase()]);

async function enrichTcgPrices(cardsBySet, required) {
  const observedAt = new Date().toISOString();
  let groups;
  try {
    groups = (await fetchJson("https://tcgcsv.com/tcgplayer/1/groups", { headers: TCGCSV_HEADERS })).results ?? [];
  } catch (error) {
    console.warn(`TCGCSV card-price fallback unavailable: ${error instanceof Error ? error.message : error}`);
    groups = [];
  }
  const groupBySet = new Map(groups.map((group) => [String(group.abbreviation).toUpperCase(), group]));
  for (const [set, cards] of cardsBySet) {
    const group = groupBySet.get(set);
    const productIds = new Set(cards.flatMap((card) => [card.tcgplayer_id, card.tcgplayer_etched_id]).filter(Boolean));
    if (!group || !productIds.size) continue;
    try {
      const response = await fetch(`https://tcgcsv.com/tcgplayer/1/${group.groupId}/prices`, { headers: TCGCSV_HEADERS });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const records = (await response.json()).results ?? [];
      const byProduct = new Map();
      for (const record of records) {
        if (!productIds.has(record.productId)) continue;
        const finish = tcgFinish(record.subTypeName);
        if (!finish) continue;
        const prices = byProduct.get(record.productId) ?? {};
        prices[finish] = {
          market: typeof record.marketPrice === "number" ? record.marketPrice : null,
          listed: typeof record.lowPrice === "number" ? record.lowPrice : null,
        };
        byProduct.set(record.productId, prices);
      }
      for (const card of cards) {
        const regular = byProduct.get(card.tcgplayer_id) ?? {};
        const etched = byProduct.get(card.tcgplayer_etched_id) ?? {};
        const prices = { ...regular, ...(etched.etched ? { etched: etched.etched } : {}) };
        if (Object.keys(prices).length) card.tcgplayer = { observedAt, prices };
      }
    } catch (error) {
      console.warn(`TCGCSV ${set} card-price fallback unavailable: ${error instanceof Error ? error.message : error}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  const cards = [...cardsBySet.values()].flat();
  const listingFallbacks = await addTcgListingFallbacks(cards, required, {
    observedAt,
    delayMs: 75,
    onError: (card, error) => console.warn(
      `TCG listing fallback unavailable for ${String(card.set).toUpperCase()} ${card.collector_number}: ${error instanceof Error ? error.message : error}`,
    ),
  });
  if (listingFallbacks) console.log(`Added ${listingFallbacks} listed TCG foil prices omitted by the market-price feeds.`);
}

async function validateSnapshot(required) {
  const indexPath = join(OUTPUT_DIR, "index.json");
  const index = JSON.parse(await readFile(indexPath, "utf8"));
  if (index.schemaVersion !== 1 || index.provider !== "Scryfall") throw new Error("Unsupported price snapshot index.");
  const found = new Set();
  for (const [set, entry] of Object.entries(index.sets ?? {})) {
    const filePath = join(OUTPUT_DIR, entry.file);
    const raw = await readFile(filePath, "utf8");
    if (sha256(raw) !== entry.sha256) throw new Error(`${entry.file}: checksum mismatch.`);
    const shard = JSON.parse(raw);
    if (shard.set !== set || shard.observedAt !== index.observedAt) throw new Error(`${entry.file}: provenance mismatch.`);
    for (const card of shard.cards ?? []) found.add(`${set}|${card.collector_number}`);
  }
  const missing = [...required.keys()].filter((key) => !found.has(key));
  if (missing.length || index.missing?.length) {
    throw new Error(`Price snapshot misses ${missing.length || index.missing.length} required printings: ${(missing.length ? missing : index.missing).slice(0, 12).join(", ")}`);
  }
  if (found.size !== index.resolvedPrintings) throw new Error("Price snapshot printing count does not match its index.");
  if (MAX_AGE_MS != null) {
    if (!Number.isFinite(MAX_AGE_MS) || MAX_AGE_MS < 0) throw new Error("--max-age-ms must be a non-negative number.");
    const age = Date.now() - Date.parse(index.observedAt ?? "");
    if (!Number.isFinite(age) || age > MAX_AGE_MS) throw new Error(`Price snapshot is ${Number.isFinite(age) ? age : "an unknown number of"}ms old; decision freshness maximum is ${MAX_AGE_MS}ms.`);
  }
  console.log(`Price snapshot valid: ${found.size} exact printings across ${Object.keys(index.sets).length} sets; observed ${index.observedAt}.`);
}

async function buildSnapshot(required) {
  await mkdir(OUTPUT_DIR, { recursive: true });
  const bulk = await fetchJson("https://api.scryfall.com/bulk-data");
  const definition = bulk.data?.find((item) => item.type === "default_cards");
  const downloadUrl = definition?.jsonl_download_uri ?? definition?.download_uri;
  if (!downloadUrl) throw new Error("Scryfall did not publish a default-cards download URI.");

  const compressed = join(OUTPUT_DIR, ".default-cards.jsonl.gz");
  await downloadBulk(downloadUrl, compressed);
  const cardsBySet = new Map();
  const meldCardsById = new Map();
  const found = new Set();
  const input = createReadStream(compressed).pipe(createGunzip());
  const lines = createInterface({ input, crlfDelay: Infinity });
  for await (const line of lines) {
    if (!line.trim()) continue;
    const card = JSON.parse(line);
    const set = String(card.set ?? "").toUpperCase();
    const collectorNumber = String(card.collector_number ?? "");
    const key = `${set}|${collectorNumber}`;
    if (card.layout === "meld") meldCardsById.set(card.id, compactCard(card));
    if (!required.has(key)) continue;
    found.add(key);
    const rows = cardsBySet.get(set) ?? [];
    rows.push(compactCard(card));
    cardsBySet.set(set, rows);
  }
  await rm(compressed, { force: true });

  const asFace = (card) => ({
    name: card.name,
    type_line: card.type_line,
    ...(card.oracle_text ? { oracle_text: card.oracle_text } : {}),
    ...(card.image_uris?.normal ? { image_uris: { normal: card.image_uris.normal } } : {}),
  });
  for (const cards of cardsBySet.values()) {
    for (const card of cards) {
      const resultId = card.meld_result_id;
      if (!resultId || card.id === resultId) {
        delete card.meld_result_id;
        continue;
      }
      const result = meldCardsById.get(resultId);
      if (result) card.card_faces = [asFace(card), asFace(result)];
      delete card.meld_result_id;
    }
  }

  const generatedAt = new Date().toISOString();
  const observedAt = definition.updated_at;
  const missing = [...required.keys()].filter((key) => !found.has(key)).sort();
  if (missing.length) {
    throw new Error(`Scryfall default cards omit ${missing.length} required printings: ${missing.slice(0, 20).join(", ")}`);
  }

  await enrichTcgPrices(cardsBySet, required);

  const staging = join(OUTPUT_DIR, ".staging");
  await rm(staging, { recursive: true, force: true });
  await mkdir(staging, { recursive: true });
  const sets = {};
  const treatmentCatalog = { frameEffects: new Set(), promoTypes: new Set(), finishClasses: new Set() };
  for (const [set, cards] of [...cardsBySet].sort(([a], [b]) => a.localeCompare(b))) {
    for (const card of cards) {
      for (const value of card.frame_effects ?? []) treatmentCatalog.frameEffects.add(value);
      for (const value of card.promo_types ?? []) treatmentCatalog.promoTypes.add(value);
      for (const value of card.finishes ?? []) treatmentCatalog.finishClasses.add(value);
    }
    cards.sort((a, b) => a.collector_number.localeCompare(b.collector_number, undefined, { numeric: true }));
    const file = `${set}.json`;
    const raw = stableJson({ schemaVersion: 1, set, provider: "Scryfall", observedAt, generatedAt, cards });
    await writeFile(join(staging, file), raw);
    sets[set] = { file, cards: cards.length, sha256: sha256(raw) };
  }
  const index = {
    schemaVersion: 1,
    provider: "Scryfall",
    sourceType: definition.type,
    sourceUpdatedAt: definition.updated_at,
    observedAt,
    generatedAt,
    requiredPrintings: required.size,
    resolvedPrintings: found.size,
    missing,
    treatmentCatalog: {
      frameEffects: [...treatmentCatalog.frameEffects].sort(),
      promoTypes: [...treatmentCatalog.promoTypes].sort(),
      finishClasses: [...treatmentCatalog.finishClasses].sort(),
    },
    sets,
  };
  await writeFile(join(staging, "index.json"), stableJson(index));

  for (const file of await readdir(OUTPUT_DIR)) {
    if (file.endsWith(".json")) await rm(join(OUTPUT_DIR, file));
  }
  for (const file of await readdir(staging)) await rename(join(staging, file), join(OUTPUT_DIR, file));
  await rm(staging, { recursive: true, force: true });
  console.log(`Built price snapshot: ${found.size} exact printings across ${cardsBySet.size} sets; observed ${observedAt}.`);
}

const required = await requiredPrintings();
if (CHECK_ONLY) await validateSnapshot(required);
else await buildSnapshot(required);
