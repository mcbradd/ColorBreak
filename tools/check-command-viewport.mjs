// Responsive browser geometry, including modeled iOS-style visual-only resize.
// This does not claim a physical iPhone keyboard or browser-bar test.
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const { chromium, webkit } = createRequire(import.meta.url)('playwright');
const base = process.argv[2] ?? 'http://127.0.0.1:4173/';
const engine = process.env.COLORBREAK_BROWSER === 'webkit' ? webkit : chromium;
const browser = await engine.launch({ headless: true });
try {
  for (const width of [320, 390, 430, 768]) for (const job of ['buyer', 'seller']) {
    const page = await browser.newPage({ viewport: { width, height: 844 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => {
      const viewport = new EventTarget();
      Object.assign(viewport, { height: innerHeight, width: innerWidth, offsetTop: 0, offsetLeft: 0, scale: 1 });
      Object.defineProperty(window, 'visualViewport', { configurable: true, value: viewport });
      window.setTestViewport = (height, top) => {
        Object.assign(viewport, { height, width: innerWidth, offsetTop: top });
        viewport.dispatchEvent(new Event('resize'));
        viewport.dispatchEvent(new Event('scroll'));
      };
    });
    await page.goto(`${base}#${job}`);
    await page.getByRole('combobox').fill('eoe collector');
    await page.getByRole('option', { name: /EOE\) Collector Booster Pack$/ }).click();
    await page.getByRole('combobox').blur();
    const dock = page.getByRole('complementary', { name: 'Live decision' });
    await dock.waitFor();
    assert.equal(await dock.evaluate(el => getComputedStyle(el).position), 'fixed', `${width}px dock is fixed`);
    await page.evaluate(() => {
      for (const [key, value] of Object.entries({ top: 47, bottom: 34, left: 16, right: 16 })) document.documentElement.style.setProperty(`--safe-${key}`, `${value}px`);
    });
    assert.ok((await dock.getByRole('button').first().boundingBox()).x >= 16, 'dock content clears side safe areas');
    const quantity = page.getByRole('textbox', { name: 'EOE Collector Booster Pack quantity', exact: true });
    for (const [height, top] of [[350, 28], [190, 52]]) {
      await quantity.fill('12');
      await page.evaluate(([h, t]) => window.setTestViewport(h, t), [height, top]);
      const done = page.getByRole('button', { name: 'Done entering EOE Collector Booster Pack quantity', exact: true });
      await done.waitFor();
      await page.waitForTimeout(200);
      const [inputBox, doneBox, dockBox] = await Promise.all([quantity.boundingBox(), done.boundingBox(), dock.boundingBox()]);
      assert.ok(inputBox.y >= top - 1 && doneBox.y >= top - 1 && Math.max(inputBox.y + inputBox.height, doneBox.y + doneBox.height) <= dockBox.y + 1, `visible quantity + Done: ${job} ${width} ${height} ${JSON.stringify({ inputBox, doneBox, dockBox })}`);
      assert.ok(Math.abs(dockBox.y + dockBox.height - (top + height)) < 2, 'dock tracks visual viewport end');
      await done.click();
      assert.equal(await quantity.inputValue(), '12');
      await page.evaluate(() => window.setTestViewport(844, 0));
      await page.waitForTimeout(160);
    }
    await page.getByRole('combobox').fill('eoe');
    await dock.getByRole('button').first().click();
    await page.waitForTimeout(200);
    const result = page.getByRole('region', { name: job === 'buyer' ? 'Bid decision' : 'Break value at a glance' });
    assert.equal(await result.isVisible(), true, 'dock navigation owns the result after input blur');
    const value = job === 'buyer' ? page.getByRole('button', { name: /^Your bid limit:/ }) : page.locator('.glance-total .value-information');
    await value.click();
    const dialog = page.getByRole('dialog');
    const close = dialog.getByRole('button', { name: /^Close / });
    for (const height of [350, 190]) {
      await page.evaluate(h => window.setTestViewport(h, 28), height);
      await page.waitForTimeout(160);
      const bounds = await dialog.boundingBox(), closeBounds = await close.boundingBox();
      assert.ok(bounds.x >= 16 && bounds.x + bounds.width <= width - 16 + 1, 'information respects horizontal safe areas');
      assert.ok(closeBounds.y >= 28 && closeBounds.y + closeBounds.height <= height + 28, 'close remains inside visual viewport');
    }
    await close.focus();
    await page.keyboard.press('Shift+Tab');
    assert.ok(await dialog.evaluate(el => el.contains(document.activeElement)), 'keyboard focus stays in layer');
    await page.keyboard.press('Escape');
    await dialog.waitFor({ state: 'hidden' });
    await page.evaluate(() => window.setTestViewport(844, 0));
    if (job === 'seller') {
      await page.getByRole('button', { name: 'Plan panel', exact: true }).click();
      await page.getByRole('button', { name: 'Add products', exact: true }).click();
      assert.equal(await page.getByRole('combobox').isVisible(), true, 'Plan returns directly to visible entry');
    }
    await page.setViewportSize({ width: 844, height: 390 });
    await page.evaluate(() => {
      document.documentElement.style.setProperty('--safe-left', '0px');
      document.documentElement.style.setProperty('--safe-right', '47px');
      window.setTestViewport(390, 0); dispatchEvent(new Event('orientationchange'));
    });
    await page.waitForTimeout(200);
    const dockRight = await dock.getByRole('button').last().boundingBox();
    assert.ok(dockRight.x + dockRight.width <= 844 - 47 + 1, 'landscape dock clears the right-side cutout');
    const panelRight = await page.locator('.command-navigation').boundingBox();
    assert.ok(panelRight.x + panelRight.width <= 844 - 47 + 1, 'landscape workspace clears the right-side cutout');
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'landscape has no horizontal overflow');
    assert.deepEqual(errors, []);
    console.log(`PASS ${job} ${width}px: safe areas, 350/190px visual-only keyboard, panning, Done, dock navigation, modal focus/close, landscape`);
    await page.close();
  }
} finally { await browser.close(); }
