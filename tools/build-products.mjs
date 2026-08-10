// Per-set sealed-product catalog generator (feedback 2026-08-10, items 6 & 13).
// Fetches tcgcsv.com (mirror of TCGplayer's per-set product listings) and emits/updates
// data/products.json — the static catalog index.html reads. Node stdlib only.
//
// Usage:
//   node tools/build-products.mjs EOE TDM FIN        # add/refresh specific sets by code
//   node tools/build-products.mjs --since 2023-01-01 # add/refresh every set published since
//
// Output is MERGED into the existing data/products.json (per-set replace), so new sets can
// be appended after each release without regenerating the world.
//
// Pack-count constants are NOT in tcgcsv — they come from era rules below + tools/ppb.json.
// ponytail: bundle/prerelease contents are era heuristics with an override table; a set that
// shipped a weird bundle gets a line in OVERRIDES, not a new rule.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const PPB = JSON.parse(readFileSync(new URL("./ppb.json", import.meta.url), "utf8"));
const OUT = fileURLToPath(new URL("../data/products.json", import.meta.url));

// Per-set hand overrides for pack counts, keyed "SET/productKey" -> packs.
const OVERRIDES = {};

function ppbFor(packType, publishedOn) {
  const d = PPB.defaults[packType];
  if (d == null) return null;
  if (typeof d === "number") return d;
  return publishedOn < PPB.cutoverDate ? d.before : d.atOrAfter;
}

// Bundle / prerelease era heuristics (documented, overridable):
//  - bundles: 10 draft boosters before Set Boosters existed (pre 2020-09), 8 set boosters
//    through 2023, 9 play boosters from 2024 on.
//  - prerelease packs: 6 boosters of the set's default draftable type in every era.
function bundleContents(publishedOn) {
  if (publishedOn >= "2024-01-01") return { packType: "play", packs: 9 };
  if (publishedOn >= "2020-09-01") return { packType: "set", packs: 8 };
  return { packType: "draft", packs: 10 };
}
function prereleaseContents(publishedOn) {
  return { packType: publishedOn >= "2024-01-01" ? "play" : "draft", packs: 6 };
}

// Classify one tcgcsv sealed product name (the part after "SetName - ").
// Returns { key, label, packType, packs, unit } or null (deliberately skipped).
export function classifyProduct(name, publishedOn) {
  const suffix = name.includes(" - ") ? name.slice(name.indexOf(" - ") + 3) : name;
  // never priced as break inputs: cases, samples, omega/collector-novelty packaging
  if (/case|omega|sample|minimal packaging|gift bundle|welcome|starter|tournament|commander|jumpstart|deck/i.test(suffix)) return null;
  const bt = /(play|draft|set|collector)\s+booster/i.exec(suffix);
  const packType = bt ? bt[1].toLowerCase() : null;
  if (packType && /display|box/i.test(suffix)) {
    const packs = ppbFor(packType, publishedOn);
    return { key: `${packType}-box`, label: `${cap(packType)} Booster Box`, packType, packs, unit: "box" };
  }
  if (packType && /three[ -]booster/i.test(suffix)) {
    return { key: `${packType}-three`, label: `Three ${cap(packType)} Boosters`, packType, packs: 3, unit: "multi" };
  }
  if (packType && /sleeved/i.test(suffix)) {
    return { key: `${packType}-sleeved`, label: `Sleeved ${cap(packType)} Booster`, packType, packs: 1, unit: "pack" };
  }
  if (packType && /pack$/i.test(suffix.trim())) {
    return { key: `${packType}-pack`, label: `${cap(packType)} Booster Pack`, packType, packs: 1, unit: "pack" };
  }
  if (/^bundle$/i.test(suffix.trim())) {
    const b = bundleContents(publishedOn);
    return { key: "bundle", label: "Bundle", packType: b.packType, packs: b.packs, unit: "bundle" };
  }
  if (/^prerelease (pack|kit)$/i.test(suffix.trim())) {
    const p = prereleaseContents(publishedOn);
    return { key: "prerelease", label: "Prerelease Pack", packType: p.packType, packs: p.packs, unit: "prerelease" };
  }
  return null;
}
const cap = (s) => s[0].toUpperCase() + s.slice(1);

