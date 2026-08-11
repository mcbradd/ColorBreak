// Every shipped product, run through the shipped EV engine. These are contract tests on
// data/sealed/*.json: they do not price anything (no Scryfall), they assert that each of
// the 700-odd products draws the cards its physical contents say it should.
//
// A failure here is one of two things: a builder regression, or MTGJSON changing what it
// says a product holds. Both are worth knowing about before a break is priced on it.
import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { loadPure } from "./extract.mjs";

const { productDraws } = loadPure();
const DIR = fileURLToPath(new URL("../data/sealed/", import.meta.url));
const DOCS = {};
for (const f of readdirSync(DIR).filter((f) => f !== "index.json")) {
  const d = JSON.parse(readFileSync(DIR + f, "utf8"));
  DOCS[d.set] = d;
}

// Packs borrowed from another set (BLB's tins) price off that set's file.
function foreignFor(doc) {
  const out = {};
  for (const p of doc.products) {
    for (const k of Object.keys(p.packs)) {
      const owner = k.includes(":") ? k.slice(0, k.indexOf(":")) : null;
      if (owner && DOCS[owner]) out[owner] = DOCS[owner].boosters;
    }
  }
  return out;
}

const drawsFor = (set, p) => productDraws(p, DOCS[set].boosters, set, foreignFor(DOCS[set]));
const cardCount = (draws) => draws.reduce((a, d) => a + d.copies, 0);
const every = function* () {
  for (const [set, doc] of Object.entries(DOCS)) for (const p of doc.products) yield [set, p, doc];
};

test("every set file is format v1 with products and boosters", () => {
  assert.ok(Object.keys(DOCS).length >= 45, `only ${Object.keys(DOCS).length} sets`);
  const index = JSON.parse(readFileSync(DIR + "index.json", "utf8"));
  assert.deepEqual(index.sets.slice().sort(), Object.keys(DOCS).sort(), "index.json names exactly the files present");
  for (const [set, doc] of Object.entries(DOCS)) {
    assert.equal(doc.v, 1, `${set} version`);
    assert.ok(doc.products.length, `${set} has no products`);
    assert.ok(Object.keys(doc.boosters).length, `${set} has no boosters`);
  }
});

// A sheet is a probability distribution: the weights have to be the total they claim,
// minus whatever the build recorded as unresolvable. Anything else silently reweights
// every card on the sheet.
test("sheet weights sum to the sheet total, less its disclosed shortfall", () => {
  const bad = [];
  for (const [set, doc] of Object.entries(DOCS)) {
    for (const [code, b] of Object.entries(doc.boosters)) {
      for (const [name, sh] of Object.entries(b.sheets)) {
        const sum = sh.cards.reduce((a, c) => a + (c.length === 3 ? c[2] : c[1]), 0);
        if (sum + (sh.missing || 0) !== sh.total) bad.push(`${set}/${code}/${name} ${sum}+${sh.missing || 0} != ${sh.total}`);
        for (const c of sh.cards) assert.ok(c.length === 2 || c.length === 3, `${set}/${code}/${name} card triple ${JSON.stringify(c)}`);
      }
      for (const name of Object.keys(b.picks)) assert.ok(b.sheets[name], `${set}/${code} picks '${name}' with no sheet`);
    }
  }
  assert.deepEqual(bad, []);
});

// The roll-out reads these: an unresolvable reference would render a line item that
// cannot be priced or, worse, one that silently prices as nothing.
// The Hobbit's contents cite two booster codes its own `booster` map never defines, so
// there is no sheet to price them from. Counted as unpriced, never dropped.
const UNDEFINED_UPSTREAM = new Set(["HOB/bundle-promo", "HOB/prerelease"]);

test("every contents reference resolves — product keys, pack codes, deck cards", () => {
  const bad = [];
  for (const [set, p, doc] of every()) {
    const keys = new Set(doc.products.map((x) => x.key));
    for (const c of p.contains || []) {
      if (c.product && !keys.has(c.product)) bad.push(`${set}/${p.key} -> product ${c.product}`);
      if (c.pack && !c.pack.includes(":") && !doc.boosters[c.pack] && !UNDEFINED_UPSTREAM.has(`${set}/${c.pack}`))
        bad.push(`${set}/${p.key} -> pack ${c.pack}`);
      for (const f of c.fixed || []) if (!f.cn || f.cn === "undefined") bad.push(`${set}/${p.key} deck card with no collector number`);
    }
    for (const f of p.fixed || []) if (!f.cn || f.cn === "undefined") bad.push(`${set}/${p.key} fixed card with no collector number`);
  }
  assert.deepEqual(bad, []);
});

