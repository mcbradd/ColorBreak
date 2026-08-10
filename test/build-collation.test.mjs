// S3a: collation format v2 builder — unit tests + fixtures.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { buildCollation, mapConfigName, defaultPpb } from "../tools/build-collation.mjs";

const here = (rel) => fileURLToPath(new URL(rel, import.meta.url));
const readJSON = (rel) => JSON.parse(readFileSync(here(rel), "utf8"));

const slotMap = readJSON("../tools/slot-map.json");
const ppbTable = readJSON("../tools/ppb.json");
const eoe = readJSON("./fixtures/mtgjson/eoe-normalized.json");

test("defaultPpb: set is always 30 regardless of date", () => {
  assert.equal(defaultPpb("set", "2020-01-01"), 30);
  assert.equal(defaultPpb("set", "2030-12-31"), 30);
});

test("defaultPpb: play crosses 36 -> 30 at the Feb-2025 DFT cutover", () => {
  assert.equal(defaultPpb("play", "2025-01-31"), 36);
  assert.equal(defaultPpb("play", "2025-02-01"), 30);
});

test("defaultPpb: draft and collector are flat", () => {
  assert.equal(defaultPpb("draft", "2026-01-01"), 36);
  assert.equal(defaultPpb("collector", "2026-01-01"), 12);
});

test("mapConfigName: default is era-dependent, drop-list never emitted", () => {
  assert.equal(mapConfigName("default", "2023-06-01"), "draft");
  assert.equal(mapConfigName("default", "2024-06-01"), "play");
  assert.equal(mapConfigName("jumpstart", "2024-06-01"), null);
  assert.equal(mapConfigName("arena", "2024-06-01"), null);
  assert.equal(mapConfigName("play", "2024-06-01"), "play");
});

test("build: MTGJSON default-config snippet lands in the pinned v2 key; jumpstart absent (DES5-05)", () => {
  const defaultConfigSample = readJSON("./fixtures/mtgjson/default-config-sample.json");
  const zzzSlotMap = { ZZZ: { play: { slots: { commonSheet: "common" }, topper: null } } };
  const out = buildCollation(defaultConfigSample, zzzSlotMap, ppbTable);
  assert.ok(out.products.play, "'default' (2024+ release) must map to 'play'");
  assert.equal(out.products.jumpstart, undefined, "jumpstart must never be emitted");
  assert.equal(Object.keys(out.products).length, 1);
});

test("build: real MTGJSON per-set shape (code/releaseDate/booster/cards nested under `data`) resolves set + products", () => {
  const nested = readJSON("./fixtures/mtgjson/zzz-nested-data.json");
  const zzzSlotMap = { ZZZ: { play: { slots: { commonSheet: "common" }, topper: null } } };
  const out = buildCollation(nested, zzzSlotMap, ppbTable);
  assert.equal(out.set, "ZZZ");
  assert.equal(Object.keys(out.products).length, 1, "'default' config must resolve to a real product, not be silently dropped");
  assert.ok(out.products.play, "2025-01-10 release is >= 2024-01-01 cutover, so 'default' maps to 'play'");
  assert.equal(out.src.mtgjsonVersion, "5.2.1+fixture");
  // Pin actual card content, not just "didn't crash": the reported bug was silent EMPTY
  // output, so proving cards[] -> uuid -> [cn, weight] resolved correctly matters as much
  // as proving `set`/`products` are populated.
  assert.deepEqual(out.products.play.sheets.commonSheet.cards, [["1", 1]]);
});

test("build: EOE play topper is SPG cross-set and multi-card", () => {
  const out = buildCollation(eoe, slotMap, ppbTable);
  const topper = out.products.play.boxTopper;
  assert.deepEqual(topper, { sheet: "boxToppers", ratePerBox: 1 });
  const topperCards = out.products.play.sheets.boxToppers.cards;
  assert.equal(topperCards.length, 2, "multi-card topper");
  for (const card of topperCards) {
    assert.equal(card.length, 3, "foreign card triple is [setCode, cn, weight]");
    assert.equal(card[0], "SPG", "topper cards are cross-set (SPG)");
  }
});

