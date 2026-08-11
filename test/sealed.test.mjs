// Sealed-product contents model: expected copies per unit, and pricing those copies.
// Fixtures mirror real shapes from data/sealed/: the SOS Codex Bundle (composite product
// whose Codex Booster draws 2 of 6 foil SOC cards) and the ONE Compleat Bundle
// (guaranteed cards plus a booster of oil-slick basics and 2-of-20 mythics).
import test from "node:test";
import assert from "node:assert/strict";
import { loadPure } from "./extract.mjs";
import { expectedPicks, keyFor, labelFor, buildSet, shortCount } from "../tools/build-sealed.mjs";

const { productDraws, evFromDraws, dominantPackType, rollOut, drawSpecOf, itemKind, itemRef, itemFoil, packLabel } = loadPure();
const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} != ${b}`);
const copiesOf = (draws, set, cn) => draws.filter(d => d.set === set && d.cn === cn).reduce((a, d) => a + d.copies, 0);

const SOS = {
  boosters: {
    "codex-bundle": { picks: { codexArtifact: 2 },
      sheets: { codexArtifact: { foil: true, total: 6, cards: [["SOC","427",1],["SOC","428",1],["SOC","429",1],["SOC","430",1],["SOC","431",1],["SOC","432",1]] } } },
    play: { picks: { rareMythic: 1 }, sheets: { rareMythic: { foil: false, total: 4, cards: [["101",3],["102",1]] } } },
    collector: { picks: { foilRareMythic: 1 }, sheets: { foilRareMythic: { foil: true, total: 2, cards: [["101",1],["102",1]] } } },
  },
  product: { key: "codex-bundle", packs: { "codex-bundle": 1, play: 6, collector: 2 } },
};

test("productDraws: a composite product expands every booster it contains", () => {
  const { draws, unpriced } = productDraws(SOS.product, SOS.boosters, "SOS");
  near(unpriced, 0);
  // Codex Booster: 2 picks over a 6-card sheet of equal weight = 1/3 of each card.
  for (const cn of ["427","428","429","430","431","432"]) near(copiesOf(draws, "SOC", cn), 2 / 6);
  // 6 Play Boosters, one rare each, weights 3:1 over the sheet.
  near(copiesOf(draws, "SOS", "101"), 6 * 3 / 4 + 2 * 1 / 2);
  near(copiesOf(draws, "SOS", "102"), 6 * 1 / 4 + 2 * 1 / 2);
  // Total expected cards = 2 codex + 6 play rares + 2 collector foils.
  near(draws.reduce((a, d) => a + d.copies, 0), 10);
});

test("productDraws: foil and nonfoil copies of one card stay separate draws", () => {
  const { draws } = productDraws(SOS.product, SOS.boosters, "SOS");
  const foil = draws.find(d => d.set === "SOS" && d.cn === "101" && d.foil);
  const plain = draws.find(d => d.set === "SOS" && d.cn === "101" && !d.foil);
  near(foil.copies, 1);       // 2 collector packs * 1/2
  near(plain.copies, 4.5);    // 6 play packs * 3/4
});

test("productDraws: guaranteed cards count, and foreign packs are reported unpriced", () => {
  const p = { packs: { play: 1, "XYZ:play": 2 }, fixed: [{ set: "ONE", cn: "283", n: 1, foil: true }] };
  const { draws, unpriced } = productDraws(p, SOS.boosters, "SOS");
  near(copiesOf(draws, "ONE", "283"), 1);
  assert.equal(draws.find(d => d.cn === "283").foil, true);
  near(unpriced, 2); // no config for another set's packs — disclosed, not dropped
});

test("productDraws: a borrowed pack uses its own set's collation, and its own set for bare card numbers", () => {
  const p = { packs: { play: 1, "XYZ:play": 2 } };
  const foreign = { XYZ: { play: { picks: { r: 1 }, sheets: { r: { foil: false, total: 2, cards: [["55", 1], ["56", 1]] } } } } };
  const { draws, unpriced } = productDraws(p, SOS.boosters, "SOS", foreign);
  near(unpriced, 0);
  near(copiesOf(draws, "XYZ", "55"), 2 * 1 / 2);
  near(copiesOf(draws, "SOS", "101"), 3 / 4);
});

test("productDraws: a sheet's unresolvable weight is disclosed, and never reweights the rest", () => {
  const boosters = { play: { picks: { s: 1 }, sheets: { s: { foil: false, total: 4, cards: [["101",1]], missing: 3 } } } };
  const { draws, unpriced } = productDraws({ packs: { play: 4 } }, boosters, "SOS");
  near(copiesOf(draws, "SOS", "101"), 4 * 1 / 4);  // keeps its true 1-in-4 odds
  near(unpriced, 3);
});

test("evFromDraws: foil draws take the foil price, falling back to nonfoil", () => {
  const index = new Map([
    ["SOS|101", { id: "a", u: 2, f: 10 }],
    ["SOS|102", { id: "b", u: 5, f: null }],
  ]);
  const draws = [
    { set: "SOS", cn: "101", copies: 0.5, foil: true },
    { set: "SOS", cn: "102", copies: 2, foil: true },
    { set: "SOS", cn: "999", copies: 1.5, foil: false },
  ];
  const r = evFromDraws(draws, index, 0);
  near(r.contributors.find(c => c.card.id === "a").ev, 5);   // 0.5 * foil 10
  near(r.contributors.find(c => c.card.id === "b").ev, 10);  // 2 * nonfoil 5, no foil price
  near(r.unmatched, 1.5);                                    // printing absent from the pool
});

test("evFromDraws: the threshold excludes value without dropping the copies", () => {
  const index = new Map([["S|1", { id: "a", u: 0.25, f: null }], ["S|2", { id: "b", u: 40, f: null }]]);
  const draws = [{ set: "S", cn: "1", copies: 4, foil: false }, { set: "S", cn: "2", copies: 1, foil: false }];
  const r = evFromDraws(draws, index, 1);
  near(r.excluded, 1);
  near(r.contributors.find(c => c.card.id === "a").ev, 0);
  near(r.contributors.find(c => c.card.id === "a").copies, 4);
  near(r.contributors.find(c => c.card.id === "b").ev, 40);
});

test("dominantPackType: the booster a composite product holds most of", () => {
  assert.equal(dominantPackType({ "codex-bundle": 1, play: 6, collector: 2 }), "play");
  assert.equal(dominantPackType({ collector: 12 }), "collector");
  assert.equal(dominantPackType({ "SPG:play": 9, collector: 1 }), "play"); // foreign key keeps its type
  assert.equal(dominantPackType({}), "play");
});

test("expectedPicks: weighted pack variants average to expected cards per sheet", () => {
  const config = { boostersTotalWeight: 4, boosters: [
    { weight: 3, contents: { common: 6, wildcard: 1 } },
    { weight: 1, contents: { common: 5, specialGuest: 1, wildcard: 1 } },
  ] };
  const p = expectedPicks(config);
  near(p.common, 5.75);
  near(p.wildcard, 1);
  near(p.specialGuest, 0.25);
});

test("expectedPicks: totalWeight is derived when MTGJSON omits it", () => {
  const p = expectedPicks({ boosters: [{ weight: 1, contents: { a: 2 } }, { weight: 1, contents: { a: 4 } }] });
  near(p.a, 3);
});

// ===== rolling a sealed product out into its contents =====

const CODEX_CONTAINS = [
  { pack: "codex-bundle", n: 1 },
  { product: "play-booster-pack", n: 6 },
  { product: "collector-booster-pack", n: 2 },
  { card: "SOC:427", foil: true, n: 1 },
  { deck: "Codex Land Pack", n: 1, fixed: [{ set: "SOS", cn: "300", n: 5, foil: false }] },
  { other: "20 Foil basic lands", n: 1 },
];

test("rollOut: contents are multiplied by the line's quantity and keep what they came out of", () => {
  const rows = rollOut({ set: "SOS", key: "codex-bundle", qty: 3, ub: false }, { contains: CODEX_CONTAINS });
  assert.deepEqual(rows.map(r => [r.key, r.qty]), [
    ["pack:codex-bundle", 3],
    ["play-booster-pack", 18],
    ["collector-booster-pack", 6],
    ["card:SOC:427:f", 3],
    ["deck:Codex Land Pack", 3],
    ["other:20 Foil basic lands", 3],
  ]);
  // Cost is read from the sealed product actually bought, at the quantity bought, so every
  // row carries it — three bundles, not eighteen loose packs.
  for (const r of rows) { assert.equal(r.of, "codex-bundle"); assert.equal(r.ofQty, 3); }
});

test("rollOut: a case opened to boxes keeps the case as the origin when a box is opened again", () => {
  const box = rollOut({ set: "SOS", key: "play-booster-box-case", qty: 1 }, { contains: [{ product: "play-booster-box", n: 6 }] })[0];
  const packs = rollOut(box, { contains: [{ product: "play-booster-pack", n: 30 }] });
  assert.equal(packs.length, 1);
  assert.equal(packs[0].qty, 180);
  assert.equal(packs[0].of, "play-booster-box-case", "the case is still what was paid for");
  assert.equal(packs[0].ofQty, 1);
});

test("itemKind/itemRef/itemFoil: a line item's key says what it is, so nothing else has to be stored", () => {
  assert.equal(itemKind("play-box"), "product");
  assert.equal(itemKind("pack:FDN:play"), "pack");
  assert.equal(itemRef("pack:FDN:play"), "FDN:play");
  assert.equal(itemKind("card:ONE:283:f"), "card");
  assert.equal(itemRef("card:ONE:283:f"), "ONE:283");
  assert.equal(itemFoil("card:ONE:283:f"), true);
  assert.equal(itemFoil("card:ONE:283"), false);
  assert.equal(itemKind("other:1 Spindown die"), "other");
});

test("drawSpecOf: a rolled-out pack draws that one booster, and a card is guaranteed", () => {
  const { draws } = productDraws(drawSpecOf({ key: "pack:play" }, null), SOS.boosters, "SOS");
  near(copiesOf(draws, "SOS", "101"), 3 / 4);   // one Play Booster, not the bundle's six
  const card = productDraws(drawSpecOf({ key: "card:SOC:427:f" }, null), SOS.boosters, "SOS");
  assert.deepEqual(card.draws, [{ set: "SOC", cn: "427", copies: 1, foil: true }]);
  // Prose has no card list, so it draws nothing rather than guessing at one.
  assert.deepEqual(productDraws(drawSpecOf({ key: "other:20 Foil basic lands" }, null), SOS.boosters, "SOS").draws, []);
  // A deck's cards live on the product it came out of, and are passed in.
  const deck = productDraws(drawSpecOf({ key: "deck:Codex Land Pack" }, null, [{ set: "SOS", cn: "300", n: 5, foil: false }]), SOS.boosters, "SOS");
  near(copiesOf(deck.draws, "SOS", "300"), 5);
});

test("packLabel: a booster code reads as its product name", () => {
  assert.equal(packLabel("play"), "Play Booster");
  assert.equal(packLabel("FDN:play"), "FDN Play Booster");
  assert.equal(packLabel("prerelease-abzan"), "Prerelease Booster (abzan)");
});

// ===== MTGJSON contents defects the builder has to catch =====

test("buildSet: a booster named both generically and by variant is one booster, not two", () => {
  // The shape Avatar ships: one node lists `prerelease` and `prerelease-aang` together.
  const data = {
    code: "TST", name: "Testline", releaseDate: "2025-01-01",
    booster: { play: { boosters: [{ weight: 1, contents: { s: 1 } }], boostersTotalWeight: 1, sheets: { s: { totalWeight: 1, cards: { u1: 1 } } } },
      "prerelease": { boosters: [{ weight: 1, contents: { s: 1 } }], boostersTotalWeight: 1, sheets: { s: { totalWeight: 1, cards: { u1: 1 } } } },
      "prerelease-aang": { boosters: [{ weight: 1, contents: { s: 1 } }], boostersTotalWeight: 1, sheets: { s: { totalWeight: 1, cards: { u1: 1 } } } } },
    cards: [{ uuid: "u1", number: "1", setCode: "TST" }],
    sealedProduct: [{ uuid: "p1", name: "Testline Prerelease Pack Aang", category: "limited_aid_tool",
      contents: { pack: [{ code: "prerelease", set: "tst" }, { code: "prerelease-aang", set: "tst" }] } }],
  };
  const out = buildSet(data);
  assert.deepEqual(out.products[0].packs, { "prerelease-aang": 1 });
});

test("buildSet: a Collector Sample Pack is its own product, never a variant of a Collector Booster", () => {
  const cfg = { boosters: [{ weight: 1, contents: { s: 1 } }], boostersTotalWeight: 1, sheets: { s: { totalWeight: 1, cards: { u1: 1 } } } };
  const data = {
    code: "TST", name: "Testline", releaseDate: "2025-01-01",
    booster: { collector: cfg, "collector-sample": cfg },
    cards: [{ uuid: "u1", number: "1", setCode: "TST" }],
    sealedProduct: [{ uuid: "p1", name: "Testline Deck", category: "deck",
      contents: { pack: [{ code: "collector", set: "tst" }, { code: "collector-sample", set: "tst" }] } }],
  };
  assert.deepEqual(buildSet(data).products[0].packs, { collector: 1, "collector-sample": 1 });
});

test("shortCount: a product holding fewer units than its name declares says so", () => {
  assert.match(shortCount({ name: "Final Fantasy Scene Box Set of 4", contents: { sealed: [{ count: 1 }] } }),
    /lists 1 of the 4 units/);
  assert.equal(shortCount({ name: "Scene Box Set of 4", contents: { sealed: [{ count: 4 }] } }), null);
  assert.equal(shortCount({ name: "Retail Tins Set of 3", contents: { sealed: [{ count: 1 }, { count: 1 }, { count: 1 }] } }), null);
  assert.equal(shortCount({ name: "Play Booster Box", contents: { sealed: [{ count: 30 }] } }), null);
});

test("keyFor/labelFor: the set-name prefix goes, including its dropped punctuation", () => {
  assert.equal(keyFor("Secrets of Strixhaven Codex Bundle", "Secrets of Strixhaven"), "codex-bundle");
  // Products drop the set name's colon: "Avatar: The Last Airbender" -> "Avatar The ..."
  assert.equal(keyFor("Avatar The Last Airbender Commanders Bundle", "Avatar: The Last Airbender"), "commanders-bundle");
  assert.equal(labelFor("Avatar The Last Airbender Commanders Bundle", "Avatar: The Last Airbender"), "Commanders Bundle");
  assert.equal(keyFor("—", "Secrets of Strixhaven"), "product"); // never an empty key
});
