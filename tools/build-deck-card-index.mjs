// Build a compact exact-printing index for deck UUIDs omitted from per-set exports.
//
// Usage:
//   node tools/build-deck-card-index.mjs --source-dir <extracted AllSetFiles directory>
//
// The source directory may also be build-sealed.mjs's MTGJSON cache. The output keeps
// only UUIDs referenced by decks in the committed sealed-set corpus, plus checksums of
// the set documents that supplied them. This gives the normalizer AllIdentifiers-like
// exact resolution without shipping or repeatedly parsing a ~600 MB global file.

import { createHash } from "node:crypto";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const args = process.argv.slice(2);
const sourceFlag = args.indexOf("--source-dir");
const sourceDir = sourceFlag >= 0 ? args[sourceFlag + 1] : join(tmpdir(), "colorbreak-mtgjson");
const sinceFlag = args.indexOf("--since");
const since = sinceFlag >= 0 ? args[sinceFlag + 1] : "2021-07-23";
const sealedIndex = JSON.parse(readFileSync(join(ROOT, "data", "sealed", "index.json"), "utf8"));
const supported = sealedIndex.documents.filter((document) => document.released >= since).map((document) => document.code);

const rawByCode = new Map();
for (const file of readdirSync(sourceDir).filter((name) => /^[A-Z0-9]+\.json$/.test(name))) {
  const raw = readFileSync(join(sourceDir, file), "utf8");
  try {
    const document = JSON.parse(raw);
    if (document.data?.code) rawByCode.set(document.data.code.toUpperCase(), { raw, document });
  } catch { /* ignore non-set files */ }
}

const needed = new Set();
for (const code of supported) {
  const data = rawByCode.get(code)?.document.data;
  if (!data) throw new Error(`${code}.json is missing from ${sourceDir}`);
  const local = new Set((data.cards ?? []).map((card) => card.uuid));
  for (const deck of data.decks ?? []) {
    for (const card of [...(deck.mainBoard ?? []), ...(deck.sideBoard ?? [])]) {
      if (!local.has(card.uuid)) needed.add(card.uuid);
    }
  }
}

const cards = {};
const sources = new Map();
for (const [code, { raw, document }] of rawByCode) {
  for (const card of document.data.cards ?? []) {
    if (!needed.has(card.uuid) || cards[card.uuid]) continue;
    cards[card.uuid] = { setCode: (card.setCode ?? code).toUpperCase(), number: String(card.number), name: card.name };
    sources.set(code, {
      set: code,
      mtgjson: document.meta?.version ?? null,
      mtgjsonDate: document.meta?.date ?? null,
      sha256: createHash("sha256").update(raw).digest("hex"),
    });
  }
}

const missing = [...needed].filter((uuid) => !cards[uuid]);
if (missing.length) throw new Error(`${missing.length} deck UUIDs remain unresolved; use a complete extracted AllSetFiles source directory`);
const output = {
  version: 1,
  generatedAt: new Date().toISOString(),
  source: "MTGJSON per-set Card (Set) records keyed by deck UUID",
  cards: Object.fromEntries(Object.entries(cards).sort(([a], [b]) => a.localeCompare(b))),
  sourceDocuments: [...sources.values()].sort((a, b) => a.set.localeCompare(b.set)),
};
writeFileSync(join(ROOT, "data", "deck-card-index.json"), `${JSON.stringify(output, null, 2)}\n`);
console.log(`wrote ${Object.keys(cards).length} exact deck printing mappings from ${sources.size} MTGJSON set documents`);
