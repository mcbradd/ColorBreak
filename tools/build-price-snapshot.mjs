import { createHash } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import { createInterface } from "node:readline";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { createGunzip } from "node:zlib";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SEALED_DIR = join(ROOT, "data", "sealed");
const OUTPUT_DIR = join(ROOT, "data", "prices");
const USER_AGENT = "ColorBreak/4.0 (+https://mcbradd.github.io/ColorBreak/)";
const CHECK_ONLY = process.argv.includes("--check");

function stableJson(value) {
  return `${JSON.stringify(value)}\n`;
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

async function requiredPrintings() {
  const required = new Map();
  for (const file of await readdir(SEALED_DIR)) {
    if (!file.endsWith(".json") || file === "index.json") continue;
    const document = JSON.parse(await readFile(join(SEALED_DIR, file), "utf8"));
    const add = (set, collectorNumber) => {
      const code = String(set).toUpperCase();
      const number = String(collectorNumber);
      required.set(`${code}|${number}`, { set: code, collectorNumber: number });
    };
    for (const product of document.products ?? []) {
      for (const card of product.fixed ?? []) add(card.set, card.cn);
    }
    for (const booster of Object.values(document.boosters ?? {})) {
      for (const sheet of Object.values(booster.sheets ?? {})) {
        for (const tuple of sheet.cards ?? []) {
          if (tuple.length === 3) add(tuple[0], tuple[1]);
          else add(document.set, tuple[0]);
        }
      }
    }
  }
  return required;
}

function compactCard(card) {
  const faces = card.card_faces?.map((face) => ({
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
    ...(faces?.length ? { card_faces: faces } : {}),
    prices: {
      usd: card.prices?.usd ?? null,
      usd_foil: card.prices?.usd_foil ?? null,
      usd_etched: card.prices?.usd_etched ?? null,
    },
    ...(card.image_uris?.normal ? { image_uris: { normal: card.image_uris.normal } } : {}),
    ...(card.oracle_text ? { oracle_text: card.oracle_text } : {}),
  };
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: { Accept: "application/json;q=0.9,*/*;q=0.8", "User-Agent": USER_AGENT },
  });
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return response.json();
}

async function downloadBulk(url, destination) {
  const response = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!response.ok || !response.body) throw new Error(`${url}: HTTP ${response.status}`);
  await pipeline(Readable.fromWeb(response.body), createWriteStream(destination));
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
  const found = new Set();
  const input = createReadStream(compressed).pipe(createGunzip());
  const lines = createInterface({ input, crlfDelay: Infinity });
  for await (const line of lines) {
    if (!line.trim()) continue;
    const card = JSON.parse(line);
    const set = String(card.set ?? "").toUpperCase();
    const collectorNumber = String(card.collector_number ?? "");
    const key = `${set}|${collectorNumber}`;
    if (!required.has(key)) continue;
    found.add(key);
    const rows = cardsBySet.get(set) ?? [];
    rows.push(compactCard(card));
    cardsBySet.set(set, rows);
  }
  await rm(compressed, { force: true });

  const generatedAt = new Date().toISOString();
  const observedAt = definition.updated_at;
  const missing = [...required.keys()].filter((key) => !found.has(key)).sort();
  if (missing.length) {
    throw new Error(`Scryfall default cards omit ${missing.length} required printings: ${missing.slice(0, 20).join(", ")}`);
  }

  const staging = join(OUTPUT_DIR, ".staging");
  await rm(staging, { recursive: true, force: true });
  await mkdir(staging, { recursive: true });
  const sets = {};
  for (const [set, cards] of [...cardsBySet].sort(([a], [b]) => a.localeCompare(b))) {
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
