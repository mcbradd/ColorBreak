// Real browser acceptance for the user-facing command-panel loops.
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
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
      const failedRequests = [];
      page.on('requestfailed', request => failedRequests.push({ url: request.url(), error: request.failure()?.errorText }));
      page.on('response', response => { if (response.status() >= 400) failedRequests.push({ url: response.url(), status: response.status() }); });
      try {
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
      assert.equal(await search.inputValue(), 'fin play', 'the next query survives recalculation');
      await page.getByRole('option', { name: /FIN\) Play Booster Pack$/ }).click();
      await page.getByRole('button', { name: 'Increase EOE Collector Booster Pack quantity' }).click();
      assert.equal(await quantity.inputValue(), '2');
      await search.fill('eoe');
      // A user scroll cancels the input viewport's pending reveal. Playwright's
      // programmatic scrollIntoView alone does not represent that user intent.
      await page.mouse.wheel(0, 1);
      const productName = page.getByRole('button', { name: 'Details for EOE Collector Booster Pack', exact: true });
      await productName.scrollIntoViewIfNeeded();
      if (width === 1440) {
        const focusBefore = await page.evaluate(() => document.activeElement?.outerHTML);
        await productName.hover();
        await page.getByRole('tooltip').filter({ hasText: 'Market per product' }).waitFor();
        assert.equal(await page.evaluate(() => document.activeElement?.outerHTML), focusBefore, 'hover never takes keyboard focus');
      }
      const scrollBefore = await page.locator('.command-body').evaluate(el => ({ top: el.scrollTop, left: el.scrollLeft }));
      await productName.click();
      const productDetails = page.getByRole('dialog', { name: 'EOE Collector Booster Pack', exact: true });
      await productDetails.waitFor();
      if (evidence && width === 390) await page.screenshot({ path: join(evidence, `${job}-product-information.png`), animations: 'disabled' });
      await productDetails.getByRole('button', { name: /Product market price:/ }).click();
      await page.getByRole('dialog', { name: 'Product market price', exact: true }).waitFor();
      await page.keyboard.press('Escape');
      await productDetails.waitFor();
      assert.equal(await productDetails.getAttribute('inert'), null);
      assert.equal(await page.locator('#root').getAttribute('inert'), '');
      await productDetails.getByRole('button', { name: 'Close EOE Collector Booster Pack' }).click();
      assert.equal(await productName.evaluate(el => document.activeElement === el), true);
      assert.deepEqual(await page.locator('.command-body').evaluate(el => ({ top: el.scrollTop, left: el.scrollLeft })), scrollBefore);
      assert.equal(await search.inputValue(), 'eoe');
      await page.getByRole('button', { name: job === 'buyer' ? 'Decision panel' : 'Values panel', exact: true }).click();
      await page.getByRole('region', { name: job === 'buyer' ? 'Bid decision' : 'Break value at a glance' }).waitFor();
      if (evidence && (width === 390 || width === 1440)) await page.screenshot({ path: join(evidence, `${job}-decision-${width}.png`), animations: 'disabled' });
      if (job === 'buyer') {
        await page.getByRole('button', { name: /^Your bid limit:/ }).click();
        await page.getByRole('dialog', { name: 'Your bid limit' }).waitFor();
        await page.getByRole('button', { name: 'Close Your bid limit', exact: true }).click();
      } else {
        await page.getByRole('button', { name: 'Inspect White value', exact: true }).click();
        const team = page.getByRole('dialog', { name: 'White team', exact: true });
        await team.waitFor();
        const table = team.getByRole('table', { name: 'Cards in White team', exact: true });
        await table.locator('.card-member-row').first().waitFor();
        assert.equal(await table.getByRole('columnheader', { name: /Price/ }).getAttribute('aria-sort'), 'descending');
        const thumbnail = table.locator('.card-member-thumbnail-button').first();
        await thumbnail.click();
        await page.locator('.card-inspector').waitFor();
        await page.keyboard.press('Escape');
        await page.locator('.card-inspector').waitFor({ state: 'hidden' });
        assert.equal(await thumbnail.evaluate(el => document.activeElement === el), true);
        await page.keyboard.press('Escape');
        await team.waitFor({ state: 'hidden' });
      }
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
      assert.ok(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight + 1), 'workspace stays within one screen');
      if (evidence) await page.screenshot({ path: join(evidence, `${job}-command-${width}.png`), animations: 'disabled' });
      if (job === 'buyer' && width === 1440) {
        await page.getByRole('button', { name: 'Teams panel', exact: true }).click();
        await page.getByRole('button', { name: 'Large break', exact: true }).click();
        await page.setViewportSize({ width: 390, height: 800 });
        assert.equal(await search.isVisible(), true, 'removing Teams retains an available panel after resizing');
        assert.equal(await page.getByRole('button', { name: 'Break panel', exact: true }).getAttribute('aria-pressed'), 'true');
      }
      assert.deepEqual(errors, []);
      assert.equal(await page.locator('button button, button [role="button"], [aria-hidden="true"] button:not([tabindex="-1"])').count(), 0, 'no nested or hidden interactive controls');
      console.log(`PASS ${job} ${width}px: one-selection add ${latency}ms, consecutive entry, live quantity, panel/query retention, no overflow`);
      } catch (error) {
        const state = {
          job, width, url: page.url(), errors, failedRequests,
          query: await page.getByRole('combobox').inputValue().catch(() => null),
          visibleText: await page.locator('body').innerText().catch(() => null),
        };
        console.error('Command-panel failure context:', JSON.stringify(state));
        if (evidence) {
          writeFileSync(join(evidence, `${job}-${width}-failure.json`), JSON.stringify(state, null, 2));
          await page.screenshot({ path: join(evidence, `${job}-${width}-failure.png`) }).catch(() => {});
        }
        throw error;
      } finally { await page.close(); }
    }
  }
} finally { await browser.close(); }
