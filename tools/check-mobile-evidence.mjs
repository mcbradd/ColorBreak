import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const { chromium } = createRequire(import.meta.url)('playwright');
const base = process.argv[2] ?? 'http://127.0.0.1:4173/';
const browser = await chromium.launch({ headless: true });
try {
  for (const width of [320, 390, 768]) {
    const context = await browser.newContext({ viewport: { width, height: 720 }, permissions: ['clipboard-read', 'clipboard-write'] });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`${base}#buyer`);
    assert.equal(await page.getByText('Add a product to begin', { exact: true }).count(), 0);
    await page.getByRole('button', { name: 'Add products', exact: true }).click();
    await page.getByRole('textbox', { name: 'Search sets by name or code' }).fill('eoe');
    await page.getByRole('button', { name: /EOE Edge of Eternities/ }).click();
    await page.getByRole('button', { name: 'Collector Booster Pack', exact: true }).click();
    await page.getByRole('button', { name: 'Done', exact: true }).click();
    await page.locator('.buyer-slot-row').first().waitFor();
    assert.equal(await page.locator('.buyer-slot-control .answer-note').count(), 1);
    assert.equal(await page.locator('.buyer-slot-row .answer-note').count(), 0);
    assert.equal(await page.locator('.import-undo').count(), 0);
    const url = page.url();
    assert.ok(new URL(url).searchParams.has('b'), 'composition updates address bar');
    await page.getByRole('button', { name: 'Copy break link', exact: true }).click();
    await page.getByRole('status').filter({ hasText: 'Break link copied to clipboard' }).waitFor();
    assert.equal(await page.evaluate(() => navigator.clipboard.readText()), url);
    assert.equal(await page.getByRole('textbox', { name: 'Buyer setup URL' }).count(), 0);
    await page.locator('.share-toast').waitFor({ state: 'hidden', timeout: 5000 });
    const rowBox = await page.locator('.composition .line-identity').boundingBox();
    const quantityBox = await page.locator('.composition .quantity-selector').boundingBox();
    assert.ok(quantityBox.x >= rowBox.x + rowBox.width && quantityBox.y < rowBox.y + rowBox.height, 'quantity stays beside product');
    if (width < 600) await page.getByRole('link', { name: 'Edit break', exact: true }).click();
    await page.getByRole('heading', { name: 'Check a bid', exact: true }).waitFor();
    if (width === 390) {
      const recipient = await browser.newPage({ viewport: { width, height: 720 } });
      await recipient.goto(url);
      await recipient.locator('.composition').getByText('Collector Booster Pack', { exact: true }).waitFor();
      assert.match(await recipient.locator('.composition').innerText(), /Collector Booster Pack/);
      assert.equal(await recipient.locator('.composition .quantity-selector input').inputValue(), '1');
      await recipient.close();
    }
    await page.getByText('Adjust assumptions', { exact: true }).click();
    const widths = await page.locator('.buyer-assumptions .shipping-mode, .buyer-assumptions .number-field > div, .buyer-assumptions .bulk-value-field > div').evaluateAll(els => els.map(el => el.getBoundingClientRect().width));
    assert.ok(Math.max(...widths) - Math.min(...widths) < 2, `matched input widths: ${widths}`);
    assert.equal(await page.getByRole('textbox', { name: 'Tax', exact: true }).evaluate(el => getComputedStyle(el).textAlign), 'right');
    assert.equal(await page.getByRole('textbox', { name: 'Tax', exact: true }).locator('..').locator('..').locator('b').innerText(), '%');
    await page.getByText('Break evidence', { exact: true }).click();
    await page.locator('.slot-detail .contributor-card').first().waitFor({ timeout: 30000 });
    assert.equal(await page.locator('.slot-detail .answer-note').count(), 1);
    assert.equal(await page.locator('.value-summary .answer-note').count(), 1);
    await page.locator('.slot-detail .section-help .answer-note').click();
    const tip = page.getByRole('tooltip');
    assert.ok((await tip.innerText()).split(/\s+/).length <= 65);
    await page.keyboard.press('Escape');
    const overlaps = await page.locator('.contributor-columns, .contributor-card').evaluateAll(rows => rows.some(row => {
      const cells = [...row.children].filter(el => getComputedStyle(el).display !== 'none');
      return cells.some((el, i) => i && el.getBoundingClientRect().left < cells[i - 1].getBoundingClientRect().right - 1);
    }));
    assert.equal(overlaps, false, 'card-list columns never overlap');
    const overflowingLabels = await page.locator('.contributor-columns > span').evaluateAll(cells => cells.some(cell => {
      const range = document.createRange(); range.selectNodeContents(cell);
      const text = range.getBoundingClientRect(); const box = cell.getBoundingClientRect();
      return text.left < box.left - 1 || text.right > box.right + 1;
    }));
    assert.equal(overflowingLabels, false, 'Chance and Adds text fits its column');
    if (width === 390) await page.locator('.slot-detail').screenshot({ path: '.preview-value-details.png' });
    await page.locator('.slot-detail .contributor-card').first().click();
    const dialog = page.getByRole('dialog', { name: /./ });
    await dialog.waitFor();
    assert.equal(await dialog.locator('.answer-note').count(), 1);
    assert.equal(await dialog.getByText('Copies per break', { exact: true }).count(), 0);
    assert.equal(await dialog.getByText('Selected finish price', { exact: true }).count(), 0);
    const art = dialog.locator('.card-full-image');
    const artBox = await art.boundingBox();
    assert.ok(artBox.height > artBox.width * 1.3, `full portrait image ${JSON.stringify(artBox)}`);
    assert.ok(artBox.width >= Math.min(width - 50, 300));
    const chance = await dialog.locator('.primary-stat strong').innerText();
    assert.ok(!/\d\.\d.*breaks/.test(chance), `whole-break odds: ${chance}`);
    await page.waitForTimeout(400);
    await art.evaluate(async el => { if (el instanceof HTMLImageElement && !el.complete) await new Promise(resolve => { el.onload = resolve; el.onerror = resolve; }); });
    if (width === 390) await page.screenshot({ path: '.preview-card-details.png' });
    await page.getByRole('button', { name: 'Close card details' }).click();
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'no page overflow');
    assert.deepEqual(errors, []);
    console.log(`PASS ${width}px: section notes, concise help, matched inputs, single-line quantity, live URL/toast, table columns and full card art`);
    await context.close();
  }
} finally { await browser.close(); }
