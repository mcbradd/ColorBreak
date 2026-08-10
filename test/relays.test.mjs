// S1: pure parts of the relay race.
import test from "node:test";
import assert from "node:assert/strict";
import { loadPure } from "./extract.mjs";

const P = loadPure();
const URLS = [
  "https://api.codetabs.com/v1/proxy?quest=https://tcgcsv.com/x",
  "https://api.allorigins.win/raw?url=https%3A%2F%2Ftcgcsv.com%2Fx",
  "https://proxy.cors.sh/https://tcgcsv.com/x",
];

test("relayHost extracts the host", () => {
  assert.equal(P.relayHost(URLS[0]), "api.codetabs.com");
  assert.equal(P.relayHost("https://proxy.cors.sh/https://tcgcsv.com/x"), "proxy.cors.sh");
  assert.equal(P.relayHost("not a url"), "");
});

test("orderRelays puts the last-good relay first, order otherwise preserved", () => {
  assert.deepEqual(P.orderRelays(URLS, "proxy.cors.sh"), [URLS[2], URLS[0], URLS[1]]);
});

test("orderRelays with no or unknown last-good is identity", () => {
  assert.deepEqual(P.orderRelays(URLS, ""), URLS);
  assert.deepEqual(P.orderRelays(URLS, "gone.example.com"), URLS);
});

test("relay race constants: 6 s per-relay timeout, stagger under it", () => {
  assert.equal(P.RELAY_TIMEOUT_MS, 6000);
  assert.ok(P.RELAY_STAGGER_MS < P.RELAY_TIMEOUT_MS);
});
