// S0 smoke tests: prove the @pure extraction seam works on shipped code.
import test from "node:test";
import assert from "node:assert/strict";
import { loadPure } from "./extract.mjs";

const P = loadPure();

test("cnnum parses the numeric part of a collector number", () => {
  assert.equal(P.cnnum({ collector_number: "123" }), 123);
  assert.equal(P.cnnum({ collector_number: "0042" }), 42);
  assert.equal(P.cnnum({}), 0);
});

test("bucketOf routes land / colorless / multicolor / mono", () => {
  assert.equal(P.bucketOf({ type_line: "Basic Land — Island", colors: [] }), "L");
  assert.equal(P.bucketOf({ type_line: "Artifact", colors: [] }), "C");
  assert.equal(P.bucketOf({ type_line: "Creature", colors: ["W", "U"] }), "M");
  assert.equal(P.bucketOf({ type_line: "Creature", colors: ["G"] }), "G");
});

test("verdictOf deadband is max(8% of price, $1)", () => {
  assert.deepEqual(P.verdictOf(5, 20), ["+EV", "pos"]);   // dead = 1.60, net 5 > 1.60
  assert.deepEqual(P.verdictOf(1.5, 20), ["FAIR", "fair"]); // net 1.50 <= 1.60
  assert.deepEqual(P.verdictOf(-5, 20), ["−EV", "neg"]);
  assert.deepEqual(P.verdictOf(1.01, 5), ["+EV", "pos"]);  // dead = $1 floor
});
