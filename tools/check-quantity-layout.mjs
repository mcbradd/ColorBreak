// Optional real-browser regression: NODE_PATH must include Playwright.
// Run against the preview or deployed site: node tools/check-quantity-layout.mjs <url>
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const { chromium } = createRequire(import.meta.url)('playwright');
const base = process.argv[2] ?? 'http://127.0.0.1:4173/';
const browser = await chromium.launch({ headless: true });
try {
  for (const width of [320, 390, 768]) {
    const page = await browser.newPage({ viewport: { width, height: 700 } });
    await page.goto(`${base}#buyer`);
    await page.getByRole('button', { name: 'Add products', exact: true }).click();
    await page.getByRole('textbox', { name: 'Search sets by name or code' }).fill('tmt');
    await page.getByRole('button', { name: /TMT Teenage Mutant Ninja Turtles/ }).click();
    const before = page.getByRole('button', { name: 'Play Booster Pack', exact: true });
    await page.waitForTimeout(500);
    await before.evaluate(el => el.scrollIntoView({ block: "center" }));
    await page.waitForTimeout(100);
    const beforeBox = await before.boundingBox();
    await before.click();
    const row = page.getByRole('group', { name: 'Selected Play Booster Pack', exact: true });
    const afterBox = await row.boundingBox();
    assert.ok(Math.abs(beforeBox.height - afterBox.height) < 1, `row height changed at ${width}`);
    assert.ok(Math.abs(beforeBox.y - afterBox.y) < 1, `selection moved at ${width}: ${JSON.stringify({beforeBox,afterBox})}`);
    if (width === 390 && process.env.QUANTITY_SCREENSHOT) await page.screenshot({path: process.env.QUANTITY_SCREENSHOT});
    const input = row.getByRole('textbox');
    const minus = row.getByRole('button', { name: /Remove/ });
    const plus = row.getByRole('button', { name: /Increase/ });
    const [m, n, p] = await Promise.all([minus.boundingBox(), input.boundingBox(), plus.boundingBox()]);
    assert.ok(m.x < n.x && n.x < p.x && Math.abs(m.y - p.y) < 1, `quantity order at ${width}`);
    assert.equal(await input.getAttribute('inputmode'), 'numeric');
    await input.fill('24');
    await page.setViewportSize({ width, height: 190 });
    await page.waitForTimeout(250);
    const done = row.getByRole('button', { name: /Done entering/ });
    const fieldBox = await input.boundingBox(), doneBox = await done.boundingBox();
    const headerBox = await page.locator('.sheet > header').boundingBox();
    const footerBox = await page.locator('.sheet > footer').boundingBox();
    assert.ok(fieldBox.y >= headerBox.y + headerBox.height - 1, `input under header at ${width}`);
    assert.ok(doneBox.y + doneBox.height <= (footerBox?.y ?? 190) + 1, `Done hidden at ${width}: ${JSON.stringify({fieldBox,doneBox,headerBox,footerBox})}`);
    await done.click();
    assert.equal(await input.inputValue(), '24');
    await plus.click();
    await page.waitForTimeout(100);
    assert.equal(await input.inputValue(), '25');
    await page.setViewportSize({ width, height: 700 });
    await page.getByRole('button', { name: 'Done', exact: true }).click();
    await page.getByRole('dialog', { name: 'Add product' }).waitFor({ state: 'detached' });
    console.log(`PASS ${width}px: stable selection, − number +, numeric edit, keyboard-height input and Done, commit`);
    await page.goto(`${base}#seller`);
    await page.getByRole('combobox').fill('tmt play');
    await page.getByRole('option', { name: /TMT\) Play Booster Pack$/ }).click();
    const sellerQuantity = page.getByRole('textbox', { name: 'TMT Play Booster Pack quantity', exact: true });
    await sellerQuantity.fill('12');
    await page.setViewportSize({ width, height: 190 });
    await page.waitForTimeout(250);
    const sellerDone = page.getByRole('button', { name: 'Done entering TMT Play Booster Pack quantity', exact: true });
    const sellerInputBox = await sellerQuantity.boundingBox(), sellerDoneBox = await sellerDone.boundingBox();
    const dock = await page.locator('.seller-value-dock').boundingBox();
    assert.ok(sellerInputBox.y >= 0 && sellerDoneBox.y + sellerDoneBox.height <= (dock?.y ?? 190) + 1, `seller numeric entry hidden at ${width}`);
    await sellerDone.click();
    assert.equal(await sellerQuantity.inputValue(), '12');
    console.log(`PASS ${width}px seller: shared quantity and visible short-viewport Done`);
    await page.close();
  }
} finally { await browser.close(); }
