// Shared Playwright harness + standing gates G1/G2 (S8a) for ColorBreak.
// Repo-only; nothing here ships. Needs a local Playwright install:
// set PLAYWRIGHT_DIR to a directory whose node_modules contains `playwright`.
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

const PW_DIR = process.env.PLAYWRIGHT_DIR || "C:/Users/McBra/.claude/tools/playwright-mcp";
const require = createRequire(PW_DIR.replace(/\/?$/, "/") + "noop.js");
const pw = require("playwright");

export const ORIGIN = "https://board.test";
const INDEX = readFileSync(fileURLToPath(new URL("../../index.html", import.meta.url)), "utf8");

export const RELAY_HOSTS = ["api.codetabs.com", "api.allorigins.win", "proxy.cors.sh"];

// Acceptance device: iPhone 15 Pro Max descriptor (430x739, DPR 3, touch).
export function device() {
  const d = pw.devices["iPhone 15 Pro Max"];
  const base = d ? { viewport: d.viewport, deviceScaleFactor: d.deviceScaleFactor, isMobile: d.isMobile, hasTouch: d.hasTouch, userAgent: d.userAgent }
                 : { viewport: { width: 430, height: 739 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true };
  return base;
}

export const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ---- synthetic upstreams --------------------------------------------------
// Deterministic mini-set "tst": one $1+ card per slot so every bucket is live.
export function synthCards({ bluePrice = 12 } = {}) {
  const mk = (cn, name, rarity, colors, type, usd, extra = {}) => ({
    id: "id" + cn, name, rarity, colors, type_line: type, collector_number: String(cn),
    booster: true, prices: { usd: usd == null ? null : String(usd), usd_foil: usd == null ? null : String((usd * 2).toFixed(2)) },
    ...extra,
  });
  const cards = [
    mk(1, "White Anthem", "rare", ["W"], "Enchantment", 6),
    mk(2, "Blue Leviathan", "rare", ["U"], "Creature", bluePrice),
    mk(3, "Black Demon", "rare", ["B"], "Creature", 7),
    mk(4, "Red Dragon", "rare", ["R"], "Creature", 9),
    mk(5, "Green Titan", "rare", ["G"], "Creature", 8),
    mk(6, "Gold Command", "rare", ["U", "R"], "Instant", 5),
    mk(7, "Steel Colossus", "rare", [], "Artifact Creature", 11),
    mk(8, "Dual Cavern", "rare", [], "Land", 4),
    mk(9, "Blue Mythic Whale", "mythic", ["U"], "Creature", bluePrice * 2),
  ];
  for (let i = 10; i < 40; i++) cards.push(mk(i, "Filler " + i, "common", ["G"], "Creature", 0.15));
  for (let i = 40; i < 45; i++) cards.push(mk(i, "Basic Forest " + i, "common", [], "Basic Land — Forest", null));
  for (let i = 45; i < 57; i++) cards.push(mk(i, "Uncommon " + i, "uncommon", ["W"], "Creature", 0.4));
  return cards;
}

function tcgPath(reqUrl) {
  let dec = reqUrl;
  try { dec = decodeURIComponent(reqUrl); } catch (e) {}
  const i = dec.indexOf("tcgcsv.com");
  return i < 0 ? null : dec.slice(i + "tcgcsv.com".length).split("&")[0];
}

// One router for everything the page touches.
// opts: { latency (ms, ALL hosts incl. document — G4), relays: 'all'|'none'|[hosts],
//         bluePrice, marketPrice, onRequest(url) }
export async function routeAll(context, opts = {}) {
  const { latency = 0, relays = "all", bluePrice = 12, marketPrice = 123.45, onRequest } = opts;
  const cards = synthCards({ bluePrice });
  await context.route("**/*", async (route) => {
    const url = route.request().url();
    if (onRequest) onRequest(url);
    if (latency) await sleep(latency);
    const host = new URL(url).host;

    if (url.startsWith(ORIGIN)) {
      return route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: INDEX });
    }
    if (host === "fonts.googleapis.com") return route.fulfill({ status: 200, contentType: "text/css", body: "" });
    if (host === "fonts.gstatic.com") return route.abort();

    if (host === "api.scryfall.com") {
      const u = new URL(url);
      if (u.pathname === "/cards/search") {
        const q = u.searchParams.get("q") || "";
        const data = q.includes("tst") ? cards : [];
        return route.fulfill({ json: { object: "list", total_cards: data.length, has_more: false, data } });
      }
      if (u.pathname === "/sets/tst") return route.fulfill({ json: { code: "tst", name: "Testline", released_at: "2025-01-01", printed_size: 60 } });
      if (u.pathname === "/sets") return route.fulfill({ json: { data: [] } });
      return route.fulfill({ status: 404, json: { object: "error" } });
    }

    if (RELAY_HOSTS.includes(host)) {
      const allowed = relays === "all" || (Array.isArray(relays) && relays.includes(host));
      if (!allowed) return route.abort();
      const p = tcgPath(url);
      if (p === "/tcgplayer/1/groups") return route.fulfill({ json: { results: [{ groupId: 1, abbreviation: "TST", name: "Testline" }] } });
      if (p === "/tcgplayer/1/1/products") return route.fulfill({ json: { results: [{ productId: 9, name: "Testline Play Booster Display" }] } });
      if (p === "/tcgplayer/1/1/prices") return route.fulfill({ json: { results: [{ productId: 9, subTypeName: "Normal", marketPrice, lowPrice: 99 }] } });
      return route.fulfill({ status: 404, body: "{}" });
    }

    return route.abort(); // hermetic: nothing else leaves the test
  });
}