test("build: collector product has no topper -> boxTopper null", () => {
  const out = buildCollation(eoe, slotMap, ppbTable);
  assert.equal(out.products.collector.boxTopper, null);
});

test("build: home-set cards omit setCode (2-element triple)", () => {
  const out = buildCollation(eoe, slotMap, ppbTable);
  const commonCards = out.products.play.sheets.commonSheet.cards;
  assert.ok(commonCards.length > 0);
  for (const card of commonCards) assert.equal(card.length, 2, "[cn, weight] when same-set");
});

test("build: fixed per-pack count vs variable rate", () => {
  const out = buildCollation(eoe, slotMap, ppbTable);
  const bySheet = Object.fromEntries(out.products.play.layout.map((l) => [l.sheet, l]));
  assert.equal(bySheet.commonSheet.count, 7, "single booster variant -> fixed count");
  assert.equal(bySheet.wildcardSheet.slot, "wildcard");
});

test("build: a sheet that contributes cards with no slot-map entry is a build failure", () => {
  const noWildcard = { EOE: { play: { slots: { commonSheet: "common" }, topper: { sheet: "boxToppers", ratePerBox: 1 } } } };
  assert.throws(() => buildCollation(eoe, noWildcard, ppbTable), /no slot-map entry/);
});

test("build: ppb reflects DFT cutover for the fixture's 2025-07-25 release", () => {
  const out = buildCollation(eoe, slotMap, ppbTable);
  assert.equal(out.ppb.play, 30);
  assert.equal(out.ppb.collector, 12);
});

test("build: src provenance carries mtgjsonVersion/mtgjsonDate/builtAt", () => {
  const out = buildCollation(eoe, slotMap, ppbTable);
  assert.equal(out.src.mtgjsonVersion, "5.2.1+fixture");
  assert.equal(out.src.mtgjsonDate, "2025-07-20");
  assert.ok(out.src.builtAt);
});

test("published-rates sidecar: FOUR EOE worked examples, one per stat shape (schema frozen)", () => {
  const sidecar = readJSON("./fixtures/published-rates/eoe.json");
  assert.equal(sidecar.entries.length, 4);
  const [slotRate, perBox, rarityMixValue, rarityMixMax] = sidecar.entries;
  assert.deepEqual(slotRate, { product: "play", stat: "slotRate", selector: { sheet: "stellarSights", slot: "wildcard" }, value: 12.5 });
  assert.deepEqual(perBox, { product: "play", stat: "perBox", selector: { sheet: "topper" }, value: 1 });
  assert.deepEqual(rarityMixValue, { product: "play", stat: "rarityMix", selector: { slot: "wildcard", rarity: "uncommon" }, value: 62.5 });
  assert.deepEqual(rarityMixMax, { product: "play", stat: "rarityMix", selector: { slot: "wildcard", rarity: "mythic" }, max: 1 });
  // slot-only resolution: an entry addresses a slot label only via selector.slot, never bare sheet name.
  assert.ok(!("slot" in perBox.selector), "perBox entry has no slot word -> doesn't satisfy any slot label");
});

test("MANIFEST schema: exemptions + consistency shape frozen", () => {
  const manifest = readJSON("./fixtures/manifest/MANIFEST.sample.json");
  assert.ok(Array.isArray(manifest.exemptions));
  assert.ok(Array.isArray(manifest.consistency));
  assert.deepEqual(Object.keys(manifest.consistency[0]).sort(), ["date", "offsetNote", "product", "set", "source"]);
  assert.equal(manifest.consistency[0].source, "TEV");
});

test("file size budget: every collation file stays under 40KB (§3.2)", () => {
  const under40k = (rel) => assert.ok(readFileSync(here(rel)).length < 40 * 1024, `${rel} must be < 40KB`);
  under40k("../tools/ppb.json");
  under40k("../tools/slot-map.json");
  const out = buildCollation(eoe, slotMap, ppbTable);
  assert.ok(Buffer.byteLength(JSON.stringify(out)) < 40 * 1024, "built collation output must be < 40KB");
});
