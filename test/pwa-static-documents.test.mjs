import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

async function source(path) {
  return readFile(new URL(path, root), "utf8");
}

test("the offline shell includes both static policy documents", async () => {
  const worker = await source("public/sw.js");

  assert.match(worker, /"\.\/methodology\.html"/);
  assert.match(worker, /"\.\/privacy\.html"/);
  assert.match(worker, /fetch\(event\.request\)[\s\S]*cache\.match\(event\.request\)/);
});

test("static documents use deploy-relative navigation", async () => {
  const [privacy, methodology] = await Promise.all([
    source("public/privacy.html"),
    source("public/methodology.html"),
  ]);

  assert.match(privacy, /href="\.\/"/);
  assert.match(privacy, /href="\.\/methodology\.html"/);
  assert.match(methodology, /href="\.\/"/);
  assert.match(methodology, /href="\.\/privacy\.html"/);
  assert.doesNotMatch(privacy, /href="\/"/);
  assert.doesNotMatch(methodology, /href="\/"/);
});