async function fetchJSON(url) {
  const res = await fetch(url, { headers: { "user-agent": "colorbreak-catalog/1.0 (+https://mcbradd.github.io/ColorBreak)" } });
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return res.json();
}

export function buildSetEntry(group, products) {
  const published = (group.publishedOn || "").slice(0, 10);
  const out = [];
  const seen = new Set();
  for (const p of products) {
    // sealed products carry no per-card extendedData Rarity row
    if (p.extendedData && p.extendedData.some((d) => d.name === "Rarity")) continue;
    const c = classifyProduct(p.name, published);
    if (!c || seen.has(c.key)) continue; // first listing wins (reprints/dupes trail)
    seen.add(c.key);
    const packs = OVERRIDES[`${group.abbreviation}/${c.key}`] ?? c.packs;
    out.push({ id: p.productId, ...c, packs });
  }
  // packs-in-box reference for fractional cost basis: each pack-ish entry points at its box
  for (const e of out) {
    if (e.unit !== "box") {
      const box = out.find((b) => b.unit === "box" && b.packType === e.packType);
      if (box) { e.boxId = box.id; e.packsPerBox = box.packs; }
    }
  }
  // stable order: boxes, packs, then the rest, play first
  const rank = (e) => ({ box: 0, pack: 1, multi: 2, bundle: 3, prerelease: 4 }[e.unit] ?? 9) * 10
    + ({ play: 0, collector: 1, set: 2, draft: 3 }[e.packType] ?? 9);
  out.sort((a, b) => rank(a) - rank(b));
  return { groupId: group.groupId, name: group.name, released: published, products: out };
}

async function main() {
  const args = process.argv.slice(2);
  if (!args.length) {
    console.error("usage: node tools/build-products.mjs <SET ...> | --since YYYY-MM-DD");
    process.exit(1);
  }
  const groups = (await fetchJSON("https://tcgcsv.com/tcgplayer/1/groups")).results;
  let targets;
  if (args[0] === "--since") {
    targets = groups.filter((g) => g.abbreviation && !g.isSupplemental && (g.publishedOn || "") >= args[1]);
  } else {
    const want = new Set(args.map((a) => a.toUpperCase()));
    targets = groups.filter((g) => want.has((g.abbreviation || "").toUpperCase()));
    const found = new Set(targets.map((g) => g.abbreviation.toUpperCase()));
    for (const w of want) if (!found.has(w)) console.error(`warn: no tcgcsv group with abbreviation ${w}`);
  }
  const existing = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")) : { sets: {} };
  for (const g of targets) {
    const products = (await fetchJSON(`https://tcgcsv.com/tcgplayer/1/${g.groupId}/products`)).results;
    const entry = buildSetEntry(g, products);
    if (!entry.products.length) { console.error(`skip ${g.abbreviation} (${g.name}): no sealed products classified`); continue; }
    existing.sets[g.abbreviation.toUpperCase()] = entry;
    console.error(`${g.abbreviation}: ${entry.products.length} products`);
    await new Promise((r) => setTimeout(r, 120)); // be polite to the mirror
  }
  existing.builtAt = new Date().toISOString();
  existing.source = "tcgcsv.com (TCGplayer catalog mirror)";
  mkdirSync(fileURLToPath(new URL("../data/", import.meta.url)), { recursive: true });
  writeFileSync(OUT, JSON.stringify(existing, null, 1));
  console.error(`wrote ${OUT} (${Object.keys(existing.sets).length} sets)`);
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1].replace(/\\/g, "/")}`).href) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
