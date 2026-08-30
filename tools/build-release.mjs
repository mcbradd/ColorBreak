import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildReleaseManifest } from "./build-release-manifest.mjs";
import { checkoutSha, releasePosture } from "./release-posture.mjs";
import { scanReleaseAssets } from "./scan-release-assets.mjs";
const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
export async function buildRelease({ root = ROOT, outputDir = resolve(ROOT, "dist"), environment = process.env, now = Date.now() } = {}) {
  const posture = await releasePosture({ root, environment, now });
  const prices = JSON.parse(await readFile(resolve(root, "data/prices/index.json"), "utf8"));
  const reviewEvidence = posture === "decision-ready" ? JSON.parse(await readFile(resolve(root, "data/decision-ready-review.json"), "utf8")) : null;
  const manifest = await buildReleaseManifest({ outputDir, root, releaseContext: { posture, appCommitSha: checkoutSha(root, environment), observedAt: prices.observedAt, reviewEvidence, verified: posture === "decision-ready" } });
  await scanReleaseAssets(outputDir);
  return manifest;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) console.log(`release artifact ${(await buildRelease({ outputDir: resolve(process.argv[2] ?? "dist") })).id}`);
