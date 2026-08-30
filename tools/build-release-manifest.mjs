// Creates the immutable data inventory shipped with a Pages artifact.
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const RELEASE_MANIFEST_PATH = "data/release-manifest.json";
export const ELIGIBILITY_FRESHNESS_MS = 6 * 60 * 60 * 1000;

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

async function filesWithin(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return filesWithin(path);
    return entry.isFile() ? [path] : [];
  }));
  return nested.flat();
}

function commitSha(root) {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA;
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return "unknown";
  }
}

function generatedAt() {
  const epoch = process.env.SOURCE_DATE_EPOCH;
  return epoch ? new Date(Number(epoch) * 1000).toISOString() : new Date().toISOString();
}

function sourceMetadata(path, parsed) {
  if (path === "data/prices/index.json") return {
    observationTimestamp: parsed.observedAt ?? null,
    sourceVersion: parsed.sourceUpdatedAt ?? parsed.provider ?? null,
  };
  if (path === "data/sealed-prices.json") return {
    observationTimestamp: parsed.observedAt ?? null,
    sourceVersion: parsed.provider ?? null,
  };
  if (path.startsWith("data/sealed/") && path !== "data/sealed/index.json") return {
    observationTimestamp: parsed.src?.builtAt ?? null,
    sourceVersion: parsed.src?.mtgjson ?? null,
  };
  if (path === "data/corrections.json") return {
    observationTimestamp: parsed.verifiedAt ?? null,
    sourceVersion: parsed.version == null ? null : String(parsed.version),
  };
  return { observationTimestamp: null, sourceVersion: null };
}

export async function buildReleaseManifest({ outputDir = resolve(ROOT, "dist"), root = ROOT, buildTimestamp = generatedAt() } = {}) {
  const dataDir = join(outputDir, "data");
  const files = (await filesWithin(dataDir)).filter((file) => relative(outputDir, file).replaceAll("\\", "/") !== RELEASE_MANIFEST_PATH);
  const dataFiles = await Promise.all(files.sort().map(async (file) => {
    const bytes = await readFile(file);
    const path = relative(outputDir, file).replaceAll("\\", "/");
    let parsed = {};
    try { parsed = JSON.parse(bytes.toString("utf8")); } catch { /* Non-JSON data is still hashable. */ }
    return { path, sha256: sha256(bytes), ...sourceMetadata(path, parsed) };
  }));
  const manifest = {
    schemaVersion: 1,
    id: "",
    appCommitSha: commitSha(root),
    buildTimestamp,
    runtime: { node: process.version, tool: "tools/build-release-manifest.mjs" },
    eligibilityFreshnessMs: ELIGIBILITY_FRESHNESS_MS,
    // A reproducible Pages build can be stale; only a fresh reviewed snapshot
    // may describe buyer caps as decision-ready.
    releasePosture: "analysis-only",
    dataFiles,
  };
  const priceObservation = dataFiles.find((file) => file.path === "data/prices/index.json")?.observationTimestamp;
  const priceAge = Date.parse(buildTimestamp) - Date.parse(priceObservation ?? "");
  // Freshness alone is insufficient: the explicit release-posture check also
  // requires a reviewed record and live-smoke evidence. Pages stays demo-only.
  if (process.env.COLORBREAK_RELEASE_POSTURE === "decision-ready" && Number.isFinite(priceAge) && priceAge >= 0 && priceAge <= ELIGIBILITY_FRESHNESS_MS) manifest.releasePosture = "decision-ready";
  const canonical = JSON.stringify({ ...manifest, id: undefined });
  manifest.id = sha256(canonical);
  const outputPath = join(outputDir, RELEASE_MANIFEST_PATH);
  await writeFile(outputPath, `${JSON.stringify(manifest, null, 2)}\n`);
  return manifest;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const outputArg = process.argv[2] ? resolve(process.argv[2]) : resolve(ROOT, "dist");
  const info = await stat(join(outputArg, "data")).catch(() => null);
  if (!info?.isDirectory()) throw new Error(`Release data directory not found: ${join(outputArg, "data")}`);
  const manifest = await buildReleaseManifest({ outputDir: outputArg });
  console.log(`release manifest ${manifest.id}: ${manifest.dataFiles.length} data files`);
}
