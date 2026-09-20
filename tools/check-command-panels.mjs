// Real browser acceptance for the user-facing command-panel loops.
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const { chromium, webkit } = createRequire(import.meta.url)('playwright');
const base = process.argv[2] ?? 'http://127.0.0.1:4173/';
const evidence = process.env.COLORBREAK_EVIDENCE_DIR;
const widths = process.env.COLORBREAK_TEST_WIDTH ? [Number(process.env.COLORBREAK_TEST_WIDTH)] : [320, 390, 430, 768, 1440];
const jobs = process.env.COLORBREAK_TEST_JOB ? [process.env.COLORBREAK_TEST_JOB] : ['buyer', 'seller'];
const repetitions = Math.max(1, Number(process.env.COLORBREAK_TEST_REPETITIONS ?? 1));
if (widths.some(width => !Number.isFinite(width) || width < 1) || jobs.some(job => !['buyer', 'seller'].includes(job)) || !Number.isInteger(repetitions)) {
  throw new Error('Invalid browser test filter.');
}
if (evidence) mkdirSync(evidence, { recursive: true });
const browser = await (process.env.COLORBREAK_BROWSER === 'webkit' ? webkit : chromium).launch({ headless: true });
async function runCheck(job, width, repetition) {
  const page = await browser.newPage({ viewport: { width, height: 800 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const failedRequests = [];
  page.on('requestfailed', request => failedRequests.push({ url: request.url(), error: request.failure()?.errorText }));
  page.on('response', response => { if (response.status() >= 400) failedRequests.push({ url: response.url(), status: response.status() }); });
  const scrollTrace = [];
  try {
    await page.goto(`${base}#${job}`);
    const search = page.getByRole('combobox', { name: 'Find a set or product' });
    if (job === 'buyer' && width < 900) {
      const suggestions = page.getByRole('group', { name: 'Available sets, newest releases first' });
      await suggestions.waitFor();
      assert.ok(await suggestions.getByRole('button').count() > 4, 'recent set list contains enough tiles to scroll');
      const listLayout = await suggestions.evaluate(el => ({
        columns: getComputedStyle(el).gridTemplateColumns.trim().split(/\s+/).length,
        clientHeight: el.clientHeight,
        scrollHeight: el.scrollHeight,
        clientWidth: el.clientWidth,
        scrollWidth: el.scrollWidth,
        overflowY: getComputedStyle(el).overflowY,
        scrollbar: getComputedStyle(el, '::-webkit-scrollbar').display,
      }));
      assert.equal(listLayout.columns, 3, `recent sets use three columns: ${JSON.stringify(listLayout)}`);
      assert.equal(listLayout.overflowY, 'auto');
      assert.ok(listLayout.scrollHeight > listLayout.clientHeight, 'recent set tiles extend below the visible list');
      assert.ok(listLayout.scrollWidth <= listLayout.clientWidth + 1, 'recent set tiles never scroll horizontally');
      assert.equal(listLayout.scrollbar, 'none', 'recent set scroller hides its scrollbar');
      const body = page.locator('.command-body');
      const parentScrollBefore = await body.evaluate(el => el.scrollTop);
      await suggestions.hover();
      await page.mouse.wheel(0, 140);
      await page.waitForFunction(() => document.querySelector('.quick-set-suggestions')?.scrollTop > 0);
      assert.equal(await body.evaluate(el => el.scrollTop), parentScrollBefore, 'scrolling recent sets leaves content above in place');
      assert.deepEqual(await page.evaluate(() => [scrollX, scrollY]), [0, 0], 'set scrolling never moves the page');
    }
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
    const productElement = await productName.elementHandle();
    const recordScroll = async stage => scrollTrace.push({ stage, scroll: await page.locator('.command-body').evaluate(el => ({ top: el.scrollTop, left: el.scrollLeft })), trigger: await productElement?.boundingBox() });
    scrollTrace.push({ stage: 'before-open', scroll: scrollBefore, trigger: await productElement?.boundingBox() });
    await productName.click();
    const productDetails = page.getByRole('dialog', { name: 'EOE Collector Booster Pack', exact: true });
    await productDetails.waitFor();
    await recordScroll('parent-open');
    if (evidence && width === 390) await page.screenshot({ path: join(evidence, `${job}-product-information.png`), animations: 'disabled' });
    const marketPriceButton = productDetails.getByRole('button', { name: /Product market price:/ });
    const marketPriceElement = await marketPriceButton.elementHandle();
    await marketPriceButton.click();
    const priceDetails = page.getByRole('dialog', { name: 'Product market price', exact: true });
    await priceDetails.waitFor();
    await recordScroll('nested-open');
    await page.keyboard.press('Escape');
    await priceDetails.waitFor({ state: 'detached' });
    await page.waitForFunction(button => document.activeElement === button, marketPriceElement);
    await recordScroll('nested-close');
    assert.equal(await productDetails.getAttribute('inert'), null);
    assert.equal(await page.locator('#root').getAttribute('inert'), '');
    await productDetails.getByRole('button', { name: 'Close EOE Collector Booster Pack' }).click();
    await page.waitForFunction(trigger => document.activeElement === trigger, productElement);
    const scrollAfter = await page.locator('.command-body').evaluate(el => ({ top: el.scrollTop, left: el.scrollLeft }));
    scrollTrace.push({ stage: 'parent-close', scroll: scrollAfter, trigger: await productElement?.boundingBox() });
    assert.deepEqual(scrollAfter, scrollBefore);
    assert.equal(await search.inputValue(), 'eoe');
    if (job === 'buyer') {
      assert.equal(await page.getByRole('button', { name: 'Break panel', exact: true }).count(), 0, 'buyer has one integrated break surface');
      assert.equal(await page.getByRole('button', { name: 'Decision panel', exact: true }).count(), 0, 'buyer has no separate decision surface');
      assert.equal(await page.locator('#buyer-large-result').getAttribute('data-command-panel'), null, 'buyer result is part of the break surface');
    } else {
      await page.getByRole('button', { name: 'Values panel', exact: true }).click();
    }
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
      assert.equal(await search.isVisible(), job === 'buyer', 'buyer setup stays mounted while seller panels retain their navigation');
      await page.getByRole('complementary', { name: 'Live decision' }).waitFor();
    }
    if (job === 'seller') await page.getByRole('button', { name: 'Break panel', exact: true }).click();
    assert.equal(await search.inputValue(), 'eoe');
    assert.equal(await quantity.inputValue(), '2');
    await search.fill('');
    await search.blur();
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'page fits viewport');
    if (job === 'seller') assert.ok(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight + 1), 'seller workspace stays within one screen');
    else assert.ok(await page.locator('.command-body').evaluate(el => el.scrollHeight >= el.clientHeight), 'integrated buyer workspace owns its scrolling');
    if (evidence) await page.screenshot({ path: join(evidence, `${job}-command-${width}.png`), animations: 'disabled' });
    if (job === 'buyer' && width === 1440) {
      await page.getByRole('button', { name: 'Custom', exact: true }).click();
      await page.setViewportSize({ width: 390, height: 800 });
      assert.equal(await search.isVisible(), true, 'the integrated break stays available after changing format and resizing');
      assert.equal(await page.getByRole('button', { name: 'Break panel', exact: true }).count(), 0);
    }
    assert.deepEqual(errors, []);
    assert.equal(await page.locator('button button, button [role="button"], [aria-hidden="true"] button:not([tabindex="-1"])').count(), 0, 'no nested or hidden interactive controls');
    if (process.env.COLORBREAK_SCROLL_TRACE === 'all') console.log(`Scroll trace ${job} ${width}px: ${JSON.stringify(scrollTrace)}`);
    console.log(`PASS ${job} ${width}px: one-selection add ${latency}ms, consecutive entry, live quantity, panel/query retention, no overflow${repetitions > 1 ? ` (${repetition}/${repetitions})` : ''}`);
  } catch (error) {
    const state = {
      job, width, url: page.url(), errors, failedRequests,
      failure: { name: error.name, message: error.message, stack: error.stack },
      query: await page.getByRole('combobox').inputValue().catch(() => null),
      scrollTrace,
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

try {
  for (let repetition = 1; repetition <= repetitions; repetition++) {
    for (const width of widths) {
      for (const job of jobs) {
        await runCheck(job, width, repetition);
      }
    }
  }
} finally { await browser.close(); }
