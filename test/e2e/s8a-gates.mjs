// S8a DoD (b): Top Contributors clipping fix + standing gates G1/G2, and the
// G3 empty-storage full flow. Gate helpers live in harness.mjs; run-all.mjs
// asserts their presence at bootstrap so later suites inherit them.
import assert from "node:assert/strict";
import { launch, waitForBoard, assertG1, assertG2, ORIGIN } from "./harness.mjs";

export async function topContributorsClipping() {
  const { browser, page } = await launch({});
  await page.goto(ORIGIN + "/?set=tst&preset=play");
  await waitForBoard(page);
  await page.waitForFunction(() => document.querySelectorAll("#topBody td").length > 5);
  const bad = await page.evaluate(() => {
    const out = [];
    for (const td of document.querySelectorAll("#topBody td")) {
      const r = td.getBoundingClientRect();
      if (r.right > 430.5) out.push(`${td.className} right=${Math.round(r.right)}`);
    }
    return out;
  });
  assert.deepEqual(bad, [], "top-contributor cells past 430: " + bad.join(" | "));
  await assertG1(page);
  await assertG2(page);
  await browser.close();
}

export async function g3EmptyStorageFlow() {
  // G3: the full interactive flow works from a completely empty localStorage —
  // land on the URL-driven composition (legacy ?set=&preset=), same entry point
  // a shared break link uses. The manual add-product / set-picker bottom-sheet
  // flow is exercised by unit-level renderComp/openProductPicker coverage, not
  // here — it needs a populated Scryfall /sets index the synthetic harness
  // doesn't provide.
  const { browser, page } = await launch({});
  await page.goto(ORIGIN + "/?set=tst&preset=play", { waitUntil: "commit" });
  assert.equal(await page.evaluate(() => localStorage.length), 0, "storage starts empty");
  await waitForBoard(page);
  await page.tap("#modeSeller");
  await page.waitForFunction(() => /^[1-9]\d* line item/.test(document.getElementById("sCosts").textContent || ""), null, { timeout: 20000 });
  await assertG1(page);
  await assertG2(page);
  await browser.close();
}

export const scenarios = { topContributorsClipping, g3EmptyStorageFlow };
