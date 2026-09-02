import assert from "node:assert/strict";
import { readFile, readdir, stat } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const output = join(root, "dist");

// ColorBreak opens on a phone in well under a second. The OCR engine is several
// megabytes and most sessions never read a screenshot, so it must arrive only
// when someone actually asks for it. These assertions run against the real
// built artifact, not the import graph's intent.
const ENTRY_BUDGET_BYTES = 560_000;

async function builtArtifactExists() {
  try {
    return (await stat(join(output, "index.html"))).isFile();
  } catch {
    return false;
  }
}

async function entryChunk() {
  const index = await readFile(join(output, "index.html"), "utf8");
  const source = index.match(/<script[^>]+type="module"[^>]+src="([^"]+)"/)?.[1];
  assert.ok(source, "index.html must load a module entry chunk");
  const path = join(output, source.replace(/^\.?\//, ""));
  return { path, text: await readFile(path, "utf8"), bytes: (await stat(path)).size };
}

test("the OCR engine is absent from the initial bundle", async (t) => {
  if (!await builtArtifactExists()) {
    t.skip("Run this suite after `npm run build` (the normal check command does this).");
    return;
  }

  const entry = await entryChunk();
  assert.doesNotMatch(entry.text, /tesseract/i, `${entry.path} must not contain the OCR engine`);
  assert.ok(
    entry.bytes <= ENTRY_BUDGET_BYTES,
    `Entry chunk is ${entry.bytes} bytes, over the ${ENTRY_BUDGET_BYTES} byte mobile first-load budget.`,
  );

  // It still has to be *reachable*, or the feature is simply broken: exactly one
  // separate chunk carries it, loaded by the dynamic import.
  const assets = await readdir(join(output, "assets"));
  const carriers = [];
  for (const asset of assets.filter((name) => name.endsWith(".js"))) {
    if (/tesseract/i.test(await readFile(join(output, "assets", asset), "utf8"))) carriers.push(asset);
  }
  assert.ok(carriers.length > 0, "No built chunk carries tesseract.js; the screenshot import would fail at runtime.");
});

test("the OCR engine is served from ColorBreak's own origin", async (t) => {
  if (!await builtArtifactExists()) {
    t.skip("Run this suite after `npm run build` (the normal check command does this).");
    return;
  }

  // A CDN dependency would add an outside failure mode, tell a third party that
  // a buyer is reading a break's show notes, and break the release CSP.
  for (const path of ["ocr/worker.min.js", "ocr/core/tesseract-core-simd-lstm.wasm.js", "ocr/lang/eng.traineddata.gz"]) {
    assert.ok((await stat(join(output, path))).size > 0, `Missing self-hosted OCR asset ${path}`);
  }

  const provenance = JSON.parse(await readFile(join(output, "ocr/PROVENANCE.json"), "utf8"));
  assert.equal(provenance.servedFrom, "same-origin");
  assert.ok(provenance.packages["tesseract.js"].version, "OCR provenance must pin the engine version");

  const adapter = await readFile(join(root, "src/features/shared/screenshot-ocr.ts"), "utf8");
  assert.doesNotMatch(adapter, /cdn\.jsdelivr\.net|unpkg\.com|tessdata\.projectnaptha\.com/);
});
