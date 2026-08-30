import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { buildReleaseManifest, ELIGIBILITY_FRESHNESS_MS } from "../tools/build-release-manifest.mjs";
import { forbiddenRemoteAsset } from "../tools/scan-release-assets.mjs";

const hash = (value) => createHash("sha256").update(value).digest("hex");

test("release manifest inventories deployed data with reproducible hashes and observation metadata", async (t) => {
  const outputDir = await mkdtemp(join(tmpdir(), "colorbreak-release-"));
  t.after(() => rm(outputDir, { recursive: true, force: true }));
  await mkdir(join(outputDir, "data", "prices"), { recursive: true });
  await writeFile(join(outputDir, "data", "prices", "index.json"), JSON.stringify({
    provider: "Scryfall", observedAt: "2026-08-29T12:00:00.000Z", sourceUpdatedAt: "2026-08-29T11:00:00.000Z",
  }));
  await writeFile(join(outputDir, "data", "other.json"), "{\"value\":1}\n");

  const manifest = await buildReleaseManifest({
    outputDir, root: outputDir, buildTimestamp: "2026-08-29T13:00:00.000Z",
  });

  assert.equal(manifest.eligibilityFreshnessMs, ELIGIBILITY_FRESHNESS_MS);
  assert.match(manifest.id, /^[a-f0-9]{64}$/);
  assert.deepEqual(manifest.dataFiles.map((file) => file.path), ["data/other.json", "data/prices/index.json"]);
  assert.deepEqual(manifest.dataFiles[1], {
    path: "data/prices/index.json",
    sha256: hash(await readFile(join(outputDir, "data", "prices", "index.json"))),
    observationTimestamp: "2026-08-29T12:00:00.000Z",
    sourceVersion: "2026-08-29T11:00:00.000Z",
  });
  const written = JSON.parse(await readFile(join(outputDir, "data", "release-manifest.json"), "utf8"));
  assert.equal(written.id, manifest.id);
  assert.ok(!written.dataFiles.some((file) => file.path === "data/release-manifest.json"));
});

test("the canonical SOS price shard is indexed and carried into a release inventory", async (t) => {
  const sourceRoot = new URL("..", import.meta.url);
  const sourceIndex = JSON.parse(await readFile(new URL("data/prices/index.json", sourceRoot), "utf8"));
  const sourceShard = await readFile(new URL("data/prices/SOS.json", sourceRoot));
  assert.deepEqual(sourceIndex.sets.SOS, {
    file: "SOS.json",
    cards: JSON.parse(sourceShard).cards.length,
    sha256: hash(sourceShard.toString("utf8")),
  });

  const outputDir = await mkdtemp(join(tmpdir(), "colorbreak-sos-release-"));
  t.after(() => rm(outputDir, { recursive: true, force: true }));
  await mkdir(join(outputDir, "data", "prices"), { recursive: true });
  await writeFile(join(outputDir, "data", "prices", "SOS.json"), sourceShard);
  await writeFile(join(outputDir, "data", "prices", "index.json"), JSON.stringify(sourceIndex));
  const manifest = await buildReleaseManifest({ outputDir, root: outputDir });
  assert.deepEqual(manifest.dataFiles.find((file) => file.path === "data/prices/SOS.json"), {
    path: "data/prices/SOS.json",
    sha256: hash(sourceShard.toString("utf8")),
    observationTimestamp: null,
    sourceVersion: null,
  });
});

test("manifest identity ignores build clock and runtime but binds stable release inputs", async (t) => {
  const outputDir = await mkdtemp(join(tmpdir(), "colorbreak-release-id-"));
  t.after(() => rm(outputDir, { recursive: true, force: true }));
  await mkdir(join(outputDir, "data", "prices"), { recursive: true });
  await writeFile(join(outputDir, "data", "prices", "index.json"), JSON.stringify({ observedAt: "2026-08-29T12:00:00.000Z" }));
  await writeFile(join(outputDir, "index.html"), "<meta http-equiv=\"Content-Security-Policy\" content=\"default-src 'self'; img-src 'self' data:\"><main>ColorBreak</main>\n");
  const first = await buildReleaseManifest({ outputDir, root: outputDir, buildTimestamp: "2026-08-29T13:00:00.000Z" });
  const second = await buildReleaseManifest({ outputDir, root: outputDir, buildTimestamp: "2026-08-30T13:00:00.000Z" });
  assert.equal(first.id, second.id);
  await writeFile(join(outputDir, "data", "prices", "index.json"), JSON.stringify({ observedAt: "2026-08-29T12:00:01.000Z" }));
  assert.notEqual(first.id, (await buildReleaseManifest({ outputDir, root: outputDir })).id);
  await writeFile(join(outputDir, "data", "prices", "index.json"), JSON.stringify({ observedAt: "2026-08-29T12:00:00.000Z" }));
  await writeFile(join(outputDir, "index.html"), "<meta http-equiv=\"Content-Security-Policy\" content=\"default-src 'self'; img-src 'self' data:\"><main>Updated ColorBreak</main>\n");
  assert.notEqual(first.id, (await buildReleaseManifest({ outputDir, root: outputDir })).id);
});

test("release asset scanner permits local references and rejects remote fonts and CSS", () => {
  assert.equal(forbiddenRemoteAsset("@import './local.css'; .x{background:url(data:image/svg+xml,x)}"), null);
  for (const sample of ["https://fonts.googleapis.com/css", "url(https://fonts.gstatic.com/a)", "@import url('https://example.test/a.css')", ".x{background:url(https://example.test/a.png)}"]) assert.ok(forbiddenRemoteAsset(sample));
});
