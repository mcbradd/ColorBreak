import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { buildReleaseManifest, ELIGIBILITY_FRESHNESS_MS } from "../tools/build-release-manifest.mjs";

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

test("manifest stays analysis-only until a validated production gate explicitly sets its posture", async (t) => {
  const outputDir = await mkdtemp(join(tmpdir(), "colorbreak-release-posture-"));
  t.after(() => rm(outputDir, { recursive: true, force: true }));
  await mkdir(join(outputDir, "data", "prices"), { recursive: true });
  await writeFile(join(outputDir, "data", "prices", "index.json"), JSON.stringify({ observedAt: "2026-08-29T12:00:00.000Z" }));
  const previous = process.env.COLORBREAK_RELEASE_POSTURE;
  process.env.COLORBREAK_RELEASE_POSTURE = "decision-ready";
  const manifest = await buildReleaseManifest({ outputDir, root: outputDir, buildTimestamp: "2026-08-29T12:01:00.000Z" });
  if (previous == null) delete process.env.COLORBREAK_RELEASE_POSTURE; else process.env.COLORBREAK_RELEASE_POSTURE = previous;
  assert.equal(manifest.releasePosture, "analysis-only");
});
