// Expert-panel re-review fixes (docs/panel-review-2026-08-10.md): F1 buyer landed
// cost, F3 restore fidelity.
import test from "node:test";
import assert from "node:assert/strict";
import { loadPure } from "./extract.mjs";

const P = loadPure();

// ---- F3: persistContributors ----
// Contributors arrive sorted by EV descending; ids encode slot + rank for readability.
function contribs(spec) {
  const out = [];
  for (const [bucket, n] of Object.entries(spec))
    for (let i = 0; i < n; i++) out.push({ card: { id: `${bucket}${i}`, bucket }, ev: 0 });
  return out;
}

test("persistContributors: keeps the top N of every slot, so no slot's drill-down is short", () => {
  // 40 Green ahead of everything: a global top-18 would save zero White cards.
  const list = [...contribs({ G: 40 }), ...contribs({ W: 12 })];
  const kept = P.persistContributors(list, 10, 18);
  const white = kept.filter(e => e.card.bucket === "W");
  assert.equal(white.length, 10, "White keeps its own top 10 despite ranking below 40 Green cards");
});

test("persistContributors: keeps the global top N even when one slot dominates it", () => {
  const list = contribs({ G: 40 });
  const kept = P.persistContributors(list, 10, 18);
  assert.equal(kept.length, 18, "global top 18 survives, not just the per-slot 10");
  assert.deepEqual(kept.slice(0, 3).map(e => e.card.id), ["G0", "G1", "G2"]);
});

test("persistContributors: preserves input EV order and never duplicates", () => {
  const list = [...contribs({ G: 5 }), ...contribs({ W: 5 }), ...contribs({ U: 5 })];
  const kept = P.persistContributors(list, 10, 18);
  assert.deepEqual(kept, list, "everything fits under both budgets, order unchanged");
  assert.equal(new Set(kept.map(e => e.card.id)).size, kept.length);
});

test("persistContributors: a slot with fewer than N contributors keeps all of them", () => {
  const list = [...contribs({ G: 30 }), ...contribs({ L: 2 })];
  const kept = P.persistContributors(list, 10, 18);
  assert.equal(kept.filter(e => e.card.bucket === "L").length, 2);
});

test("persistContributors: empty input yields empty output", () => {
  assert.deepEqual(P.persistContributors([], 10, 18), []);
});

// ---- F1: landedCost ----
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} !~= ${b}`);

test("landedCost: a standalone slot costs the bid plus one buyer S&H", () => {
  near(P.landedCost(22, 4.99, false), 26.99);
});

test("landedCost: combining into an order already paying S&H adds nothing", () => {
  assert.equal(P.landedCost(22, 4.99, true), 22);
});

test("landedCost: S&H is charged once per order, never per slot", () => {
  // Three slots combined into one order: one S&H total, not three.
  const bids = [22, 15, 8];
  const combined = bids.reduce((a, b, i) => a + P.landedCost(b, 4.99, i > 0), 0);
  near(combined, 45 + 4.99);
  const separate = bids.reduce((a, b) => a + P.landedCost(b, 4.99, false), 0);
  near(separate, 45 + 3 * 4.99);
  near(separate - combined, 2 * 4.99);
});

test("landedCost: zero bid still lands at the S&H the buyer pays", () => {
  assert.equal(P.landedCost(0, 4.99, false), 4.99);
});
