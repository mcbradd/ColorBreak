import { createRequire } from "node:module";
import assert from "node:assert/strict";
const { chromium } = createRequire(import.meta.url)("playwright");
const base = process.argv[2] ?? "http://127.0.0.1:4173/";
const browser = await chromium.launch({ headless: true });
try {
  for (const [query, product, balanced] of [["dom booster", /DOM\) Booster Pack$/, true], ["tmt play", /TMT\) Play Booster Pack$/, false]]) {
    const page = await browser.newPage({ viewport: { width: 390, height: 700 } });
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto(`${base}#seller`);
    await page.getByRole("combobox").fill(query);
    await page.getByRole("option", { name: product }).click();
    await page.locator(".glance-total .answer-value").filter({ hasText: /\$[1-9]/ }).waitFor({ timeout: 30000 });
    await page.waitForFunction(() => [...document.querySelectorAll(".glance-color > small")].some(row => !row.textContent.startsWith("$0–$0")));
    if (await page.getByRole("button", { name: /Done entering/ }).count()) await page.getByRole("button", { name: /Done entering/ }).first().click();
    if (balanced) {
      for (const color of ["White", "Blue", "Black", "Red", "Green"]) {
        const range = await page.getByRole("button", { name: `Inspect ${color} value`, exact: true }).locator(":scope > small").innerText();
        assert.ok(Number(range.match(/\$([\d.]+)/)?.[1]) > 0, `${color}: ${range}`);
      }
    }
    await page.locator(".glance-total .answer-note").click();
    const detail = await page.getByRole("tooltip").innerText();
    assert.match(detail, /published pack facts first, community collation second/);
    if (!balanced) assert.match(detail, /unpublished color pattern/);
    assert.deepEqual(errors, []);
    console.log(`PASS ${query}: physical ranges loaded, source hierarchy explained${balanced ? ", all five color MIN values positive with bulk included" : ", inferred color rule disclosed"}`);
    await page.close();
  }
} finally { await browser.close(); }
