// Real Chromium check against preview or the public deployment.
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const { chromium } = createRequire(import.meta.url)('playwright');
const base = process.argv[2] ?? 'http://127.0.0.1:4173/';
const browser = await chromium.launch({ headless: true });
try {
  for (const width of [320, 390, 768]) {
    const page = await browser.newPage({ viewport: { width, height: 700 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`${base}#seller`);
    await page.getByRole('combobox').fill('tmt play');
    await page.getByRole('option', { name: /TMT\) Play Booster Pack$/ }).click();
    await page.locator('.glance-limit .answer-value').waitFor();
    assert.match(await page.locator('.glance-limit .answer-value').innerText(), /\$/);
    assert.equal(await page.locator('.glance-range').getByText('MIN', { exact: true }).count(), 1);
    assert.equal(await page.locator('.glance-range').getByText('MAX', { exact: true }).count(), 1);
    assert.equal(await page.locator('.glance-range').getByText(/LOW|HIGH/).count(), 0);
    await page.locator('.glance-total .answer-value').filter({ hasText: /\$[1-9]/ }).waitFor({ timeout: 30000 });
    if (await page.getByRole('button', { name: /Done entering/ }).count()) await page.getByRole('button', { name: /Done entering/ }).first().click();
    await page.locator('.glance-limit').scrollIntoViewIfNeeded();
    const note = page.locator('.glance-limit .answer-note');
    await note.click();
    await page.getByRole('tooltip').waitFor();
    assert.match(await page.getByRole('tooltip').innerText(), /shipping|price|estimate/i);
    let box = await page.getByRole('tooltip').boundingBox();
    assert.ok(box.x >= 0 && box.x + box.width <= width + 1 && box.y >= 0 && box.y + box.height <= 701, `popover bounds at ${width}: ${JSON.stringify(box)}`);
    if (width === 390 && process.env.ANSWER_SCREENSHOT) await page.screenshot({ path: process.env.ANSWER_SCREENSHOT });
    await page.keyboard.press('Escape');
    assert.equal(await page.getByRole('tooltip').count(), 0);
    // A keyboard-sized viewport must still contain the complete scrollable popover.
    await page.setViewportSize({ width, height: 260 });
    await note.click();
    box = await page.getByRole('tooltip').boundingBox();
    assert.ok(box.y >= 0 && box.y + box.height <= 261, `short viewport popover at ${width}: ${JSON.stringify(box)}`);
    await page.keyboard.press('Escape');
    // iOS can shrink and pan visualViewport while the layout viewport stays tall.
    await page.setViewportSize({ width, height: 700 });
    await page.evaluate(() => {
      window.__answerOriginalViewport = window.visualViewport;
      const viewport = Object.assign(new EventTarget(), { width: innerWidth, height: 180, offsetTop: 90, offsetLeft: 0, scale: 1 });
      Object.defineProperty(window, 'visualViewport', { configurable: true, value: viewport });
      window.dispatchEvent(new Event('resize'));
    });
    await note.click();
    box = await page.getByRole('tooltip').boundingBox();
    assert.ok(box.y >= 90 && box.y + box.height <= 271, `panned keyboard viewport at ${width}: ${JSON.stringify(box)}`);
    await page.keyboard.press('Escape');
    await page.evaluate(() => {
      Object.defineProperty(window, 'visualViewport', { configurable: true, value: window.__answerOriginalViewport });
      delete window.__answerOriginalViewport;
      window.dispatchEvent(new Event('resize'));
    });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `horizontal overflow at ${width}`);
    assert.deepEqual(errors, [], `browser errors at ${width}`);
    console.log(`PASS ${width}px: immediate cap, loaded value, circled-asterisk explanation, Escape, short viewport bounds, no overflow`);
    if (width === 390) {
      await page.setViewportSize({ width, height: 700 });
      await page.goto(`${base}#buyer`);
      await page.getByRole('button', { name: 'Add products', exact: true }).click();
      await page.getByRole('textbox', { name: 'Search sets by name or code' }).fill('tmt');
      await page.getByRole('button', { name: /TMT Teenage Mutant Ninja Turtles/ }).click();
      await page.getByRole('button', { name: 'Play Booster Pack', exact: true }).click();
      await page.getByRole('button', { name: 'Done', exact: true }).click();
      await page.locator('.max-hammer .answer-value').waitFor();
      assert.match(await page.locator('.max-hammer').innerText(), /\$/);
      await page.locator('.slot-candle .answer-note').first().click();
      assert.match(await page.getByRole('tooltip').innerText(), /middle 98%.*MIN and MAX.*separate numbers/i);
      await page.keyboard.press('Escape');
      assert.equal(await page.getByRole('tooltip').count(), 0);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'buyer horizontal overflow');
      assert.deepEqual(errors, [], 'buyer browser errors');
      console.log('PASS buyer: immediate bid estimate and shared chart explanation');
    }
    await page.close();
  }
} finally { await browser.close(); }
