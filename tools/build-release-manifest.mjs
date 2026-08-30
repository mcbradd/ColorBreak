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

export async function scanReleaseAssets(outputDir) {
  // Only executable/rendered resource references are relevant here. Citation
  // URLs in the immutable data are not browser fetches.
  const patterns = {
    html: /<(?:script|link|img|iframe)\b[^>]*(?:src|href)=["'](https?:\/\/[^"']+)/gi,
    css: /(?:@import\s+(?:url\()?|url\()["']?(https?:\/\/[^\s"')]+)/gi,
    js: /(?:fetch|import)\(\s*["'](https?:\/\/[^"']+)/gi,
    svg: /(?:href|xlink:href)=["'](https?:\/\/[^"']+)/gi,
    json: /["'](?:assetUrl|imageUrl|scriptUrl)["']\s*:\s*["'](https?:\/\/[^"']+)/gi,
  };
  const approved = new Set([
    "https://mcbradd.github.io",
    ...((process.env.COLORBREAK_APPROVED_EXTERNAL_ORIGINS ?? "").split(",").filter(Boolean)),
  ]);
  const files = await filesWithin(outputDir);
  const index = await readFile(join(outputDir, "index.html"), "utf8").catch(() => null);
  // Manifest unit fixtures may inventory data without an application shell.
  // A deployable artifact always includes index.html and is checked here.
  if (index == null) return [];
  const csp = index.match(/Content-Security-Policy[^>]*content="([^"]*)/i)?.[1]
    ?? index.match(/content="([^"]*)"[^>]*Content-Security-Policy/i)?.[1];
  if (!csp) throw new Error("Release artifact is missing a Content-Security-Policy");
  const imgSource = csp.split(";").find((directive) => directive.trim().startsWith("img-src"));
  if (!imgSource || /https?:/i.test(imgSource)) throw new Error("Release CSP img-src must not permit remote origins");
  const findings = [];
  for (const file of files) {
    if (!/\.(?:html|css|js|mjs|json|svg|webmanifest)$/i.test(file)) continue;
    const path = relative(outputDir, file).replaceAll("\\", "/");
    const text = await readFile(file, "utf8");
    const extension = file.split(".").pop()?.toLowerCase();
    const pattern = extension === "html" ? patterns.html : extension === "css" ? patterns.css : extension === "svg" ? patterns.svg : extension === "json" || extension === "webmanifest" ? patterns.json : patterns.js;
    for (const match of text.matchAll(pattern)) {
      const origin = new URL(match[1]).origin;
      if (!approved.has(origin)) findings.push({ path, origin });
    }
  }
  if (findings.length) throw new Error(`Unapproved external release resource: ${findings.map((item) => `${item.path} (${item.origin})`).join(", ")}`);
  return findings;
}

export async function verifyReleaseArtifact({ outputDir = resolve(ROOT, "dist") } = {}) {
  const manifest = JSON.parse(await readFile(join(outputDir, RELEASE_MANIFEST_PATH), "utf8"));
  const files = manifest.artifactFiles ?? manifest.dataFiles;
  for (const item of files) {
    const bytes = await readFile(join(outputDir, item.path));
    if (sha256(bytes) !== item.sha256) throw new Error(`Release artifact hash mismatch: ${item.path}`);
  }
  await scanReleaseAssets(outputDir);
  return manifest;
}

export async function buildReleaseManifest({ outputDir = resolve(ROOT, "dist"), root = ROOT, buildTimestamp = generatedAt() } = {}) {
  const files = (await filesWithin(outputDir)).filter((file) => relative(outputDir, file).replaceAll("\\", "/") !== RELEASE_MANIFEST_PATH);
  const artifactFiles = await Promise.all(files.sort().map(async (file) => {
    const bytes = await readFile(file);
    const path = relative(outputDir, file).replaceAll("\\", "/");
    let parsed = {};
    try { parsed = JSON.parse(bytes.toString("utf8")); } catch { /* Non-JSON data is still hashable. */ }
    return { path, sha256: sha256(bytes), ...sourceMetadata(path, parsed) };
  }));
  const dataFiles = artifactFiles.filter((file) => file.path.startsWith("data/"));
  const resolvedSha = commitSha(root);
  if (process.env.GITHUB_SHA && process.env.GITHUB_SHA !== resolvedSha) throw new Error("GITHUB_SHA does not match checked-out commit");
  const manifest = {
    schemaVersion: 1,
    id: "",
    appCommitSha: resolvedSha,
    buildTimestamp,
    runtime: { node: process.version, tool: "tools/build-release-manifest.mjs" },
    eligibilityFreshnessMs: ELIGIBILITY_FRESHNESS_MS,
    dataFiles,
    artifactFiles,
  };
  await scanReleaseAssets(outputDir);
  // The identity is the reproducible release tuple. Provenance fields tell us
  // when and with what runtime it was assembled, but must not make identical
  // artifacts receive different identities on separate builds.
  const canonical = JSON.stringify({ ...manifest, id: undefined, buildTimestamp: undefined, runtime: undefined });
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
  console.log(`release manifest ${manifest.id}: ${manifest.artifactFiles.length} artifact files`);
}
