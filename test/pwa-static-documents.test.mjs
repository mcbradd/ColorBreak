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

  // The link carries an explicit "#home" so a real navigation back to it -
  // not just the SPA's in-memory state - lands on the front page instead of
  // silently falling through to the buyer workspace default. It must stay
  // relative to the deploy path ("./#home"), never absolute-root ("/#home"),
  // since the site is served from a subpath (github.io/ColorBreak/).
  assert.match(methodology, /href="\.\/#home"/);
  assert.doesNotMatch(methodology, /href="\/#home"/);
  assert.doesNotMatch(methodology, /href="\/"/);
});
