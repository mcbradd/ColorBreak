import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const { chromium } = createRequire(import.meta.url)('playwright');
const base = process.argv[2] ?? 'http://127.0.0.1:4173/';
const browser = await chromium.launch({ headless: true });
try {
  for (const width of [320, 390, 768]) {
    const page = await browser.newPage({ viewport: { width, height: 700 }, timezoneId: 'America/Los_Angeles' });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`${base}#buyer`);
    const addPack = async () => {
    await page.getByRole('button', { name: 'Add products', exact: true }).click();
    await page.getByRole('textbox', { name: 'Search sets by name or code' }).fill('tmt');
    await page.getByRole('button', { name: /TMT Teenage Mutant Ninja Turtles/ }).click();
    await page.getByRole('button', { name: 'Play Booster Pack', exact: true }).click();
    await page.getByRole('button', { name: 'Done', exact: true }).click();
    };
    await addPack();
    await page.getByText('Adjust assumptions', { exact: true }).click();
    const assumptions = page.locator('.buyer-assumptions');
    const shipping = page.getByRole('textbox', { name: 'Shipping', exact: true });
    assert.equal(await shipping.inputValue(), '4.47');
    assert.equal(await page.getByRole('textbox', { name: 'Tax', exact: true }).inputValue(), '9.03');
    assert.equal(await assumptions.getByRole('button', { name: 'Flat fee', exact: true }).getAttribute('aria-pressed'), 'true');
    assert.equal(await assumptions.getByText('Platform fees', { exact: true }).count(), 0);
    assert.equal(await assumptions.locator('.shipping-field input').count(), 1);
    assert.equal(await shipping.evaluate(el => getComputedStyle(el).textAlign), 'right');
    const filter = page.getByRole('textbox', { name: 'Bulk filter dollar amount' });
    const filterBox = await filter.boundingBox();
    const labelBox = await page.locator('.bulk-value-field > span').boundingBox();
    assert.ok(labelBox.x + labelBox.width <= filterBox.x, 'filter label precedes input');
    assert.ok(Math.abs(labelBox.y + labelBox.height / 2 - filterBox.y - filterBox.height / 2) < 3, 'filter label shares input row');
    await assumptions.getByRole('button', { name: 'Per item', exact: true }).click();
    await shipping.fill('0');
    await page.getByRole('button', { name: 'Done entering Shipping', exact: true }).click();
    await page.getByRole('button', { name: 'Large break', exact: true }).click();
    assert.equal(await page.getByRole('textbox', { name: 'Allocated shipping' }).count(), 0);
    assert.equal(await page.getByRole('textbox', { name: 'Estimated tax', exact: true }).count(), 0);
    await page.reload();
    await addPack();
    await page.getByText('Adjust assumptions', { exact: true }).click();
    assert.equal(await shipping.inputValue(), '0');
    assert.equal(await assumptions.getByRole('button', { name: 'Per item', exact: true }).getAttribute('aria-pressed'), 'true');
    await page.setViewportSize({ width, height: 280 });
    await shipping.fill('12.50');
    await page.getByRole('button', { name: 'Done entering Shipping', exact: true }).waitFor();
    await page.waitForTimeout(400); // allow the existing mobile focus restoration to settle
    for (const field of [shipping, page.getByRole('button', { name: 'Done entering Shipping', exact: true })]) {
      const box = await field.boundingBox();
      assert.ok(box.x >= 0 && box.x + box.width <= width + 1 && box.y >= 0 && box.y + box.height <= 281, `keyboard bounds ${width}: ${JSON.stringify(box)}`);
    }
    await page.getByRole('button', { name: 'Done entering Shipping', exact: true }).click();
    await page.setViewportSize({ width, height: 700 });
    if (width === 390) await assumptions.screenshot({ path: '.preview-cost-assumptions.png' });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `buyer overflow ${width}`);
    await page.goto(`${base}#seller`);
    await page.getByRole('combobox').fill('tmt play');
    await page.getByRole('option', { name: /TMT\) Play Booster Pack$/ }).click();
    await page.getByText('Costs & platform fees', { exact: true }).click();
    const sellerCosts = page.locator('.seller-cost-grid');
    assert.equal(await sellerCosts.getByRole('textbox', { name: 'Postage / shipment', exact: true }).inputValue(), '0');
    assert.equal(await sellerCosts.getByRole('textbox', { name: 'Commission', exact: true }).inputValue(), '8');
    assert.equal(await sellerCosts.locator('.shipping-field input').count(), 1);
    assert.ok((await sellerCosts.locator('.monetary-input input').evaluateAll(els => els.map(el => getComputedStyle(el).textAlign))).every(align => align === 'right'));
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `seller overflow ${width}`);
    assert.deepEqual(errors, []);
    console.log(`PASS ${width}px: role costs, defaults, single shipping field, saved zero/mode, shared Large Break costs, inline filter, monetary alignment, keyboard bounds`);
    await page.close();
  }
} finally { await browser.close(); }
