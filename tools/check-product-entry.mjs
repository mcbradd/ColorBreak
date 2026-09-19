import { chromium, webkit } from 'playwright';
import assert from 'node:assert/strict';
import { join } from 'node:path';
const base = process.argv[2] ?? 'http://127.0.0.1:4173/';
const browser = await (process.env.COLORBREAK_BROWSER === 'webkit' ? webkit : chromium).launch();
try {
  for (const width of [320, 390, 440, 1440]) for (const job of ['buyer', 'seller']) {
    const page = await browser.newPage({ viewport: { width, height: 956 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => {
      const viewport = new EventTarget();
      Object.assign(viewport, { height: innerHeight, width: innerWidth, offsetTop: 0, offsetLeft: 0, scale: 1 });
      Object.defineProperty(window, 'visualViewport', { configurable: true, value: viewport });
      window.setTestViewport = (height, top) => {
        Object.assign(viewport, { height, offsetTop: top });
        viewport.dispatchEvent(new Event('resize'));
        viewport.dispatchEvent(new Event('scroll'));
      };
    });
    await page.goto(`${base}#${job}`);
    const query = page.getByRole('combobox');
    await query.fill('e');
    const sets = page.getByRole('group', { name: 'Matching sets' });
    await sets.getByRole('button', { name: /Select set EOE / }).waitFor();
    await query.fill('f');
    assert.equal(await sets.getByRole('button', { name: /Select set EOE / }).count(), 0);
    await sets.getByRole('button', { name: /Select set FIN / }).waitFor();
    await query.fill('');
    await query.blur();
    if (job === 'buyer') {
      const heading = page.locator('.buyer-workspace-heading');
      const assumptions = heading.getByRole('button', { name: 'Adjust assumptions' });
      const bulk = heading.getByRole('switch', { name: 'Bulk filter' });
      const boxes = await Promise.all([heading.locator('h1'), assumptions, bulk].map(el => el.boundingBox()));
      assert.ok(boxes.every(b => b && b.x >= 0 && b.x + b.width <= width + 1), `header fits ${width}: ${JSON.stringify(boxes)}`);
      assert.ok(Math.max(...boxes.map(b => b.y)) < Math.min(...boxes.map(b => b.y + b.height)), 'title and controls share a row');
      assert.ok(boxes[0].x + boxes[0].width <= boxes[1].x, 'title and controls do not overlap');
      const enabled = await bulk.getAttribute('aria-checked');
      await bulk.click();
      assert.equal(await bulk.getAttribute('aria-checked'), enabled === 'true' ? 'false' : 'true');
      if (process.env.COLORBREAK_EVIDENCE_DIR) await heading.screenshot({ path: join(process.env.COLORBREAK_EVIDENCE_DIR, `buyer-header-${width}.png`) });
      await assumptions.click();
      const panel = page.getByRole('dialog', { name: 'Assumptions', exact: true });
      await panel.getByRole('textbox', { name: 'Tax', exact: true }).fill('7');
      await panel.getByRole('button', { name: 'Close Assumptions' }).click();
      await panel.waitFor({ state: 'hidden' });
      assert.ok(await assumptions.evaluate(el => el === document.activeElement), 'assumptions restores its caller');
      await assumptions.click();
      assert.equal(await panel.getByRole('textbox', { name: 'Tax', exact: true }).inputValue(), '7');
      await page.keyboard.press('Escape');
    }
    await page.getByRole('button', { name: 'Paste / screenshot', exact: true }).click();
    await page.getByRole('button', { name: 'Browse products', exact: true }).click();
    const search = page.getByRole('textbox', { name: 'Search sets by name or code' });
    const sheet = page.getByRole('dialog', { name: 'Add product' });
    await search.fill('e');
    await page.locator('.choice-list > button').first().waitFor();
    const headerBefore = await sheet.locator('header').boundingBox();
    await sheet.locator('.choice-list').evaluate(el => { el.scrollTop = el.scrollHeight; });
    assert.deepEqual(await sheet.locator('header').boundingBox(), headerBefore, 'scrolling results never moves the exit');
    await search.fill('eoe');
    await page.evaluate(() => document.documentElement.style.setProperty('--safe-top', '47px'));
    for (const [height, top] of [[350, 28], [190, 52]]) {
      await page.evaluate(([h, t]) => window.setTestViewport(h, t), [height, top]);
      await page.waitForTimeout(180);
      const controls = await Promise.all([search, sheet.getByRole('button', { name: 'Close', exact: true })].map(el => el.boundingBox()));
      assert.ok(controls.every(b => b.y >= top - 1 && b.y + b.height <= top + height + 1), `search and exit visible ${job} ${width}/${height}: ${JSON.stringify(controls)}`);
      const geometry = await sheet.evaluate(el => ({ h: el.clientHeight, sh: el.scrollHeight, w: el.clientWidth, sw: el.scrollWidth }));
      assert.ok(geometry.sh <= geometry.h + 1 && geometry.sw <= geometry.w + 1, `entry frame cannot scroll: ${JSON.stringify(geometry)}`);
    }
    await page.evaluate(() => window.setTestViewport(956, 0));
    await page.getByRole('button', { name: /EOE Edge of Eternities/ }).click();
    assert.equal(await sheet.getByRole('button', { name: 'Close', exact: true }).count(), 1, 'direct exit persists after choosing a set');
    await sheet.getByRole('button', { name: 'Close', exact: true }).click();
    await sheet.waitFor({ state: 'hidden' });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'no document horizontal overflow');
    assert.deepEqual(errors, []);
    console.log(`PASS ${job} ${width}px: instant set buttons, header controls, fixed entry frame, keyboard search/exit, direct Close`);
    await page.close();
  }
} finally { await browser.close(); }
