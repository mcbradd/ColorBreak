import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
const { chromium } = createRequire(import.meta.url)('playwright');
const base = process.argv[2] ?? 'http://127.0.0.1:4173/';
const evidenceDir = process.env.COLORBREAK_EVIDENCE_DIR;
if (evidenceDir) mkdirSync(evidenceDir, { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
  const publicationResponse = await fetch(new URL("data/prices/index.json", base));
  assert.ok(publicationResponse.ok, "published price index is available");
  const publication = await publicationResponse.json();
  const staleClock = Date.parse(publication.observedAt) + 7 * 60 * 60 * 1000;
  assert.ok(Number.isFinite(staleClock), "published price timestamp is valid");
  for (const width of [320, 390, 768]) {
    const context = await browser.newContext({ viewport: { width, height: 720 }, permissions: ['clipboard-read', 'clipboard-write'] });
    await context.addInitScript((now) => {
      const NativeDate = Date;
      class StaleClock extends NativeDate {
        constructor(...args) { if (args.length) super(...args); else super(now); }
        static now() { return now; }
      }
      globalThis.Date = StaleClock;
    }, staleClock);
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`${base}#buyer`);
    assert.equal(await page.getByText('Add a product to begin', { exact: true }).count(), 0);
    await page.getByRole('combobox', { name: 'Find a set or product' }).fill('eoe collector');
    await page.getByRole('option', { name: /EOE\) Collector Booster Pack$/ }).click();
    await page.locator('.buyer-slot-row').first().waitFor({ state: 'attached' });
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
    const rowBox = await page.locator('.quick-break-line .quick-line-identity').boundingBox();
    const quantityBox = await page.locator('.quick-break-line .quantity-selector').boundingBox();
    assert.ok(quantityBox.x >= rowBox.x + rowBox.width && quantityBox.y < rowBox.y + rowBox.height, 'quantity stays beside product');
    await page.getByRole('button', { name: 'Break panel', exact: true }).click();
    await page.getByRole('heading', { name: 'Check a bid', exact: true }).waitFor();
    const candle = page.getByRole('button', { name: /^White: MIN / });
    await candle.click();
    const range = page.getByRole('dialog', { name: 'White value range', exact: true });
    await range.waitFor();
    await range.getByRole('button', { name: /^White expected value:/ }).click();
    await page.getByRole('dialog', { name: 'White expected value', exact: true }).waitFor();
    await page.keyboard.press('Escape');
    await range.waitFor();
    await page.keyboard.press('Escape');
    assert.equal(await candle.evaluate(el => document.activeElement === el), true, 'chart details return to the team range');
    await page.getByRole('button', { name: 'Mark Blue taken by another buyer', exact: true }).click();
    assert.equal(await page.getByRole('button', { name: 'Restore Blue', exact: true }).getAttribute('aria-pressed'), 'true');
    assert.match(await page.locator('.decision-kicker').innerText(), /7 slots left/);
    await page.getByRole('button', { name: 'Restore Blue', exact: true }).click();
    await page.getByRole('button', { name: 'Select Red for bid preview', exact: true }).click();
    assert.match(await page.locator('.decision-reason').innerText(), /selected preview slots \(Red\)/);
    await page.getByRole('button', { name: 'Select White for bid preview', exact: true }).click();
    assert.match(await page.locator('.decision-reason').innerText(), /selected preview slots \(Red, White\)/);
    await page.getByRole('button', { name: 'Remove Red from bid preview', exact: true }).click();
    assert.match(await page.locator('.decision-reason').innerText(), /selected preview slots \(White\)/);
    await page.getByRole('button', { name: 'Remove White from bid preview', exact: true }).click();
    assert.match(await page.locator('.decision-reason').innerText(), /all 8 remaining slots/);
    assert.equal(await page.getByRole('button', { name: /mine/i }).count(), 0, 'buyer view has no ownership controls');
    await page.getByRole('button', { name: 'Decision panel', exact: true }).click();
    const refresh = page.getByRole('button', { name: /Prices over 6 hours old.*Refresh/ });
    await refresh.waitFor({ state: 'visible' });
    await refresh.click();
    await page.locator('.price-refresh-answer').waitFor({ timeout: 30000 });
    const checked = page.getByRole('button', { name: 'No newer data' });
    await checked.waitFor({ state: 'visible' });
    assert.equal(await checked.isEnabled(), true);
    assert.ok(await checked.evaluate(element => element.classList.contains('is-cleared')), 'no-newer result uses the neutral status style');
    assert.doesNotMatch(await page.locator('.command-dock-status').innerText(), /Older prices/, 'acknowledged age warning clears from the live estimate');
    const refreshBox = await checked.boundingBox();
    assert.ok(refreshBox && refreshBox.x >= 0 && refreshBox.x + refreshBox.width <= width + 1, `refresh status fits ${width}px: ${JSON.stringify(refreshBox)}`);
    await page.getByRole('button', { name: 'Break panel', exact: true }).click();
    await page.getByRole('button', { name: 'Show cards in White team', exact: true }).click();
    const team = page.getByRole('table', { name: 'Cards in White team', exact: true });
    await team.locator('.card-member-row').first().waitFor();
    assert.equal(await team.getByRole('columnheader', { name: /Price/ }).getAttribute('aria-sort'), 'descending');
    for (const column of ['Price', 'Card', 'Chance', 'Adds']) {
      const header = team.getByRole('columnheader', { name: new RegExp(`Sort by ${column}`) });
      const previous = await header.getAttribute('aria-sort');
      await header.getByRole('button').click();
      const direction = previous === 'descending' || (previous === 'none' && column === 'Card') ? 'ascending' : 'descending';
      assert.equal(await header.getAttribute('aria-sort'), direction);
      assert.equal(await header.locator('.card-member-column-icon').count(), 1);
      assert.equal(await header.locator('svg:not(.card-member-column-icon)').count(), 1);
      await header.getByRole('button').click();
      assert.equal(await header.getAttribute('aria-sort'), direction === 'ascending' ? 'descending' : 'ascending');
    }
    assert.deepEqual(await team.locator('.card-member-columns button').evaluateAll(buttons => buttons.map(button => button.title)), [
      'Card', 'Market price', 'Pull chance', 'Value added to average',
    ]);
    const teamThumbnail = team.locator('.card-member-thumbnail-button').first();
    await teamThumbnail.click();
    const fullPage = page.getByRole('dialog');
    await fullPage.waitFor();
    await page.waitForFunction(() => {
      const box = document.querySelector('.card-inspector')?.getBoundingClientRect();
      return box && Math.abs(box.width - innerWidth) < 2 && Math.abs(box.height - innerHeight) < 2;
    });
    const fullPageBox = await fullPage.boundingBox();
    assert.ok(Math.abs(fullPageBox.width - width) < 2 && fullPageBox.height >= 718, `full-page card details: ${JSON.stringify(fullPageBox)}`);
    await page.keyboard.press('Escape');
    await fullPage.waitFor({ state: 'hidden' });
    assert.equal(await teamThumbnail.evaluate(el => el === document.activeElement), true, 'focus returns to thumbnail');
    await page.getByRole('button', { name: 'Hide cards in White team', exact: true }).click();
    if (width === 390) {
      const recipient = await browser.newPage({ viewport: { width, height: 720 } });
      await recipient.goto(url);
      await recipient.locator('.quick-break-lines').getByText('Collector Booster Pack', { exact: true }).waitFor();
      assert.match(await recipient.locator('.quick-break-lines').innerText(), /Collector Booster Pack/);
      assert.equal(await recipient.locator('.quick-break-line .quantity-selector input').inputValue(), '1');
      await recipient.close();
    }
    await page.getByRole('button', { name: 'Break panel', exact: true }).click();
    await page.getByRole('button', { name: 'Adjust assumptions', exact: true }).click();
    const widths = await page.locator('.buyer-assumptions-body .shipping-mode, .buyer-assumptions-body .number-field > div, .buyer-assumptions-body .bulk-value-field > div').evaluateAll(els => els.map(el => el.getBoundingClientRect().width));
    assert.ok(Math.max(...widths) - Math.min(...widths) < 2, `matched input widths: ${widths}`);
    assert.equal(await page.getByRole('textbox', { name: 'Tax', exact: true }).evaluate(el => getComputedStyle(el).textAlign), 'right');
    assert.equal(await page.getByRole('textbox', { name: 'Tax', exact: true }).locator('..').locator('..').locator('b').innerText(), '%');
    await page.getByRole('button', { name: 'Close Assumptions', exact: true }).click();
    await page.getByRole('button', { name: 'Decision panel', exact: true }).click();
    await page.getByText('Break evidence', { exact: true }).click();
    await page.locator('.slot-detail .card-member-row').first().waitFor({ timeout: 30000 });
    assert.equal(await page.locator('.slot-detail .answer-note').count(), 2, 'one note per value-summary and membership section');
    assert.equal(await page.locator('.value-summary .answer-note').count(), 1);
    await page.getByRole('button', { name: 'What affects these card values', exact: true }).click();
    const tip = page.getByRole('tooltip');
    assert.ok((await tip.innerText()).split(/\s+/).length <= 65);
    await page.keyboard.press('Escape');
    const overlaps = await page.locator('.slot-detail .card-member-columns, .slot-detail .card-member-row').evaluateAll(rows => rows.some(row => {
      const cells = [...row.children].filter(el => getComputedStyle(el).display !== 'none');
      return cells.some((el, i) => cells.slice(i + 1).some(other => {
        const a = el.getBoundingClientRect(); const b = other.getBoundingClientRect();
        return a.left < b.right - 1 && a.right > b.left + 1 && a.top < b.bottom - 1 && a.bottom > b.top + 1;
      }));
    }));
    assert.equal(overlaps, false, 'card-list cells never overlap');
    if (width < 700) {
      const fontSizes = await page.locator('.slot-detail .card-member-columns button, .slot-detail .card-member-name strong, .slot-detail .card-member-row > span').evaluateAll(elements => elements.map(el => parseFloat(getComputedStyle(el).fontSize)));
      assert.ok(fontSizes.every(size => size >= 17), `phone table respects readable text size: ${fontSizes}`);
    }
    const memberTableWidth = await page.locator('.slot-detail .card-member-table').evaluate(table => ({ client: table.clientWidth, content: table.scrollWidth }));
    assert.ok(memberTableWidth.content <= memberTableWidth.client + 1, `card list fits without horizontal scrolling: ${JSON.stringify(memberTableWidth)}`);
    assert.equal(await page.locator('.slot-detail .card-member-scroll').count(), 0, 'card list has no horizontal scroll container');
    if (evidenceDir) await page.locator('.slot-detail').screenshot({ path: join(evidenceDir, `value-details-${width}.png`) });
    await page.locator('.slot-detail .card-member-thumbnail-button').first().click();
    const dialog = page.getByRole('dialog', { name: /./ });
    await dialog.waitFor();
    assert.equal(await dialog.locator('.answer-note').count(), 1);
    assert.equal(await dialog.getByText('Copies per break', { exact: true }).count(), 0);
    assert.equal(await dialog.getByText('Selected finish price', { exact: true }).count(), 0);
    const art = dialog.locator('.card-full-image');
    const artBox = await art.boundingBox();
    assert.ok(artBox.height > artBox.width * 1.3, `full portrait image ${JSON.stringify(artBox)}`);
    assert.ok(artBox.width >= Math.min(width - 50, 300));
    if (width < 700) {
      const infoBox = await dialog.locator('.card-info').boundingBox();
      assert.ok(infoBox.y >= artBox.y + artBox.height, 'card text follows the full image without overlap');
    }
    const chance = await dialog.locator('.primary-stat strong').innerText();
    assert.ok(!/\d\.\d.*breaks/.test(chance), `whole-break odds: ${chance}`);
    await page.waitForTimeout(400);
    await art.evaluate(async el => { if (el instanceof HTMLImageElement && !el.complete) await new Promise(resolve => { el.onload = resolve; el.onerror = resolve; }); });
    if (evidenceDir) await page.screenshot({ path: join(evidenceDir, `card-details-${width}.png`) });
    await page.getByRole('button', { name: 'Close card details' }).click();
    await page.getByRole('button', { name: 'Break panel', exact: true }).click();
    await page.getByRole('button', { name: 'Custom', exact: true }).click();
    const largeBreakLayout = await page.evaluate(() => ({
      viewportWidth: innerWidth,
      pageWidth: document.documentElement.scrollWidth,
      viewportHeight: innerHeight,
      pageHeight: document.documentElement.scrollHeight,
      scrollX,
      scrollY,
      randomSpots: document.querySelector('.large-break-spot-label-text')?.getBoundingClientRect().toJSON(),
      help: document.querySelector('.large-break-spot-label > .tip')?.getBoundingClientRect().toJSON(),
    }));
    assert.ok(largeBreakLayout.pageWidth <= largeBreakLayout.viewportWidth + 1, `large break fits the viewport width: ${JSON.stringify(largeBreakLayout)}`);
    assert.ok(largeBreakLayout.pageHeight <= largeBreakLayout.viewportHeight + 1, `large break stays in the fixed workspace: ${JSON.stringify(largeBreakLayout)}`);
    assert.deepEqual([largeBreakLayout.scrollX, largeBreakLayout.scrollY], [0, 0], 'large break does not move the page');
    assert.ok(largeBreakLayout.help.left >= largeBreakLayout.randomSpots.right - 1, `random-spots help follows its label: ${JSON.stringify(largeBreakLayout)}`);
    if (evidenceDir && width === 320) await page.screenshot({ path: join(evidenceDir, 'large-break-320.png') });
    await page.getByRole('button', { name: 'Decision panel', exact: true }).click();
    await page.getByRole('button', { name: 'Adjust shipping & tax', exact: true }).click();
    assert.equal(await page.getByRole('textbox', { name: 'Tax', exact: true }).isVisible(), true, 'cost button opens assumptions');
    await page.getByRole('button', { name: 'Close Assumptions', exact: true }).click();
    await page.waitForFunction(() => document.activeElement?.textContent === 'Adjust shipping & tax');
    await page.getByRole('button', { name: 'Decision panel', exact: true }).click();
    const named = page.locator('.large-break-card-main').first();
    await named.waitFor();
    await named.click();
    await page.locator('.large-break-card .card-member-row').first().waitFor();
    assert.equal(await page.locator('.large-break-card').getByRole('columnheader', { name: /Price/ }).getAttribute('aria-sort'), 'descending');
    await page.locator('.large-break-card .card-member-thumbnail-button').first().click();
    await page.getByRole('dialog').waitFor();
    await page.getByRole('button', { name: 'Close card details' }).click();
    // Choose a nonempty residual group; named-card allocation can empty a color.
    const residuals = page.locator('.large-break-category-main').filter({ hasText: /[1-9]\d* remaining cards?/ });
    await residuals.first().click();
    const residualTable = page.locator('.large-break-category .card-member-table');
    await residualTable.waitFor();
    await residualTable.getByRole('button', { name: /Sort by Price/ }).click();
    assert.equal(await residualTable.getByRole('columnheader', { name: /Price/ }).getAttribute('aria-sort'), 'ascending');
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'no page overflow');
    assert.deepEqual(errors, []);
    console.log(`PASS ${width}px: teams, four sortable columns, thumbnail focus, fullscreen details, named/residual slots, section notes, controls, sharing and full card art`);
    await context.close();
  }
} finally { await browser.close(); }