export async function launch(opts = {}) {
  const browser = await pw.chromium.launch();
  const context = await browser.newContext({ ...device(), ...(opts.contextOpts || {}) });
  if (opts.initScript) await context.addInitScript(opts.initScript);
  await routeAll(context, opts);
  const page = await context.newPage();
  if (opts.cpuThrottle) {
    const cdp = await context.newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: opts.cpuThrottle });
  }
  return { browser, context, page };
}

export async function waitForBoard(page, timeout = 30000) {
  await page.waitForFunction(() => {
    const el = document.getElementById("tEV");
    return el && el.textContent.trim() !== "" && el.textContent.trim() !== "\u2014";
  }, null, { timeout });
}

// ---- standing gates -------------------------------------------------------
// G1: zero horizontal clipping — every element's right edge <= 430.
export async function assertG1(page) {
  const bad = await page.evaluate(() => {
    const out = [];
    for (const el of document.querySelectorAll("body *")) {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0 && r.right > 430.5)
        out.push(`${el.tagName}.${String(el.className).slice(0, 40)} right=${Math.round(r.right)}`);
    }
    return out.slice(0, 12);
  });
  assert.deepEqual(bad, [], "G1 horizontal clipping (>430): " + bad.join(" | "));
}

// G2 (redefined UX2-M1): post-board-paint, ticker verdict within y<=600 AND
// totals-strip bottom <=739 AND ticker height <=96.
export async function assertG2(page) {
  await page.evaluate(() => window.scrollTo(0, 0));
  const m = await page.evaluate(() => {
    const t = document.querySelector(".ticker").getBoundingClientRect();
    const strip = document.querySelector(".strip").getBoundingClientRect();
    const g = document.getElementById("glance").getBoundingClientRect();
    return { ticker: t.height, stripBottom: strip.bottom, verdictBottom: g.bottom };
  });
  assert.ok(m.ticker <= 96, `G2 ticker height ${m.ticker} > 96`);
  assert.ok(m.stripBottom <= 739, `G2 totals-strip bottom ${m.stripBottom} > 739`);
  assert.ok(m.verdictBottom <= 600, `G2 ticker verdict bottom ${m.verdictBottom} > 600`);
}
