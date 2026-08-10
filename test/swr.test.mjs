// S2: stale-while-revalidate pure parts.
import test from "node:test";
import assert from "node:assert/strict";
import { loadPure } from "./extract.mjs";

const P = loadPure();
const H = 3600e3, D = 86400e3;

test("priceStamp per age bucket", () => {
  assert.equal(P.priceStamp("cached", 30 * 60e3), "STALE·30m");
  assert.equal(P.priceStamp("cached", 3 * H), "STALE·3h");     // pinned in-plan
  assert.equal(P.priceStamp("cached", 23 * H + 59e3), "STALE·23h");
  assert.equal(P.priceStamp("cached", 2 * D), "STALE·2d");     // pinned in-plan
  assert.equal(P.priceStamp("cached", 25 * H), "STALE·1d");
  assert.equal(P.priceStamp("cached", 10e3), "STALE·1m");      // floor at 1m
  assert.equal(P.priceStamp("manual", 5 * D), "MANUAL");
  assert.equal(P.priceStamp("live", 0), "LIVE");
});

test("boardPhases: cached board paints then revalidates", () => {
  assert.deepEqual(P.boardPhases({ cached: true, cachedSet: "eoe", urlSet: "" }), ["paint-cached", "revalidate"]);
  assert.deepEqual(P.boardPhases({ cached: true, cachedSet: "eoe", urlSet: "eoe" }), ["paint-cached", "revalidate"]);
});

test("boardPhases: link to a different set never shows the wrong cached board", () => {
  assert.deepEqual(P.boardPhases({ cached: true, cachedSet: "eoe", urlSet: "blb" }), ["skeleton", "fetch", "paint"]);
  assert.deepEqual(P.boardPhases({ cached: false, cachedSet: "", urlSet: "eoe" }), ["skeleton", "fetch", "paint"]);
  assert.deepEqual(P.boardPhases({ cached: false, cachedSet: "", urlSet: "" }), ["skeleton"]);
});

test("verdictCue pins the OLD→NEW on refresh form (UX5-m3)", () => {
  assert.equal(P.verdictCue("FAIR", "+EV"), "FAIR→+EV on refresh");
  assert.equal(P.verdictCue("FAIR", "FAIR"), null);
  assert.equal(P.verdictCue(null, "+EV"), null);
});

test("cueFromVerdicts reports the first changed slot only", () => {
  assert.equal(P.cueFromVerdicts(["FAIR", "FAIR"], ["FAIR", "−EV"]), "FAIR→−EV on refresh");
  assert.equal(P.cueFromVerdicts(["FAIR"], ["FAIR"]), null);
  assert.equal(P.cueFromVerdicts(null, ["FAIR"]), null);
});
