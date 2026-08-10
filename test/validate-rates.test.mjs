// S3c: published-rates validator — pure-function unit tests (inline literals, no fixture files).
import test from "node:test";
import assert from "node:assert/strict";
import { toleranceFor, computeSlotRate, computeRarityMix, computePerBox, tierOf } from "../tools/validate-rates.mjs";

test("toleranceFor: magnitude clause below threshold, isMax exempts it", () => {
  assert.ok(Math.abs(toleranceFor("perBox", 0.2, false) - 0.04) < 1e-9);
  assert.equal(toleranceFor("perBox", 0.2, true), 0.05);
  assert.equal(toleranceFor("slotRate", 2, false), 0.4);
  assert.equal(toleranceFor("slotRate", 2, true), 0.5);
  assert.equal(toleranceFor("rarityMix", 0.1), 0.5, "rarityMix is never magnitude-scaled");
});

test("computeSlotRate: selector.slot is the union, selector.sheet narrows within it", () => {
  const product = {
    layout: [
      { sheet: "a", slot: "wildcard", rate: 0.125 },
      { sheet: "b", slot: "wildcard", rate: 0.2 },
    ],
  };
  assert.equal(computeSlotRate(product, { sheet: "a", slot: "wildcard" }), 12.5);
  assert.equal(computeSlotRate(product, { slot: "wildcard" }), 32.5, "union of every entry carrying the slot");
});

test("computeRarityMix: weighted formula, and a sheet with no card of the target set is excluded entirely (DES4-02)", () => {
  const product = {
    layout: [{ sheet: "wc", slot: "wildcard", count: 1 }],
    sheets: { wc: { cards: [["1", 5], ["2", 3]] } },
  };
  const rarityIndex = new Map([["EOE/1", "uncommon"], ["EOE/2", "rare"]]);
  assert.equal(computeRarityMix(product, { slot: "wildcard", rarity: "uncommon" }, "EOE", rarityIndex), 62.5);

  const withForeignNoise = {
    layout: [...product.layout, { sheet: "foreign", slot: "wildcard", count: 1 }],
    sheets: { ...product.sheets, foreign: { cards: [["SPG", "9", 1]] } },
  };
  assert.equal(
    computeRarityMix(withForeignNoise, { slot: "wildcard", rarity: "uncommon" }, "EOE", rarityIndex),
    62.5,
    "sheet contributing no card of the target set must not dilute the denominator"
  );
});

test("computePerBox: selector.sheet 'topper' resolves via boxTopper.ratePerBox, null when no topper", () => {
  const withTopper = { layout: [], boxTopper: { sheet: "boxToppers", ratePerBox: 1 } };
  assert.equal(computePerBox(withTopper, { sheet: "topper" }, 30), 1);
  const noTopper = { layout: [], boxTopper: null };
  assert.equal(computePerBox(noTopper, { sheet: "topper" }, 30), null);
});

test("tierOf: RED with no ppb entry", () => {
  const result = tierOf("ZZZ", "play", { layout: [] }, { ppb: {} });
  assert.deepEqual(result, { tier: "RED", reason: "no ppb entry for 'play'" });
});

test("tierOf: COMPUTED when every slot is covered", () => {
  const product = { layout: [{ sheet: "commonSheet", slot: "common", count: 7 }], sheets: { commonSheet: { cards: [["1", 1]] } } };
  const sidecar = { ppb: { play: 30 }, entries: [{ product: "play", stat: "slotRate", selector: { slot: "common" }, value: 50 }] };
  assert.deepEqual(tierOf("ZZZ", "play", product, sidecar), { tier: "COMPUTED" });
});

test("tierOf: an uncovered slot is RED, until a manifest exemption flips it to COMPUTED", () => {
  const product = {
    layout: [
      { sheet: "commonSheet", slot: "common", count: 7 },
      { sheet: "wildcardSheet", slot: "wildcard", count: 1 },
    ],
    sheets: { commonSheet: { cards: [["1", 1]] }, wildcardSheet: { cards: [["2", 1]] } },
  };
  const sidecar = { ppb: { play: 30 }, entries: [{ product: "play", stat: "slotRate", selector: { slot: "common" }, value: 50 }] };
  assert.deepEqual(tierOf("ZZZ", "play", product, sidecar), { tier: "RED", reason: "uncovered: wildcard" });

  const manifest = { exemptions: [{ set: "ZZZ", product: "play", slot: "wildcard", reason: "no published data" }] };
  assert.deepEqual(tierOf("ZZZ", "play", product, sidecar, manifest), { tier: "COMPUTED" });
});
