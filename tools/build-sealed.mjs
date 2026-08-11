// Sealed-product contents + collation reference generator.
//
//   node tools/build-sealed.mjs SOS TLA FIN     # one data/sealed/{SET}.json per set
//
// Source is MTGJSON v5 per-set exports, which carry both halves of what the page needs
// and cannot get from tcgcsv: what is physically inside every sealed product
// (`sealedProduct[].contents`) and the sheet weights each booster draws from
// (`booster[]`). Contents never change once a set is printed, so a set is built once.
//
// Why a sibling of the frozen format-v2 collation doc rather than an extension of it:
// v2 keys `products` by play|collector|set|draft and is gated by the published-rates
// coverage law (tools/README.md). Modern sets ship one-off boosters that have no such
// key and no published article — SOS `codex-bundle`, TLA `commander-bundle`, FIN
// `chocobo-bundle`/`box-topper`. This file describes *products*, v2 describes *rates
// under validation*; both quote sheets with the same `[setCode?, cn, weight]` triple.
//
// v2 keeps both the exact weighted variants used by outcome simulation and the
// weight-averaged picks used by the fast analytic EV path.

import { writeFileSync, mkdirSync, readdirSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { join } from "node:path";

const OUT_DIR = fileURLToPath(new URL("../data/sealed/", import.meta.url));
const UA = { "user-agent": "colorbreak-sealed/1.0 (+https://mcbradd.github.io/ColorBreak)" };

// Products that are never break inputs: digital-only, and giveaway decks with no packs.
const SKIP_CATEGORY = /mtgo_redemption/i;

// @pure
// Expected picks per sheet for one MTGJSON booster config, averaged over its weighted
// pack variants: sum over variants of (variantWeight / totalWeight) * cardsFromThatSheet.
export function expectedPicks(config) {
  const total = config.boostersTotalWeight || config.boosters.reduce((a, b) => a + b.weight, 0);
  const picks = {};
  for (const variant of config.boosters) {
    const share = variant.weight / total;
    for (const [sheet, count] of Object.entries(variant.contents)) {
      picks[sheet] = (picks[sheet] || 0) + share * count;
    }
  }
  // 1e-6 keeps 30-pack boxes inside the 1% accuracy budget without pretending to
  // more precision than the weights carry.
  for (const k of Object.keys(picks)) picks[k] = Math.round(picks[k] * 1e6) / 1e6;
  return picks;
}

export function finishForSheet(name, sheet) {
  const normalized = name.toLowerCase();
  if (normalized.includes("etched")) return "etched";
  if (normalized.includes("surge")) return "surge";
  if (normalized.includes("textured")) return "textured";
  if (normalized.includes("gilded")) return "gilded";
  if (normalized.includes("serialized")) return "serialized";
  if (/neon|galaxy|confetti|halo|ripple|fracture|raised|step.?and.?compleat/.test(normalized)) return "other";
  return sheet.foil ? "foil" : "nonfoil";
}
// @end-pure

// A deck's card list cites uuids and nothing else — `{ count, uuid, isFoil }` — so the
// collector number every consumer prices on comes from the set's own card index. An
// unresolvable uuid is recorded like any other missing ref: the sibling-set merge gets a
// chance at it before the shortfall is disclosed.
function deckCards(deck, cardsByUuid, fallbackSet, deckName, unresolved) {
  const out = [];
  for (const dc of [...(deck.mainBoard || []), ...(deck.sideBoard || [])]) {
    const card = cardsByUuid.get(dc.uuid);
    if (!card) { unresolved.push({ booster: "deck", sheet: deckName, uuid: dc.uuid }); continue; }
    out.push({ set: (card.setCode || fallbackSet).toUpperCase(), cn: String(card.number),
      n: dc.count || 1, foil: !!dc.isFoil });
  }
  return out;
}

// Flatten one product into the boosters it ultimately contains. `contents.sealed`
// entries point at other products in the same document (a case holds bundles, a bundle
// holds packs), so expansion recurses.
function expand(product, byUuid, cardsByUuid, decksByName, missingDecks, missingSealed, unresolved, seen = new Set()) {
  const fixed = new Map(), decks = [], other = [];
  // Guaranteed cards, from two shapes: `contents.card` (a single named promo, e.g. the
  // ONE Compleat Bundle's foil Phyrexian Arena) and `contents.deck` (a named deck in the
  // set's own `decks[]`, which is how bundle land packs are carried). Both are worth real
  // money and both are counted; only `contents.other` — dice, boxes, life counters —
  // stays an unvalued note.
  const addFixed = (set, cn, n, foil) => {
    if (!cn) return;
    const key = `${set}|${cn}|${foil ? "f" : "n"}`;
    const e = fixed.get(key) || { set, cn: String(cn), n: 0, foil: !!foil };
    e.n += n;
    fixed.set(key, e);
  };
  const packKey = (code, set) =>
    set && set.toUpperCase() !== product.__set ? `${set.toUpperCase()}:${code}` : code;
  const merge = (into, from) => {
    for (const [k, n] of Object.entries(from)) into[k] = (into[k] || 0) + n;
    return into;
  };
  // MTGJSON states one booster twice in some products: a prerelease pack names both the
  // generic `prerelease` config and its faction-specific `prerelease-aang` — one physical
  // booster under two names. The specific config wins. Both spellings occur: Tarkir
  // Dragonstorm puts the variant in a sealed child, Avatar lists both in one `pack` array,
  // so a generic is dropped when any sibling — its node's own packs or its children's —
  // names a variant of it. A `-sample` config is never a variant: a Collector Sample Pack
  // is its own product, not another name for a Collector Booster.
  const dedupe = (own, below) => {
    const siblings = merge({ ...below }, own);
    for (const key of Object.keys(own)) {
      const dup = Object.keys(siblings)
        .filter((k) => k.startsWith(key + "-") && !k.endsWith("-sample"))
        .reduce((a, k) => a + siblings[k], 0);
      if (dup > 0) own[key] -= Math.min(own[key], dup);
      if (!own[key]) delete own[key];
    }
    return own;
  };
  const walk = (p, mult) => {
    if (seen.has(p.uuid)) throw new Error(`cyclic sealed contents at ${p.name}`);
    seen.add(p.uuid);
    const c = p.contents || {};
    const own = {}, below = {};
    for (const pack of c.pack || []) {
      const k = packKey(pack.code, pack.set);
      own[k] = (own[k] || 0) + mult;
    }
    for (const card of c.card || []) {
      const foil = card.foil != null ? card.foil : (card.finishes || []).includes("foil") && !(card.finishes || []).includes("nonfoil");
      addFixed((card.set || p.__set || product.__set).toUpperCase(), card.number, mult, foil);
    }
    for (const d of c.deck || []) {
      decks.push(d.name);
      // Names are matched as slugs: contents cite "Aragorn at Helms Deep" for a deck the
      // set calls "Aragorn at Helm's Deep".
      const deck = decksByName.get(slug(d.name));
      if (!deck) {
        missingDecks.push({ product: p.name, deck: d.name, set: (d.set || p.__set || product.__set).toUpperCase() });
        other.push(d.name); // disclosed as unpriced prose if it stays unresolvable
        continue;
      }
      for (const dc of deckCards(deck, cardsByUuid, p.__set || product.__set, d.name, unresolved)) {
        addFixed(dc.set, dc.cn, dc.n * mult, dc.foil);
      }
    }
    for (const o of c.other || []) other.push(o.name);
    for (const s of c.sealed || []) {
      const child = byUuid.get(s.uuid);
      // Same contract as build-collation.mjs: an unresolved reference is a named
      // failure, never a silently under-counted product. Cross-set references do occur
      // (BLB's Tin Mouse holds a Foundations Play Booster Pack), so the sibling set is
      // fetched and merged before the failure stands.
      if (!child) {
        missingSealed.push({ product: p.name, uuid: s.uuid, name: s.name, set: (s.set || "").toUpperCase() });
        other.push(s.name); // disclosed as unpriced prose if it stays unresolvable
        continue;
      }
      merge(below, walk(child, mult * (s.count || 1)));
    }
    seen.delete(p.uuid);
    return merge(dedupe(own, below), below);
  };
  const packs = walk(product, 1);
  return { packs, fixed: [...fixed.values()], decks, other };
}

// Stable catalog key from the product name, minus the set-name prefix every product
// carries ("Secrets of Strixhaven Codex Bundle" -> "codex-bundle"). Compared as slugs
// because product names drop the set name's punctuation: the set is "Avatar: The Last
// Airbender", its bundle is "Avatar The Last Airbender Bundle".
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
// @pure
export function keyFor(name, setName) {
  const n = slug(name), p = slug(setName);
  return (n.startsWith(p + "-") ? n.slice(p.length + 1) : n) || "product";
}

// Same strip, word-wise, keeping the original casing for display.
export function labelFor(name, setName) {
  const bare = (w) => w.replace(/[^a-z0-9]/gi, "").toLowerCase();
  const nw = name.split(/\s+/).filter(Boolean), pw = setName.split(/\s+/).filter(Boolean);
  let i = 0;
  while (i < pw.length && nw[i] && bare(nw[i]) === bare(pw[i])) i++;
  return nw.slice(i).join(" ") || name;
}
// @end-pure

// @pure
// A multi-pack whose name declares how many units it holds ("Scene Box Set of 4") must
// hold that many. MTGJSON's Final Fantasy entry lists one scene box, count 1, so its
// contents — and every EV computed from them — are a quarter of the truth. The count
// cannot be guessed back (which three of the four are missing is not stated), so the
// product ships with the discrepancy named, the same way an unresolved uuid does.
export function shortCount(product) {
  const m = /\b(?:set|display|case)\s+of\s+(\d+)\b/i.exec(product.name || "");
  if (!m) return null;
  const declared = Number(m[1]);
  const units = (product.contents?.sealed || []).reduce((a, s) => a + (s.count || 1), 0);
  if (!units || units >= declared) return null;
  return `MTGJSON lists ${units} of the ${declared} units this product's name declares; contents and EV are understated by the rest.`;
}
// @end-pure

export class UnresolvedCards extends Error {
  constructor(refs, decks = [], sealed = []) {
    super([refs.length ? `unresolved sheet uuids: ${refs.map((r) => `${r.sheet}/${r.uuid}`).join(", ")}` : "",
      decks.length ? `unresolved decks: ${decks.map((d) => `${d.set}/${d.deck}`).join(", ")}` : "",
      sealed.length ? `unresolved sealed products: ${sealed.map((s) => `${s.product}/${s.name}`).join(", ")}` : ""].filter(Boolean).join("; "));
    this.refs = refs;
    this.decks = decks;
    this.sealed = sealed;
  }
}

// allowMissing: last resort, after every merge candidate has been tried. Some MTGJSON
// booster configs carry dangling uuids (ONE's collector `compleatFoil` cites cards that
// exist in no published set file). Dropping them silently would inflate every surviving
// card's odds, so the sheet keeps MTGJSON's own totalWeight and the shortfall is
// recorded in `missing` for the page to disclose as unpriced.
export function buildSet(data, extraCards = new Map(), allowMissing = false, extraDecks = new Map(), extraProducts = new Map()) {
  const set = data.code.toUpperCase();
  const byUuid = new Map([...extraProducts, ...(data.sealedProduct || []).map((p) => [p.uuid, p])]);
  const cardsByUuid = new Map([...extraCards, ...(data.cards || []).map((c) => [c.uuid, c])]);
  // Sibling-set decks come in through extraDecks: MAT's Aftermath Bundle contains
  // "March of the Machine Bundle Land Pack", a deck that lives in MOM.
  const decksByName = new Map(extraDecks);
  for (const d of data.decks || []) decksByName.set(slug(d.name), d);
  const missingDecks = [];
  const missingSealed = [];
  const unresolved = []; // filled by deck expansion first, then by the booster sheets below
  const products = [];
  const usedConfigs = new Set();
  const keys = new Map();

  for (const p of data.sealedProduct || []) {
    if (SKIP_CATEGORY.test(`${p.category}/${p.subtype}`)) continue;
    p.__set = set;
    const { packs, fixed, decks, other } = expand(p, byUuid, cardsByUuid, decksByName, missingDecks, missingSealed, unresolved);
    if (!Object.keys(packs).length && !fixed.length) continue; // dice/boxes only — not a break input
    let key = keyFor(p.name, data.name);
    if (keys.has(key)) key = `${key}-${keys.get(key) + 1}`;
    keys.set(key, (keys.get(key) || 0) + 1);
    for (const code of Object.keys(packs)) if (!code.includes(":")) usedConfigs.add(code);
    products.push({
      key, label: labelFor(p.name, data.name), name: p.name, category: p.category, subtype: p.subtype,
      tcgId: p.identifiers?.tcgplayerProductId ? Number(p.identifiers.tcgplayerProductId) : null,
      packs, ...(fixed.length ? { fixed } : {}), ...(decks.length ? { decks } : {}), ...(other.length ? { other } : {}),
      ...(shortCount(p) ? { suspect: shortCount(p) } : {}),
      __uuid: p.uuid, __contents: p.contents || {},
    });
  }

  // `packs` is the product flattened all the way down to boosters, which is what EV needs.
  // The page also has to offer a break one level at a time — a case rolls out to boxes,
  // a box to packs — so every product additionally carries its immediate children.
  const keyByUuid = new Map(products.map((p) => [p.__uuid, p.key]));
  for (const p of products) {
    const c = p.__contents;
    const contains = [];
    for (const pack of c.pack || []) {
      const code = pack.set && pack.set.toUpperCase() !== set ? `${pack.set.toUpperCase()}:${pack.code}` : pack.code;
      // `packs` has already resolved one physical booster listed under both a generic and
      // a variant name (TDM's `prerelease` + `prerelease-abzan`) down to the variant. A
      // roll-out row for the name that lost would be a second, unpriceable booster.
      if (code in p.packs) contains.push({ pack: code, n: 1 });
    }
    for (const s of c.sealed || []) {
      const childKey = keyByUuid.get(s.uuid);
      // A child this build could not resolve, or one whose own contents were dice only,
      // has no line item to roll out to; it stays the prose note `expand` already made.
      if (childKey) { contains.push({ product: childKey, n: s.count || 1 }); continue; }
      // A child from another set has no line item here (BLB's Tin Mouse holds a
      // Foundations Play Booster Pack) but its boosters are already in `packs` and
      // already priced. Roll it out as those boosters, not as prose that reads unpriced.
      const foreign = byUuid.get(s.uuid);
      const fp = foreign ? expand(foreign, byUuid, cardsByUuid, decksByName, [], [], []).packs : {};
      if (Object.keys(fp).length) {
        // `expand` keys a product's own boosters bare; from here they belong to the
        // child's set, which is what `packs` on this product already says.
        const owner = (foreign.__set || s.set || "").toUpperCase();
        for (const [code, n] of Object.entries(fp)) {
          const key = code.includes(":") || owner === set ? code : `${owner}:${code}`;
          contains.push({ pack: key, n: n * (s.count || 1) });
        }
      } else contains.push({ other: s.name, n: s.count || 1 });
    }
    for (const card of c.card || []) {
      const foil = card.foil != null ? card.foil
        : (card.finishes || []).includes("foil") && !(card.finishes || []).includes("nonfoil");
      contains.push({ card: `${(card.set || set).toUpperCase()}:${card.number}`, ...(foil ? { foil: true } : {}), n: 1 });
    }
    for (const d of c.deck || []) {
      // A rolled-out land pack still has to price its cards, so the deck's list rides
      // along; an unresolved deck was already recorded as prose by `expand`.
      const deck = decksByName.get(slug(d.name));
      const cards = deck ? deckCards(deck, cardsByUuid, set, d.name, unresolved) : [];
      contains.push({ deck: d.name, n: 1, ...(cards.length ? { fixed: cards } : {}) });
    }
    for (const o of c.other || []) contains.push({ other: o.name, n: 1 });
    // Merge the identical rows MTGJSON lists separately, so the roll-out reads
    // "20× Foil basic land", not twenty rows of one.
    const merged = [];
    for (const e of contains) {
      const same = merged.find((m) => m.pack === e.pack && m.product === e.product
        && m.card === e.card && m.foil === e.foil && m.deck === e.deck && m.other === e.other);
      if (same) same.n += e.n; else merged.push(e);
    }
    p.contains = merged;
    delete p.__uuid;
    delete p.__contents;
  }

  // Only configs some product actually contains: drops play-arena and other
  // digital/never-sold configs without a hand-maintained skip list.
  const boosters = {};
  for (const [code, config] of Object.entries(data.booster || {})) {
    if (!usedConfigs.has(code)) continue;
    const sheets = {};
    for (const [name, sheet] of Object.entries(config.sheets)) {
      const list = [];
      let missing = 0;
      for (const [uuid, weight] of Object.entries(sheet.cards)) {
        const card = cardsByUuid.get(uuid);
        if (!card) { unresolved.push({ booster: code, sheet: name, uuid }); missing += weight; continue; }
        const own = (card.setCode || set).toUpperCase() === set;
        list.push(own ? [card.number, weight] : [(card.setCode || "").toUpperCase(), card.number, weight]);
      }
      sheets[name] = {
        foil: !!sheet.foil,
        finish: finishForSheet(name, sheet),
        total: sheet.totalWeight,
        cards: list,
        ...(sheet.allowDuplicates === false ? { allowDuplicates: false } : {}),
        ...(sheet.balanceColors ? { balanceColors: true } : {}),
        ...(missing ? { missing } : {}),
      };
    }
    boosters[code] = {
      picks: expectedPicks(config),
      variants: config.boosters.map((variant) => ({
        weight: variant.weight,
        picks: Object.fromEntries(Object.entries(variant.contents).map(([sheet, count]) => [sheet, Number(count)])),
      })),
      sheets,
    };
  }
  if ((unresolved.length || missingDecks.length || missingSealed.length) && !allowMissing) throw new UnresolvedCards(unresolved, missingDecks, missingSealed);

  return {
    v: 2, set, name: data.name, released: data.releaseDate,
    src: { mtgjson: data.__meta?.version || null, mtgjsonDate: data.__meta?.date || null, builtAt: new Date().toISOString() },
    products, boosters,
  };
}

// A full rebuild pulls ~45 per-set exports plus every sibling set a bonus sheet reaches
// into, at several MB each. Maintainer reruns are frequent while contents rules change,
// so downloads are cached in the OS temp dir for a day — deleting the directory is the
// only invalidation anyone needs.
const CACHE_DIR = join(tmpdir(), "colorbreak-mtgjson");
const CACHE_MS = 24 * 3600e3;
async function fetchSet(code) {
  const file = join(CACHE_DIR, `${code}.json`);
  try {
    if (Date.now() - statSync(file).mtimeMs < CACHE_MS) return JSON.parse(readFileSync(file, "utf8"));
  } catch { /* cold cache */ }
  const res = await fetch(`https://mtgjson.com/api/v5/${code}.json`, { headers: UA });
  if (!res.ok) throw new Error(`${code}: HTTP ${res.status}`);
  const doc = await res.json();
  try { mkdirSync(CACHE_DIR, { recursive: true }); writeFileSync(file, JSON.stringify(doc)); } catch { /* cache is optional */ }
  return doc;
}

// Booster sheets routinely quote cards a per-set export does not embed: the SOS Codex
// Booster draws SOC, TLA's Commander's Bundle draws TLE, MSH's source-material sheet
// draws MAR. tools/README.md's contract is that the foreign set must be pre-merged
// before building; these are the candidates worth trying, cheapest and likeliest first,
// before declaring the named failure. Alchemy and token sets are digital or
// non-collectable and never appear on a paper sheet.
function mergeCandidates(code, setList) {
  const paper = (s) => !/alchemy|token|memorabilia/.test(s.type);
  const me = setList.find((s) => s.code === code);
  const days = (a, b) => Math.abs(new Date(a) - new Date(b)) / 86400e3;
  const tiers = [
    setList.filter((s) => s.parentCode === code && paper(s)),
    setList.filter((s) => paper(s) && me && days(s.releaseDate, me.releaseDate) <= 120 && s.code !== code),
    // MAR is a masterpiece set with no parentCode and its own release date, so the
    // near-release tier misses it; companion sheets stay inside a release year.
    setList.filter((s) => /masterpiece|eternal|promo/.test(s.type) && me && days(s.releaseDate, me.releaseDate) <= 365),
  ];
  const out = [];
  for (const t of tiers) for (const s of t) if (!out.includes(s.code)) out.push(s.code);
  for (const c of ["SPG", "PLST"]) if (!out.includes(c)) out.push(c);
  return out;
}

async function main() {
  const args = process.argv.slice(2);
  if (!args.length) { console.error("usage: node tools/build-sealed.mjs <SET ...>"); process.exit(1); }
  mkdirSync(OUT_DIR, { recursive: true });
  let setList = null;
  for (const code of args.map((a) => a.toUpperCase())) {
    let doc;
    try { doc = await fetchSet(code); } catch (e) { console.error(e.message); process.exitCode = 1; continue; }
    const data = { ...doc.data, __meta: doc.meta };
    const extra = new Map();
    const extraDecks = new Map();
    const extraProducts = new Map();
    const tried = new Set();
    let out;
    try {
      for (;;) {
        try { out = buildSet(data, extra, false, extraDecks, extraProducts); break; } catch (e) {
          if (!(e instanceof UnresolvedCards)) throw e;
          if (!setList) setList = (await fetchSet("SetList")).data;
          // A cross-set sealed reference names its own set, so try that before the
          // release-window heuristics (BLB tins hold MKM packs, six months apart).
          const named = e.sealed.map((s) => s.set).filter(Boolean);
          const cands = [...new Set([...named, ...mergeCandidates(code, setList)])].filter((c) => !tried.has(c));
          let grew = false;
          for (const c of cands) {
            tried.add(c);
            let sib;
            try { sib = await fetchSet(c); } catch { continue; }
            for (const card of sib.data.cards || []) if (!extra.has(card.uuid)) { extra.set(card.uuid, card); grew = true; }
            for (const d of sib.data.decks || []) if (!extraDecks.has(slug(d.name))) { extraDecks.set(slug(d.name), d); grew = true; }
            for (const sp of sib.data.sealedProduct || []) if (!extraProducts.has(sp.uuid)) { extraProducts.set(sp.uuid, { ...sp, __set: sib.data.code.toUpperCase() }); grew = true; }
            if (e.refs.every((r) => extra.has(r.uuid)) && e.decks.every((d) => extraDecks.has(slug(d.deck)))
              && e.sealed.every((s) => extraProducts.has(s.uuid))) break;
          }
          // Candidates exhausted: build anyway, but never silently — the uuids and deck
          // names are named here and their weight is recorded as unpriced.
          if (!grew) {
            console.error(`${code}: WARNING ${e.message}, recorded as unpriced`);
            out = buildSet(data, extra, true, extraDecks, extraProducts);
            break;
          }
        }
      }
    } catch (e) { console.error(e.message); process.exitCode = 1; continue; }
    if (!out.products.length) { console.error(`${code}: no sealed products with packs — skipped`); continue; }
    writeFileSync(`${OUT_DIR}${code}.json`, JSON.stringify(out));
    const foreign = new Set();
    for (const p of out.products) for (const k of Object.keys(p.packs)) if (k.includes(":")) foreign.add(k);
    console.error(`${code}: ${out.products.length} products, ${Object.keys(out.boosters).length} boosters${foreign.size ? `, foreign packs: ${[...foreign].join(" ")}` : ""}`);
  }
  // index.json lets the page know which sets have a reference file without probing 404s.
  const have = readdirSync(OUT_DIR).filter((f) => /^[A-Z0-9]+\.json$/.test(f)).map((f) => f.replace(/\.json$/, ""));
  const documents = have.map((set) => {
    const stored = JSON.parse(readFileSync(`${OUT_DIR}${set}.json`, "utf8"));
    return { code: stored.set, name: stored.name, released: stored.released, products: stored.products.length };
  }).sort((a, b) => a.code.localeCompare(b.code));
  writeFileSync(`${OUT_DIR}index.json`, JSON.stringify({ sets: have.sort(), documents, builtAt: new Date().toISOString() }));
  console.error(`index.json: ${have.length} sets`);
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1].replace(/\\/g, "/")}`).href) {
  main().catch((e) => { console.error(e.message); process.exit(1); });
}
