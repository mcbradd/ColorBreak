// Verifies the bytes served by Pages, not merely the deployment job outcome.
import { createHash } from "node:crypto";

const base = process.argv[2] ?? process.env.COLORBREAK_PUBLIC_URL;
const expectedSha = process.argv[3] ?? process.env.GITHUB_SHA;
if (!base || !expectedSha) throw new Error("Usage: verify-public-release.mjs <Pages URL> <commit SHA>");
const root = new URL(base.endsWith("/") ? base : `${base}/`);
const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
const get = async (path) => {
  const url = new URL(path, root);
  const response = await fetch(url, { redirect: "error" });
  if (!response.ok) throw new Error(`${response.status} for ${url}`);
  return { url: url.href, response, bytes: Buffer.from(await response.arrayBuffer()) };
};

const document = await get("./");
const html = document.bytes.toString("utf8");
const asset = html.match(/(?:src|href)=["']([^"']*assets\/[^"']+\.(?:js|css))["']/i)?.[1];
if (!asset) throw new Error("Published document has no hashed application asset");
const manifestResponse = await get("data/release-manifest.json");
const manifest = JSON.parse(manifestResponse.bytes.toString("utf8"));
if (manifest.appCommitSha !== expectedSha) throw new Error(`Manifest SHA ${manifest.appCommitSha} does not equal reviewed SHA ${expectedSha}`);
if (manifest.releasePosture !== "analysis-only") throw new Error(`Unexpected release posture ${manifest.releasePosture}`);
const inventory = new Map(manifest.artifactFiles.map((item) => [item.path, item.sha256]));
for (const path of [asset, "privacy.html", "methodology.html"]) {
  const file = await get(path);
  const normalized = path.replace(/^\.\//, "");
  if (inventory.get(normalized) !== digest(file.bytes)) throw new Error(`Published hash mismatch: ${normalized}`);
}
const missing = await fetch(new URL("__colorbreak_missing__", root), { redirect: "error" });
if (missing.ok) throw new Error("Missing route unexpectedly returned 200");
console.log(JSON.stringify({ checkedAt: new Date().toISOString(), base: root.href, document: document.response.status, manifestId: manifest.id, appCommitSha: manifest.appCommitSha, asset, missingStatus: missing.status }, null, 2));
