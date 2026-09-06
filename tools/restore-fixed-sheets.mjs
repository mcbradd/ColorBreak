import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";

// Target only possible complete sheets, then require an explicit upstream fixed flag.
// Card pools and rates stay on their existing version; only this source-backed fact changes.
const candidates = readdirSync("data/sealed").filter((file) => /^[A-Z0-9]+\.json$/.test(file)).map((file) => ({ file, document: JSON.parse(readFileSync(`data/sealed/${file}`, "utf8")) }))
  .filter(({ document }) => Object.values(document.boosters).some((booster) => Object.entries(booster.sheets).some(([name, sheet]) => sheet.total > 2 && booster.variants.some((variant) => variant.picks[name] === sheet.total))));
for (let offset = 0; offset < candidates.length; offset += 3) await Promise.all(candidates.slice(offset, offset + 3).map(async ({ file, document }) => {
  const url = `https://mtgjson.com/api/v5/${document.set}.json`;
  const response = await fetch(url);
  assert.ok(response.ok, `${url}: ${response.status}`);
  const text = await response.text(), upstream = JSON.parse(text);
  let count = 0;
  for (const [code, booster] of Object.entries(document.boosters)) for (const [name, sheet] of Object.entries(booster.sheets)) {
    const original = upstream.data.booster?.[code]?.sheets?.[name];
    if (!original?.fixed) continue;
    assert.equal(sheet.total, original.totalWeight, `${document.set}/${code}/${name}: changed total; review before importing`);
    assert.deepEqual(sheet.cards.map((card) => card.at(-1)).sort((a, b) => a - b), Object.values(original.cards).sort((a, b) => a - b), `${document.set}/${code}/${name}: changed multiplicities`);
    sheet.fixed = true;
    count++;
  }
  if (count) {
    document.src.fixedSheetEvidence = { source: url, version: upstream.meta.version, date: upstream.meta.date, sha256: createHash("sha256").update(text).digest("hex") };
    writeFileSync(`data/sealed/${file}`, JSON.stringify(document));
  }
  console.log(`${document.set}: ${count} fixed sheets confirmed`);
}));
