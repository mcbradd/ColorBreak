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
    if (job === 'buyer' && width < 900) {
      const search = page.getByRole('combobox', { name: 'Find a set or product' });
      const sets = page.getByRole('group', { name: 'Available sets, newest releases first' });
      await sets.waitFor();
      const measureSetArea = () => page.evaluate(() => {
        const list = document.querySelector('.quick-set-suggestions');
        const body = document.querySelector('.command-body');
        const listBounds = list.getBoundingClientRect();
        const bodyBounds = body.getBoundingClientRect();
        return { bottomGap: bodyBounds.bottom - listBounds.bottom, listHeight: list.clientHeight, listScrollHeight: list.scrollHeight, pageHeight: document.documentElement.scrollHeight, viewportHeight: innerHeight };
      });
      const closedArea = await measureSetArea();
      assert.ok(closedArea.bottomGap >= 0 && closedArea.bottomGap <= 16, `set columns fill the closed viewport: ${JSON.stringify(closedArea)}`);
      assert.ok(closedArea.listScrollHeight > closedArea.listHeight, 'the closed set area scrolls its full catalog');
      await search.focus();
      await page.evaluate(() => window.setTestViewport(350, 28));
      await page.waitForFunction(() => document.documentElement.classList.contains('keyboard-open'));
      const keyboardArea = await measureSetArea();
      assert.ok(keyboardArea.bottomGap >= 0 && keyboardArea.bottomGap <= 16, `set columns fill the keyboard viewport: ${JSON.stringify(keyboardArea)}`);
      assert.ok(keyboardArea.listScrollHeight > keyboardArea.listHeight, 'the keyboard set area scrolls its full catalog');
      assert.equal(keyboardArea.pageHeight, keyboardArea.viewportHeight, 'keyboard resizing does not expand the page');
      await page.evaluate(() => window.setTestViewport(844, 0));
      await search.blur();
      await page.waitForFunction(() => !document.documentElement.classList.contains('keyboard-open'));
    }
    await page.getByRole('combobox').fill('eoe collector');
    await page.getByRole('option', { name: /EOE\) Collector Booster Pack$/ }).click();
    await page.getByRole('combobox').blur();
    const dock = page.getByRole('complementary', { name: 'Live decision' });
    await dock.waitFor();
    if (job === 'buyer') {
      await page.waitForFunction(() => !document.documentElement.classList.contains('keyboard-open'));
      const slots = await page.evaluate(() => {
        const panel = document.querySelector('.buyer-slot-control');
        const dock = document.querySelector('[aria-label="Live decision"]');
        const panelBounds = panel.getBoundingClientRect();
        const dockBounds = dock.getBoundingClientRect();
        const list = panel.querySelector('.buyer-slot-list');
        const rows = [...panel.querySelectorAll('.buyer-slot-row')].map(row => {
          const bounds = row.getBoundingClientRect();
          const top = row.querySelector('.buyer-slot-top').getBoundingClientRect();
          const bottom = row.querySelector('.buyer-slot-bottom').getBoundingClientRect();
          return { top: bounds.top, bottom: bounds.bottom, innerTop: top.top, innerTopBottom: top.bottom, innerBottom: bottom.top, innerBottomBottom: bottom.bottom };
        });
        return {
          keyboardOpen: document.documentElement.classList.contains('keyboard-open'),
          count: rows.length,
          columnCount: getComputedStyle(list).gridTemplateColumns.trim().split(/\s+/).length,
          distinctRowTops: new Set(rows.map(row => Math.round(row.top))).size,
          panelBottom: panelBounds.bottom,
          panelScrollHeight: panel.scrollHeight,
          panelClientHeight: panel.clientHeight,
          dockTop: dockBounds.top,
          pageHeight: document.documentElement.scrollHeight,
          viewportHeight: innerHeight,
          rows,
        };
      });
      assert.equal(slots.keyboardOpen, false, 'slot fit is measured with the keyboard closed');
      assert.equal(slots.count, 8, 'all eight color slots are rendered');
      assert.equal(slots.columnCount, 1, 'all slots stay in one column');
      assert.equal(slots.distinctRowTops, 8, 'each slot occupies its own row');
      assert.ok(slots.panelScrollHeight <= slots.panelClientHeight + 1, `slot panel has no hidden vertical overflow: ${JSON.stringify(slots)}`);
      assert.ok(slots.panelBottom <= slots.dockTop + 1, `all eight slots fit above the decision dock: ${JSON.stringify(slots)}`);
      assert.ok(slots.rows.every(row => row.innerTop >= row.top - 1 && row.innerTopBottom <= row.bottom + 1 && row.innerBottom >= row.top - 1 && row.innerBottomBottom <= row.bottom + 1), `slot data stays inside its two rows: ${JSON.stringify(slots.rows)}`);
      assert.equal(slots.pageHeight, slots.viewportHeight, 'the closed slot layout does not expand the page');
      const controls = await page.evaluate(() => {
        const row = document.querySelector('.buyer-slot-row');
        const check = row.querySelector('.slot-target-btn');
        const cancel = row.querySelector('.slot-disable-btn');
        const box = row.querySelector('.buyer-slot-ev');
        const rect = element => { const bounds = element.getBoundingClientRect(); return { width: bounds.width, height: bounds.height }; };
        return { check: rect(check), cancel: rect(cancel), icon: rect(check.querySelector('svg')), cancelIcon: rect(cancel.querySelector('svg')), evBackground: getComputedStyle(box).backgroundColor, evColor: getComputedStyle(box).color };
      });
      assert.deepEqual(controls.check, controls.cancel, 'check and cancel controls share one size');
      assert.deepEqual(controls.icon, controls.cancelIcon, 'check and cancel icons share one size');
      assert.notEqual(controls.evBackground, 'rgba(0, 0, 0, 0)', 'EV uses a solid theme color');
      assert.ok(controls.evColor.split(/[(), ]+/).filter(Boolean).slice(1, 4).every(channel => Number(channel) < 32), 'EV uses dark text on its bright box');
      const checkButton = page.getByRole('button', { name: 'Select White for bid preview' });
      const inactiveColor = await checkButton.evaluate(el => getComputedStyle(el).color);
      const inactiveChannels = inactiveColor.match(/\d+/g).map(Number);
      assert.ok(inactiveChannels[2] > inactiveChannels[1] && inactiveChannels[2] > inactiveChannels[0], 'inactive check is grey');
      await checkButton.click();
      const active = await page.getByRole('button', { name: 'Remove White from bid preview' }).evaluate(el => ({ pressed: el.getAttribute('aria-pressed'), background: getComputedStyle(el).backgroundColor }));
      assert.equal(active.pressed, 'true', 'check selects the slot for preview');
      const activeChannels = active.background.match(/\d+/g).map(Number);
      assert.ok(activeChannels[1] > activeChannels[0] && activeChannels[1] > activeChannels[2], 'selected check uses the green active state');
    }
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
    const panelRight = await page.locator(job === 'buyer' ? '.break-format-toolbar' : '.command-navigation').boundingBox();
    assert.ok(panelRight.x + panelRight.width <= 844 - 47 + 1, 'landscape workspace clears the right-side cutout');
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'landscape has no horizontal overflow');
    assert.deepEqual(errors, []);
    console.log(`PASS ${job} ${width}px: safe areas, 350/190px visual-only keyboard, panning, Done, dock navigation, modal focus/close, landscape`);
    await page.close();
  }
} finally { await browser.close(); }
