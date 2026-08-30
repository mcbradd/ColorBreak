import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

async function source(path) {
  return readFile(new URL(path, root), "utf8");
}

test("the offline shell includes the methodology guide", async () => {
  const worker = await source("public/sw.js");

  assert.match(worker, /"\.\/methodology\.html"/);
  assert.doesNotMatch(worker, /privacy\.html/);
  assert.match(worker, /fetch\(event\.request\)[\s\S]*cache\.match\(event\.request\)/);
});

test("the methodology guide uses deploy-relative navigation", async () => {
  const methodology = await source("public/methodology.html");

  assert.match(methodology, /href="\.\/"/);
  assert.doesNotMatch(methodology, /href="\/"/);
});
