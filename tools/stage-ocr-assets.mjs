// Stages the tesseract.js OCR engine into `public/ocr/` so the screenshot
// import path is served from ColorBreak's own origin.
//
// Nothing here may reach a third-party CDN at runtime: tesseract.js defaults to
// jsdelivr for its worker, its WebAssembly core and its language data, which
// would add an outside failure mode, leak the fact that a buyer is reading a
// screenshot, and violate the release CSP. Every byte is copied out of the
// version-pinned node_modules tree instead, and the provenance file records
// exactly which published package each byte came from.
import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const OCR_PUBLIC_DIR = "public/ocr";

// The LSTM-only cores are the ones tesseract.js requests for OEM 1. All three
// build variants ship because the worker feature-detects relaxed SIMD, then
// SIMD, then plain WebAssembly: a missing variant is a hard 404 on the devices
// that detect it, not a graceful downgrade.
const CORE_VARIANTS = [
  "tesseract-core-lstm.wasm.js",
  "tesseract-core-simd-lstm.wasm.js",
  "tesseract-core-relaxedsimd-lstm.wasm.js",
];

export const OCR_ASSETS = [
  { from: "node_modules/tesseract.js/dist/worker.min.js", to: "worker.min.js", pkg: "tesseract.js" },
  ...CORE_VARIANTS.map((file) => ({ from: `node_modules/tesseract.js-core/${file}`, to: `core/${file}`, pkg: "tesseract.js-core" })),
  { from: "node_modules/@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz", to: "lang/eng.traineddata.gz", pkg: "@tesseract.js-data/eng" },
  { from: "node_modules/tesseract.js/LICENSE.md", to: "LICENSE-tesseract.js.md", pkg: "tesseract.js" },
  { from: "node_modules/tesseract.js-core/LICENSE", to: "LICENSE-tesseract.js-core.txt", pkg: "tesseract.js-core" },
];

async function packageVersion(root, name) {
  const manifest = JSON.parse(await readFile(join(root, "node_modules", name, "package.json"), "utf8"));
  return { version: manifest.version, license: manifest.license };
}

export async function stageOcrAssets({ root = ROOT, outputDir = join(ROOT, OCR_PUBLIC_DIR) } = {}) {
  await rm(outputDir, { recursive: true, force: true });
  const packages = {};
  const files = [];
  for (const asset of OCR_ASSETS) {
    const source = join(root, asset.from);
    const target = join(outputDir, asset.to);
    await mkdir(dirname(target), { recursive: true });
    await copyFile(source, target);
    packages[asset.pkg] ??= await packageVersion(root, asset.pkg);
    files.push({ path: asset.to, package: asset.pkg, bytes: (await readFile(target)).byteLength, sha256: createHash("sha256").update(await readFile(target)).digest("hex") });
  }
  const provenance = {
    purpose: "Self-hosted tesseract.js OCR engine for the screenshot break import.",
    servedFrom: "same-origin",
    packages,
    files: files.sort((a, b) => a.path.localeCompare(b.path)),
  };
  await writeFile(join(outputDir, "PROVENANCE.json"), `${JSON.stringify(provenance, null, 2)}\n`);
  return provenance;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const provenance = await stageOcrAssets();
  console.log(`staged ${provenance.files.length} OCR assets into ${OCR_PUBLIC_DIR}`);
}
