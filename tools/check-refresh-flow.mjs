import { createRequire } from "node:module";
import assert from "node:assert/strict";
const { chromium } = createRequire(import.meta.url)("playwright");
const base = process.argv[2] ?? "http://127.0.0.1:4173/";
const browser = await chromium.launch({ headless: true });
try {
  for (const width of [320, 390]) {
    const page = await browser.newPage({ viewport: { width, height: 700 }, serviceWorkers: "block" });
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    let refreshing = false, fail = false;
    let releaseIndex, releaseShards;
    const indexGate = new Promise(resolve => { releaseIndex = resolve; });
    const shardGate = new Promise(resolve => { releaseShards = resolve; });
    await page.route("**/data/prices/**", async route => {
      if (!refreshing) return route.continue();
      if (route.request().url().endsWith("index.json")) {
        if (fail) return route.abort("failed");
        await indexGate;
        const response = await route.fetch();
        const body = await response.json();
        for (const entry of Object.values(body.sets)) entry.sha256 += "-refresh-check";
        return route.fulfill({ response, json: body });
      }
      await shardGate;
      return route.continue();
    });
    await page.goto(`${base}#buyer`);
    await page.getByRole("button", { name: "Add products", exact: true }).click();
    await page.getByRole("textbox", { name: "Search sets by name or code" }).fill("tmt");
    await page.getByRole("button", { name: /TMT Teenage Mutant Ninja Turtles/ }).click();
    await page.locator(".product-groups > section").first().waitFor();
    await page.waitForFunction(() => { const button = document.querySelector(".picker-header-refresh"); return button && !button.disabled; });
    const groups = await page.locator(".product-groups > section").evaluateAll(rows => rows.map(row => row.firstElementChild.textContent.trim()));
    assert.deepEqual(groups.slice(0, 2), ["PACK", "BOX"]);
    const header = page.locator(".sheet > header");
    const before = await header.boundingBox();
    const order = await page.locator(".product-groups").innerText();
    refreshing = true;
    const button = page.locator(".picker-header-refresh");
    await button.click();
    assert.match(await button.innerText(), /Searching/);
    assert.equal(await button.getAttribute("aria-busy"), "true");
    const spinner = await button.locator(".refresh-spinner").boundingBox();
    assert.ok(spinner.width >= 12 && spinner.height >= 12);
    releaseIndex();
    await page.getByRole("button", { name: "Updating…" }).waitFor();
    assert.equal((await header.boundingBox()).height, before.height);
    releaseShards();
    await page.waitForFunction(() => !document.querySelector(".picker-header-refresh").disabled);
    assert.match(await button.innerText(), /Updated|No newer data/);
    assert.equal(await page.locator(".product-groups").innerText(), order);
    fail = true;
    await button.click();
    await page.getByRole("button", { name: "Retry", exact: true }).waitFor();
    assert.equal(await page.locator(".product-groups").innerText(), order);
    assert.equal((await header.boundingBox()).height, before.height);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    assert.deepEqual(errors, []);
    console.log(`PASS ${width}px: packs before boxes, searching/updating spinner, stable header/list, retained result, network failure retry`);
    await page.close();
  }
} finally { await browser.close(); }
