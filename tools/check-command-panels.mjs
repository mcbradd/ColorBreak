// Real browser acceptance for the user-facing command-panel loops.
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
const { chromium, webkit } = createRequire(import.meta.url)('playwright');
const base = process.argv[2] ?? 'http://127.0.0.1:4173/';
const evidence = process.env.COLORBREAK_EVIDENCE_DIR;
if (evidence) mkdirSync(evidence, { recursive: true });
const browser = await (process.env.COLORBREAK_BROWSER === 'webkit' ? webkit : chromium).launch({ headless: true });
try {
  for (const width of [320, 390, 430, 768, 1440]) {
    for (const job of ['buyer', 'seller']) {
      const page = await browser.newPage({ viewport: { width, height: 800 } });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(`${base}#${job}`);
      const search = page.getByRole('combobox', { name: 'Find a set and product' });
      await search.fill('eoe collector');
      const match = page.getByRole('option', { name: /EOE\) Collector Booster Pack$/ });
      await match.waitFor();
      const start = performance.now();
      await match.click();
      const quantity = page.getByRole('textbox', { name: 'EOE Collector Booster Pack quantity', exact: true });
      await quantity.waitFor();
      const latency = Math.round(performance.now() - start);
      assert.equal(await quantity.inputValue(), '1');
      assert.equal(await search.inputValue(), '');
      assert.equal(await search.evaluate(el => document.activeElement === el), true);
      assert.equal(await page.getByRole('dialog').count(), 0);
      await search.fill('fin play');
      await page.getByRole('option', { name: /FIN\) Play Booster Pack$/ }).click();
      await page.getByRole('button', { name: 'Increase EOE Collector Booster Pack quantity' }).click();
      assert.equal(await quantity.inputValue(), '2');
      await search.fill('eoe');
      await page.getByRole('button', { name: job === 'buyer' ? 'Decision panel' : 'Values panel', exact: true }).click();
      await page.getByRole('region', { name: job === 'buyer' ? 'Bid decision' : 'Break value at a glance' }).waitFor();
      if (width < 900) {
        assert.equal(await search.isVisible(), false);
        await page.getByRole('complementary', { name: 'Live decision' }).waitFor();
      }
      await page.getByRole('button', { name: 'Break panel', exact: true }).click();
      assert.equal(await search.inputValue(), 'eoe');
      assert.equal(await quantity.inputValue(), '2');
      await search.fill('');
      await search.blur();
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'page fits viewport');
      if (evidence) await page.screenshot({ path: join(evidence, `${job}-command-${width}.png`) });
      assert.deepEqual(errors, []);
      console.log(`PASS ${job} ${width}px: one-selection add ${latency}ms, consecutive entry, live quantity, panel/query retention, no overflow`);
      await page.close();
    }
  }
} finally { await browser.close(); }
