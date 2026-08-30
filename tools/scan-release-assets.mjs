import { readdir, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const FORBIDDEN = [/fonts\.googleapis\.com/i, /fonts\.gstatic\.com/i, /@import\s+(?:url\()?\s*["']?https?:/i, /url\(\s*["']?https?:/i];
async function filesWithin(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  return (await Promise.all(entries.map(async (entry) => { const path = join(directory, entry.name); return entry.isDirectory() ? filesWithin(path) : entry.isFile() ? [path] : []; }))).flat();
}
export const forbiddenRemoteAsset = (text) => FORBIDDEN.find((rule) => rule.test(text)) ?? null;
export async function scanReleaseAssets(outputDir) {
  const files = await filesWithin(outputDir);
  const offenders = [];
  for (const file of files.filter((path) => /\.(?:css|html|js)$/i.test(path))) if (forbiddenRemoteAsset(await readFile(file, "utf8"))) offenders.push(file);
  if (offenders.length) throw new Error(`Release asset policy rejected remote style/font reference: ${offenders.join(", ")}`);
  return { scanned: files.length };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) console.log(`release asset scan: ${(await scanReleaseAssets(resolve(process.argv[2] ?? "dist"))).scanned} files`);
