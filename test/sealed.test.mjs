// Sealed-product contents model: expected copies per unit, and pricing those copies.
// Fixtures mirror real shapes from data/sealed/: the SOS Codex Bundle (composite product
// whose Codex Booster draws 2 of 6 foil SOC cards) and the ONE Compleat Bundle
// (guaranteed cards plus a booster of oil-slick basics and 2-of-20 mythics).
import test from "node:test";
import assert from "node:assert/strict";
import { loadPure } from "./extract.mjs";
import { expectedPicks, keyFor, labelFor } from "../tools/build-sealed.mjs";

const { productDraws, evFromDraws, dominantPackType } = loadPure();
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

test("keyFor/labelFor: the set-name prefix goes, including its dropped punctuation", () => {
  assert.equal(keyFor("Secrets of Strixhaven Codex Bundle", "Secrets of Strixhaven"), "codex-bundle");
  // Products drop the set name's colon: "Avatar: The Last Airbender" -> "Avatar The ..."
  assert.equal(keyFor("Avatar The Last Airbender Commanders Bundle", "Avatar: The Last Airbender"), "commanders-bundle");
  assert.equal(labelFor("Avatar The Last Airbender Commanders Bundle", "Avatar: The Last Airbender"), "Commanders Bundle");
  assert.equal(keyFor("—", "Secrets of Strixhaven"), "product"); // never an empty key
});
