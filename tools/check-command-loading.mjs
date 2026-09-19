import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const { chromium } = createRequire(import.meta.url)('playwright');
const base = process.argv[2] ?? 'http://127.0.0.1:4173/';
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 800 }, serviceWorkers: 'block' });
  let failures = 0;
  await page.route('**/SellerView-*.js', route => { failures++; return route.abort(); });
  await page.goto(`${base}#seller`);
  await page.getByRole('combobox').fill('eoe collector');
  await page.getByRole('option', { name: /EOE\) Collector Booster Pack$/ }).click();
  await page.getByRole('button', { name: 'Plan panel', exact: true }).click();
  await page.getByRole('alert').filter({ hasText: 'Pricing tools couldn’t load' }).waitFor({ timeout: 3000 });
  assert.ok(failures > 0, 'the deferred module request actually failed');
  await page.getByRole('button', { name: 'Values panel', exact: true }).click();
  assert.equal(await page.getByRole('region', { name: 'Break value at a glance' }).isVisible(), true);
  await page.getByRole('button', { name: 'Plan panel', exact: true }).click();
  await page.unroute('**/SellerView-*.js');
  await page.getByRole('button', { name: 'Reload pricing tools', exact: true }).click();
  await page.getByRole('textbox', { name: 'EOE Collector Booster Pack quantity', exact: true }).waitFor();
  assert.equal(await page.getByRole('textbox', { name: 'EOE Collector Booster Pack quantity', exact: true }).inputValue(), '1');
  await page.getByRole('button', { name: 'Plan panel', exact: true }).click();
  await page.getByRole('button', { name: 'Add products', exact: true }).waitFor();
  console.log('PASS deferred pricing network failure: values and navigation retained; reload recovers with composition intact');
} finally { await browser.close(); }
