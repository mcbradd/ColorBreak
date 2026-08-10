// F8 pool cache: a stored pool is a warm start, never a substitute for a refresh.
// A warm board must paint without the wire, stamp itself STALE, and still revalidate.
import assert from "node:assert/strict";
import { launch, waitForBoard, ORIGIN } from "./harness.mjs";

const LS_POOLS = "colorBreakEV.pools.v1";

// Run once live, keep only the pool store: the next visit has a warm pool, no board.
async function seedPools(ageMs) {
  const { browser, page } = await launch({ bluePrice: 12 });
  await page.goto(ORIGIN + "/?set=tst&preset=play");
  await waitForBoard(page);
  const raw = await page.evaluate((k) => localStorage.getItem(k), LS_POOLS);
  await browser.close();
  assert.ok(raw, "a live run wrote the pool store");
  const store = JSON.parse(raw);
  assert.deepEqual(Object.keys(store), ["tst|flag"]);
  const entry = store["tst|flag"];
  assert.ok(Array.isArray(entry.pool) && entry.pool.length > 0, "stored pool has cards");
  assert.ok(entry.pool.every(c => !("img" in c) && !("o" in c)),
    "stored pool carries no image or oracle text — those refetch by id");
  entry.at = Date.now() - ageMs;
  return JSON.stringify(store);
}

async function loadWarm(seeded, opts) {
  let searches = 0;
  const { browser, page } = await launch({
    bluePrice: 24,
    scryfallDelay: 1500,
    onRequest: (u) => { if (u.includes("api.scryfall.com/cards/search")) searches++; },
    initScript: `localStorage.setItem(${JSON.stringify(LS_POOLS)}, ${JSON.stringify(seeded)})`,
    ...opts,
  });
  const t0 = Date.now();
  await page.goto(ORIGIN + "/?set=tst&preset=play");
  await waitForBoard(page);
  return { browser, page, paintMs: Date.now() - t0, searchCount: () => searches };
}

export async function warmPoolPaintsThenRevalidates() {
  const seeded = await seedPools(3600e3); // 1 h old — inside the 6 h TTL
  const { browser, page, paintMs, searchCount } = await loadWarm(seeded);
  // Scryfall is held for 1.5 s, so a sub-second paint can only have come from the store.
  assert.ok(paintMs < 1000, `warm start took ${paintMs} ms — it waited on the wire`);
  assert.match(await page.textContent("#stamp"), /^STALE/, "a warm board never claims to be live");
  // It still owes live prices: the revalidate goes to the wire behind the painted board.
  await page.waitForFunction(() => /^LIVE /.test(document.getElementById("stamp").textContent),
    null, { timeout: 20000 });
  assert.ok(searchCount() > 0, "revalidate fetched live prices behind the paint");
  await browser.close();
}

export async function expiredPoolGoesToTheWire() {
  const seeded = await seedPools(7 * 3600e3); // past the 6 h TTL
  const { browser, page, paintMs, searchCount } = await loadWarm(seeded);
  assert.ok(searchCount() > 0, "an expired pool is refetched, not served");
  assert.ok(paintMs >= 1000, `expired pool painted in ${paintMs} ms — it skipped the fetch`);
  assert.match(await page.textContent("#stamp"), /^LIVE /);
  await browser.close();
}

export const scenarios = { warmPoolPaintsThenRevalidates, expiredPoolGoesToTheWire };
