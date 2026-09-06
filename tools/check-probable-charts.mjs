import { createRequire } from "node:module";
import assert from "node:assert/strict";
const { chromium } = createRequire(import.meta.url)("playwright");
const base = process.argv[2] ?? "http://127.0.0.1:4173/";
const browser = await chromium.launch({ headless: true });
try {
  for (const mode of ["buyer", "seller"]) {
    const page = await browser.newPage({ viewport: { width: 390, height: 700 } });
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    // Observe the actual worker result without changing its values or timing.
    await page.addInitScript(() => {
      const Original = window.Worker;
      window.Worker = class extends Original {
        constructor(...args) { super(...args); this.addEventListener("message", event => { if (event.data.result?.slotDistributions) window.__chartResult = event.data.result; }); }
      };
    });
    await page.goto(`${base}#${mode}`);
    if (mode === "buyer") {
      await page.getByRole("button", { name: "Add products", exact: true }).click();
      await page.getByRole("textbox", { name: "Search sets by name or code" }).fill("tmt");
      await page.getByRole("button", { name: /TMT Teenage Mutant Ninja Turtles/ }).click();
      await page.getByRole("button", { name: "Collector Booster Pack", exact: true }).click();
      await page.getByRole("button", { name: "Done", exact: true }).click();
    } else {
      await page.getByRole("combobox").fill("tmt collector pack");
      await page.getByRole("option", { name: /TMT\) Collector Booster Pack$/ }).click();
    }
    await page.waitForFunction(() => window.__chartResult?.sampleCount > 0);
    const summaries = await page.evaluate(() => window.__chartResult.slotDistributions);
    const scale = Math.max(1, ...Object.values(summaries).map(row => mode === "buyer" ? row.p99 : row.p90));
    assert.ok(Math.max(...Object.values(summaries).map(row => row.max)) > scale, "fixture must contain extremes beyond the displayed range");
    const first = summaries.W;
    const selector = mode === "buyer" ? ".slot-candle-wick" : ".glance-color-bar i";
    const expected = mode === "buyer" ? (first.p99 - first.p01) / scale * 100 : Math.max(1, (first.p90 - first.p10) / scale * 100);
    await page.waitForFunction(({ selector, expected }) => Math.abs(parseFloat(document.querySelector(selector)?.style.width) - expected) < .01, { selector, expected });
    const values = mode === "buyer" ? page.locator(".slot-candle-values").first() : page.locator(".glance-color > small").first();
    assert.match(await values.innerText(), /MIN/);
    assert.match(await values.innerText(), /MAX/);
    const note = mode === "buyer" ? page.locator(".buyer-slot-control .step-heading .answer-note").first() : page.locator(".glance-heading .answer-note").first();
    await note.click();
    assert.match(await page.getByRole("tooltip").innerText(), mode === "buyer" ? /middle 98%/ : /middle 80%/);
    await page.keyboard.press("Escape");
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    assert.deepEqual(errors, []);
    console.log(`PASS ${mode}: actual probable-range geometry, extremes excluded from scale, MIN/MAX numbers retained, explanation and mobile fit`);
    await page.close();
  }
} finally { await browser.close(); }
