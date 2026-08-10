// S3d: cost/fee model, comp URL codec, and computeEV(minValue) — owner feedback
// 2026-08-10 items 3/5/7/9/10.
import test from "node:test";
import assert from "node:assert/strict";
import { loadPure } from "./extract.mjs";

const P = loadPure();
const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) <= eps, `${a} !~= ${b}`);

const DEFAULT_FEES = { commissionPct: 8, procPct: 2.9, procFlat: 0.30, buyerSH: 4.99, fulfillment: 2.00 };

// ---- orderNet (item 3 AC) ----
test("orderNet: item 3 acceptance case, $20 hammer / $4.99 S&H / $2 fulfillment", () => {
  // 20 - (0.08*20) - (0.029*24.99 + 0.30) - 2.00 + 4.99 = 20.36529
  near(P.orderNet(20, DEFAULT_FEES), 20.36529);
});

test("orderNet: zero hammer still nets buyer S&H minus flat processing minus fulfillment", () => {
  // 0 - 0 - (0.029*4.99 + 0.30) - 2 + 4.99 = 2.5307... exact:
  const processing = 0.029 * 4.99 + 0.30;
  near(P.orderNet(0, DEFAULT_FEES), 0 - processing - 2 + 4.99);
});

// ---- compBreakEven (inverse of orderNet, with a floor at 0) ----
// n singleton orders with no per-order overrides == the old integer-count model (ADR 0001).
const ordersOf = (n) => Array.from({ length: n }, () => ({}));

test("compBreakEven: unclamped round-trip recovers cost via orderNet", () => {
  for (const cost of [100, 5000, 1_000_000]) {
    for (const n of [1, 8, 20]) {
      const be = P.compBreakEven(cost, ordersOf(n), DEFAULT_FEES);
      const recovered = n * P.orderNet(be / n, DEFAULT_FEES);
      assert.ok(Math.abs(recovered - cost) < 1e-6, `cost=${cost} n=${n}: recovered ${recovered}`);
    }
  }
});

test("compBreakEven: clamps to 0 rather than going negative (buyer S&H exceeds fulfillment)", () => {
  assert.equal(P.compBreakEven(0, ordersOf(8), DEFAULT_FEES), 0);
});

test("compBreakEven: cost 0 round-trips when per-order fee balance is negative", () => {
  const highFulfillment = { ...DEFAULT_FEES, fulfillment: 8.00 };
  const be = P.compBreakEven(0, ordersOf(8), highFulfillment);
  const recovered = 8 * P.orderNet(be / 8, highFulfillment);
  near(recovered, 0, 1e-6);
});

test("compBreakEven: keep <= 0 (fees consume the whole order) is Infinity", () => {
  const crushingFees = { commissionPct: 90, procPct: 20, procFlat: 0, buyerSH: 0, fulfillment: 0 };
  assert.equal(P.compBreakEven(1000, ordersOf(5), crushingFees), Infinity);
});

test("compBreakEven: per-order buyerSH/fulfillment overrides change the break-even (ADR 0001)", () => {
  const baseline = P.compBreakEven(1000, ordersOf(2), DEFAULT_FEES);
  const overridden = P.compBreakEven(
    1000,
    [{ buyerSH: 0, fulfillment: null }, { buyerSH: null, fulfillment: 0 }],
    DEFAULT_FEES
  );
  assert.notEqual(overridden, baseline);
});

// ---- chooseBasis (item 7) ----
test("chooseBasis: forced sealed/packs honored when the forced value exists", () => {
  assert.deepEqual(P.chooseBasis(100, 50, "sealed"), { cost: 100, basis: "sealed", forced: true });
  assert.deepEqual(P.chooseBasis(100, 50, "packs"), { cost: 50, basis: "packs", forced: true });
});

test("chooseBasis: forced value missing falls through to whatever basis is available", () => {
  assert.deepEqual(P.chooseBasis(null, 50, "sealed"), { cost: 50, basis: "packs", forced: false });
  assert.deepEqual(P.chooseBasis(100, null, "packs"), { cost: 100, basis: "sealed", forced: false });
});

test("chooseBasis: no force — sealed wins over packs when both present, packs is the fallback", () => {
  assert.deepEqual(P.chooseBasis(100, 50, ""), { cost: 100, basis: "sealed", forced: false });
  assert.deepEqual(P.chooseBasis(null, 50, ""), { cost: 50, basis: "packs", forced: false });
  assert.deepEqual(P.chooseBasis(null, null, ""), { cost: null, basis: "none", forced: false });
});

test("chooseBasis: sealedCost 0 is a real cost, not treated as missing", () => {
  assert.deepEqual(P.chooseBasis(0, 50, ""), { cost: 0, basis: "sealed", forced: false });
});

