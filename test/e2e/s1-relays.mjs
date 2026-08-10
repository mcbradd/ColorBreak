// S1 DoD (b): relay race, manual nudge, last-good persistence + G4 cold load.
import assert from "node:assert/strict";
import { launch, waitForBoard, ORIGIN, RELAY_HOSTS, sleep } from "./harness.mjs";

export async function allRelaysDown() {
  // Block every relay host: board still paints and the manual prompt shows < 15 s.
  const { browser, page } = await launch({ relays: "none" });
  const t0 = Date.now();
  await page.goto(ORIGIN + "/?set=tst&preset=play");
  await waitForBoard(page);
  await page.waitForSelector("#warn", { state: "visible", timeout: 15000 });
  const elapsed = Date.now() - t0;
  assert.ok(elapsed < 15000, `board + manual prompt took ${elapsed} ms (>= 15 s)`);
  const warn = await page.textContent("#warn");
  assert.match(warn, /Box cost \$/, "manual box-cost prompt names the field");
  const box = await page.inputValue("#boxPrice");
  assert.equal(box, "", "no sealed price should have landed");
  // sealed-price failure is non-fatal: EV board is priced
  const tev = await page.textContent("#tEV");
  assert.notEqual(tev.trim(), "—");
  await browser.close();
}

export async function oneRelayWins() {
  // Only proxy.cors.sh is up: sealed price lands, relay host persisted as last-good.
  const { browser, page } = await launch({ relays: ["proxy.cors.sh"] });
  await page.goto(ORIGIN + "/?set=tst&preset=play");
  await waitForBoard(page);
  await page.waitForFunction(() => document.getElementById("boxPrice").value !== "", null, { timeout: 20000 });
  assert.equal(await page.inputValue("#boxPrice"), "123.45");
  const remembered = await page.evaluate(() => localStorage.getItem("colorBreakEV.relay"));
  assert.equal(remembered, "proxy.cors.sh", "winning relay persisted");
  await browser.close();
}

export async function lastGoodTriedFirst() {
  // With a persisted last-good relay, its request fires before the staggered rest.
  const seen = [];
  const { browser, page } = await launch({
    onRequest: (u) => { const h = new URL(u).host; if (RELAY_HOSTS.includes(h)) seen.push(h); },
    initScript: 'localStorage.setItem("colorBreakEV.relay", "proxy.cors.sh")',
  });
  await page.goto(ORIGIN + "/?set=tst&preset=play");
  await waitForBoard(page);
  await page.waitForFunction(() => document.getElementById("boxPrice").value !== "", null, { timeout: 20000 });
  assert.ok(seen.length > 0, "relay requests observed");
  assert.equal(seen[0], "proxy.cors.sh", `last-good tried first, saw ${seen.join(",")}`);
  await browser.close();
}

export async function g4ColdLoad() {
  // G4: 4x CPU throttle + 2 s injected latency per-request on ALL hosts
  // (document, fonts, Scryfall, relays) — time to ticker verdict <= 10 s.
  const { browser, page } = await launch({ latency: 2000, cpuThrottle: 4 });
  const t0 = Date.now();
  await page.goto(ORIGIN + "/?set=tst&preset=play", { waitUntil: "commit", timeout: 30000 });
  await waitForBoard(page, 15000);
  await page.waitForFunction(() => /\+EV/.test(document.getElementById("glance").textContent), null, { timeout: 15000 });
  const elapsed = Date.now() - t0;
  assert.ok(elapsed <= 10000, `G4: time-to-ticker-verdict ${elapsed} ms > 10 s`);
  await browser.close();
}

export const scenarios = { allRelaysDown, oneRelayWins, lastGoodTriedFirst, g4ColdLoad };