// Physical pack sizes. A booster that suddenly draws 7 cards instead of 14 means the
// picks collapsed, which is the failure mode that silently halves a whole break's EV.
// `prerelease` is left out: some sets model the config as the promo card alone and put the
// kit's boosters beside it, others model it as a whole booster.
const PACK_SIZE = {
  // Collector boosters run short in the small sets: ACR holds 10, MAT's epilogue set 6.
  play: [13.5, 14.5], draft: [14.5, 20.5], set: [11, 15.5], collector: [5.5, 16.5],
  jumpstart: [19.5, 20.5], theme: [34.5, 35.5], "box-topper": [0.9, 2.1],
};
test("one booster of each type draws the number of cards that type physically holds", () => {
  const bad = [];
  for (const [set, p] of every()) {
    const codes = Object.keys(p.packs);
    if (codes.length !== 1 || p.packs[codes[0]] !== 1 || (p.fixed || []).length) continue;
    const family = codes[0].replace(/-(?!topper).*$/, "");
    const range = PACK_SIZE[family];
    if (!range) continue; // one-off boosters (chocobo, epilogue, value) have no shared law
    if (/sample/.test(codes[0])) continue; // a sample pack is a short collector booster by design
    const n = cardCount(drawsFor(set, p).draws);
    if (n < range[0] || n > range[1]) bad.push(`${set}/${p.key} (${codes[0]}) draws ${n.toFixed(2)}, expected ${range.join("-")}`);
  }
  assert.deepEqual(bad, []);
});

// A box topper is one card per box, not per pack, and it has to survive the box → pack
// roll-out being available: the box carries it, the packs do not.
test("a box topper rides on the box, once per box", () => {
  const boxes = [];
  for (const [set, p] of every()) {
    const topper = Object.keys(p.packs).find((k) => k.startsWith("box-topper"));
    if (!topper || /case|topper-pack/.test(p.key)) continue;
    boxes.push(`${set}/${p.key}`);
    // One per box, except VOW, whose Collector box MTGJSON records as holding two.
    assert.equal(p.packs[topper], set === "VOW" && /collector/.test(p.key) ? 2 : 1,
      `${set}/${p.key} carries ${p.packs[topper]} box toppers`);
    const packRows = (p.contains || []).filter((c) => c.product && /pack/.test(c.product));
    assert.ok(packRows.length, `${set}/${p.key} rolls out to no packs`);
  }
  assert.ok(boxes.length >= 10, `expected the topper-era boxes, found ${boxes.join(", ")}`);
});

// Nothing may price as nothing without saying so: a product either draws cards, or its
// shortfall is in `unpriced` (a pack from a set with no file), or it is prose only.
test("no product silently draws nothing", () => {
  const bad = [];
  for (const [set, p] of every()) {
    const { draws, unpriced } = drawsFor(set, p);
    const prose = !Object.keys(p.packs).length && !(p.fixed || []).length;
    if (!prose && cardCount(draws) === 0 && !unpriced) bad.push(`${set}/${p.key}`);
  }
  assert.deepEqual(bad, []);
});

// Known upstream shortfalls, with what each costs. Pinned so a build that quietly grows
// the list fails, and so a fixed one shows up as a stale entry rather than a silence.
// HOB: MTGJSON's contents name booster codes (`bundle-promo`, `prerelease`) that its own
// `booster` map does not define. ONE/WOE/BRO/DMU/SNC: dangling card uuids on The List and
// on Phyrexian-treatment sheets, recorded per sheet as `missing`.
const KNOWN_UNPRICED = {
  "HOB/bundle": 1, "HOB/bundle-case": 6, "HOB/gift-bundle": 1, "HOB/gift-bundle-case": 6,
  "HOB/prerelease-case": 15, "HOB/prerelease-pack": 1,
};
test("the sets carrying an upstream shortfall are the ones we already know about", () => {
  const whole = [], partial = [];
  for (const [set, p] of every()) {
    const { unpriced } = drawsFor(set, p);
    if (unpriced <= 0.005) continue;
    (Number.isInteger(unpriced) ? whole : partial).push(`${set}/${p.key}`);
    if (Number.isInteger(unpriced)) assert.equal(unpriced, KNOWN_UNPRICED[`${set}/${p.key}`],
      `${set}/${p.key} is short ${unpriced} whole packs`);
  }
  assert.deepEqual(whole.sort(), Object.keys(KNOWN_UNPRICED).sort());
  // Fractional shortfalls are sheet weight whose card no set file resolves.
  const sets = [...new Set(partial.map((k) => k.split("/")[0]))].sort();
  assert.deepEqual(sets, ["BRO", "DMU", "ONE", "SNC", "WOE"]);
});

// A case is its boxes, a box is its packs — the ladder the roll-out walks. Every step
// has to multiply out to the same boosters the parent already counted.
test("a case rolls out to children that hold exactly the case's boosters", () => {
  const bad = [];
  for (const [set, p, doc] of every()) {
    if (!/case$/.test(p.key) || !(p.contains || []).length) continue;
    const byKey = new Map(doc.products.map((x) => [x.key, x]));
    const rolled = {};
    for (const c of p.contains) {
      const child = c.product && byKey.get(c.product);
      const packs = child ? child.packs : c.pack ? { [c.pack]: 1 } : {};
      for (const [code, n] of Object.entries(packs)) rolled[code] = (rolled[code] || 0) + n * (c.n || 1);
    }
    if (!Object.keys(rolled).length) continue; // deck- or prose-only child
    for (const [code, n] of Object.entries(p.packs)) {
      if (Math.abs((rolled[code] || 0) - n) > 1e-9) bad.push(`${set}/${p.key} ${code}: whole=${n} rolled=${rolled[code] || 0}`);
    }
  }
  assert.deepEqual(bad, []);
});