// ---- encodeComp / decodeComp / legacyComp (item 5 URL codec) ----
test("encodeComp/decodeComp round-trip: own-set item, no ub flag", () => {
  const items = [{ set: "EOE", key: "play-box", qty: 2, ub: false }];
  assert.deepEqual(P.decodeComp(P.encodeComp(items)), items);
});

test("encodeComp/decodeComp round-trip: ub flag set", () => {
  const items = [{ set: "EOE", key: "play-box", qty: 1, ub: true }];
  assert.deepEqual(P.decodeComp(P.encodeComp(items)), items);
});

test("encodeComp/decodeComp round-trip: multiple line items across sets", () => {
  const items = [
    { set: "EOE", key: "play-box", qty: 2, ub: false },
    { set: "TDM", key: "collector-pack", qty: 1, ub: true },
    { set: "FIN", key: "bundle", qty: 9, ub: false },
  ];
  assert.deepEqual(P.decodeComp(P.encodeComp(items)), items);
});

test("decodeComp: malformed segments (missing qty, non-numeric qty, qty 0) are dropped", () => {
  assert.deepEqual(P.decodeComp("EOE.play-box~TDM.collector-pack.x~EOE.set-box.0"), []);
});

test("decodeComp: qty is clamped to 99", () => {
  assert.deepEqual(P.decodeComp("EOE.play-box.500"), [{ set: "EOE", key: "play-box", qty: 99, ub: false }]);
});

test("decodeComp: empty string yields empty array", () => {
  assert.deepEqual(P.decodeComp(""), []);
});

test("legacyComp: maps old ?set=&preset= links to the v2 comp shape", () => {
  assert.deepEqual(P.legacyComp("eoe", "play"), [{ set: "EOE", key: "play-box", qty: 1, ub: false }]);
  assert.deepEqual(P.legacyComp("eoe", "playUB"), [{ set: "EOE", key: "play-box", qty: 1, ub: true }]);
  assert.deepEqual(P.legacyComp("eoe", "set"), [{ set: "EOE", key: "set-box", qty: 1, ub: false }]);
  assert.deepEqual(P.legacyComp("eoe", "draft"), [{ set: "EOE", key: "draft-box", qty: 1, ub: false }]);
  assert.deepEqual(P.legacyComp("eoe", "collector"), [{ set: "EOE", key: "collector-box", qty: 1, ub: false }]);
  assert.deepEqual(P.legacyComp("eoe", "unknown-preset"), [{ set: "EOE", key: "play-box", qty: 1, ub: false }]);
  assert.deepEqual(P.legacyComp("", "play"), []);
});

// ---- computeEV (item 9: minValue threshold replaces the $1 floor) ----
// Minimal model: 1 common slot/pack, everything else zeroed out so only the
// common pool is in play; two commons, no treatment weighting.
function makeModel() {
  return {
    commons: 1, uncommons: 0, rareSlots: 0, mythicPct: 0,
    wildcards: 0, wcCommonPct: 0, wcUncommonPct: 0, wcRareMythicPct: 0,
    foilWildcards: 0, landSlot: 0, landFoilPct: 0, sgRate: 0,
  };
}
function makeCard(id, u, bucket = "R") {
  return { id, name: id, cn: 1, rarity: "common", bucket, basic: false, treat: false, u, f: null, set: "EOE", cnRaw: "1" };
}

test("computeEV: minValue omitted means no floor — every priced card counts", () => {
  const pool = [makeCard("cheap", 0.5), makeCard("pricey", 5)];
  const { contributors, excluded } = P.computeEV(pool, [], makeModel(), 1);
  near(excluded, 0);
  const ids = contributors.map(c => c.card.id).sort();
  assert.deepEqual(ids, ["cheap", "pricey"]);
  const total = contributors.reduce((a, c) => a + c.ev, 0);
  near(total, 0.5 * 0.5 + 0.5 * 5);
});

test("computeEV: minValue excludes cards below it, tracked in `excluded`, absent from contributors", () => {
  const pool = [makeCard("cheap", 0.5), makeCard("pricey", 5)];
  const { contributors, excluded } = P.computeEV(pool, [], makeModel(), 1, 1);
  assert.deepEqual(contributors.map(c => c.card.id), ["pricey"]);
  near(excluded, 0.5 * 0.5);
});

test("computeEV: a card priced exactly at minValue is included (boundary is >=)", () => {
  const pool = [makeCard("atThreshold", 2), makeCard("pricey", 5)];
  const { contributors, excluded } = P.computeEV(pool, [], makeModel(), 1, 2);
  near(excluded, 0);
  assert.deepEqual(contributors.map(c => c.card.id).sort(), ["atThreshold", "pricey"]);
});
