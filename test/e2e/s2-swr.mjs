// S2 DoD (b): cached paint < 1 s with age stamp, layout-stable background
// refresh, pinned changed-verdict cue lifecycle, MANUAL stamp, second-tap no-op.
import assert from "node:assert/strict";
import { launch, waitForBoard, ORIGIN, sleep } from "./harness.mjs";

const LS_KEY = "colorBreakEV.v2";
const parseMoney = (t) => parseFloat(t.replace(/[^0-9.\-]/g, ""));

// Run once against v1 prices, pin the U slot price at its EV (verdict FAIR),
// return the captured localStorage state with fetchedAt aged 3 h.
async function seedState() {
  const { browser, page } = await launch({ bluePrice: 12 });
  await page.goto(ORIGIN + "/?set=tst&preset=play");
  await waitForBoard(page);
  await page.waitForFunction(() => document.getElementById("boxPrice").value !== "", null, { timeout: 20000 });
  const uEV = parseMoney(await page.textContent('#slotBody tr[data-slot="U"] .c-ev'));
  assert.ok(uEV > 0, "U slot EV parsed");
  await page.fill('#slotBody tr[data-slot="U"] .c-price input', String(uEV));
  await page.waitForFunction(() =>
    document.querySelector('#slotBody tr[data-slot="U"] .c-tag').textContent.includes("FAIR"));
  const raw = await page.evaluate((k) => localStorage.getItem(k), LS_KEY);
  await browser.close();
  const s = JSON.parse(raw);
  s.fetchedAt = Date.now() - 3 * 3600e3; // "STALE·3h"
  return JSON.stringify(s);
}

export async function swrFlow() {
  const seeded = await seedState();
  // v2 prices double the blue cards: U flips FAIR→+EV on refresh.
  const { browser, page } = await launch({
    bluePrice: 24,
    scryfallDelay: 1500, // keep the revalidate in flight long enough to observe the cached phase
    initScript: `localStorage.setItem(${JSON.stringify(LS_KEY)}, ${JSON.stringify(seeded)})`,
  });
  const t0 = Date.now();
  await page.goto(ORIGIN + "/");
  await waitForBoard(page);
  const paintMs = Date.now() - t0;
  assert.ok(paintMs < 1000, `cached board paint took ${paintMs} ms (>= 1 s)`);
  // age-bearing stamp on both surfaces (tik-stamp + mobile glance)
  assert.equal(await page.evaluate(() => document.getElementById("stamp").textContent), "STALE·3h");
  assert.match(await page.textContent("#glance"), /STALE·3h/);
  const yBefore = await page.evaluate(() => document.querySelector(".strip").getBoundingClientRect().top);

  // background refresh flips the verdict → pinned cue, present with no interaction
  await page.waitForSelector("#cue:not([hidden])", { timeout: 20000 });
  assert.equal(await page.textContent("#cue"), "FAIR→+EV on refresh");
  // totals strip did not move across the in-place swap
  const yAfter = await page.evaluate(() => document.querySelector(".strip").getBoundingClientRect().top);
  assert.equal(yAfter, yBefore, `totals strip moved ${yBefore} → ${yAfter} across refresh`);

  // a dispatched scroll never clears the cue…
  await page.evaluate(() => { window.scrollTo(0, 400); window.dispatchEvent(new Event("scroll")); });
  await sleep(150);
  assert.ok(await page.isVisible("#cue"), "cue survived dispatched scroll");
  // …one tap does
  await page.tap("h1.wordmark");
  await page.waitForSelector("#cue", { state: "hidden", timeout: 5000 });

  // refresh landed → LIVE stamp; typing a cost → MANUAL stamp
  assert.match(await page.evaluate(() => document.getElementById("stamp").textContent), /^LIVE /);
  await page.fill("#boxPrice", "200");
  assert.equal(await page.evaluate(() => document.getElementById("stamp").textContent), "MANUAL");
  await browser.close();
}

export async function secondTapNoOp() {
  const seeded = await seedState();
  let searches = 0;
  const { browser, page } = await launch({
    bluePrice: 24,
    scryfallDelay: 2000,
    onRequest: (u) => { if (u.includes("api.scryfall.com/cards/search")) searches++; },
    initScript: `localStorage.setItem(${JSON.stringify(LS_KEY)}, ${JSON.stringify(seeded)})`,
  });
  await page.goto(ORIGIN + "/");
  await waitForBoard(page);
  await sleep(300); // revalidate now in flight (aria-busy, button disabled)
  assert.equal(await page.getAttribute(".ticker", "aria-busy"), "true", "busy state during refresh");
  const flight = searches;
  await page.evaluate(() => { document.getElementById("rerun").click(); document.getElementById("rerun").click(); });
  await sleep(500);
  assert.equal(searches, flight, "taps during an in-flight refresh started no new pipeline");
  await page.waitForFunction(() => /^LIVE /.test(document.getElementById("stamp").textContent), null, { timeout: 20000 });
  assert.equal(await page.getAttribute(".ticker", "aria-busy"), null, "busy state cleared");
  await browser.close();
}

export const scenarios = { swrFlow, secondTapNoOp };
