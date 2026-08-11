// The primary entry path: set → product → quantity, first thing on the page, then EV.
// Covers the whole flow with no URL parameters and no seeded storage.
import assert from "node:assert/strict";
import { launch, waitForBoard, ORIGIN, assertG1, assertG2 } from "./harness.mjs";

const SETS = [{ code: "tst", name: "Testline", set_type: "expansion", released_at: "2025-01-01", digital: false }];

export async function pickSetProductQuantity() {
  const { browser, page } = await launch({ sets: SETS });
  await page.goto(ORIGIN + "/");

  // Step 1 is the first control on the page, and steps 2 and 3 wait on it.
  await page.waitForSelector("#pickSet");
  const firstPanel = await page.evaluate(() =>
    document.querySelector(".wrap section, .wrap main").id);
  assert.equal(firstPanel, "setup", "the composition builder is the first panel on the page");
  assert.equal(await page.evaluate(() => document.getElementById("pickProd").disabled), true,
    "product waits for a set");
  assert.equal(await page.evaluate(() => document.getElementById("addToBreak").disabled), true,
    "Add waits for a product");

  // Step 1: the sheet, because picking a set needs search and filters.
  await page.tap("#pickSet");
  await page.waitForSelector('#setRows [data-set="tst"]');
  await page.tap('#setRows [data-set="tst"]');
  await page.waitForFunction(() => !document.getElementById("pickProd").disabled);
  assert.match(await page.textContent("#pickSet"), /TST/, "the chosen set is shown, not remembered silently");

  // Step 2: a plain select — a set has a handful of products.
  const products = await page.evaluate(() => [...document.querySelectorAll("#pickProd option")].map(o => o.value));
  assert.ok(products.includes("play-box"), `expected a play box among ${products.join(", ")}`);
  await page.selectOption("#pickProd", "play-box");

  // Step 3: quantity is staged before the line item exists, not edited after.
  await page.tap('#pickQtyBox [data-q="inc"]');
  assert.equal(await page.textContent("#pickQty"), "2");

  await page.tap("#addToBreak");
  await waitForBoard(page);

  assert.match(await page.textContent("#breakLine"), /2× Play Booster Box/,
    "the break collapses to one line naming what is in it");
  assert.equal(await page.textContent("#pickQty"), "1", "quantity resets for the next line item");

  // …and the answer: per-slot EV, on screen with the picker still above it.
  const slots = await page.evaluate(() => [...document.querySelectorAll("#slotCards .scard")].length);
  assert.ok(slots > 0, "slot EV list rendered");
  await assertG1(page);
  await assertG2(page);
  await browser.close();
}

// A returning break must not make the user answer step 1 again.
export async function returningBreakKeepsItsSet() {
  const { browser, page } = await launch({ sets: SETS });
  await page.goto(ORIGIN + "/?b=TST.play-box.2");
  await waitForBoard(page);
  assert.match(await page.textContent("#pickSet"), /TST/, "the add bar starts on the set already in the break");
  assert.equal(await page.evaluate(() => document.getElementById("pickProd").disabled), false);
  await assertG2(page);
  await browser.close();
}

// Choosing a product re-renders the add bar, which rebuilds the option list. The choice
// has to survive that, or every product but the first is unselectable.
export async function productChoiceSticks() {
  const { browser, page } = await launch({ sets: SETS });
  await page.goto(ORIGIN + "/");
  await page.tap("#pickSet");
  await page.waitForSelector('#setRows [data-set="tst"]');
  await page.tap('#setRows [data-set="tst"]');
  await page.waitForFunction(() => !document.getElementById("pickProd").disabled);

  const options = await page.evaluate(() => [...document.querySelectorAll("#pickProd option")].map(o => o.value));
  assert.ok(options.length > 1, `need a second product to select, got ${options.join(", ")}`);
  const last = options[options.length - 1];
  await page.selectOption("#pickProd", last);
  assert.equal(await page.evaluate(() => document.getElementById("pickProd").value), last,
    "the selected product stays selected after the add bar re-renders");

  await page.tap("#addToBreak");
  await waitForBoard(page);
  assert.equal(await page.evaluate(() => comp[0].key), last, "the line item is the product that was chosen");
  await browser.close();
}

export const scenarios = { pickSetProductQuantity, returningBreakKeepsItsSet, productChoiceSticks };
