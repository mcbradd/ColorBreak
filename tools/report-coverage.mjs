// Generates the reviewable sealed-data coverage manifest and optionally enforces
// that a rebuild did not silently shrink coverage or increase incomplete products.
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const DATA_DIR = fileURLToPath(new URL("../data/", import.meta.url));
const SEALED_DIR = fileURLToPath(new URL("../data/sealed/", import.meta.url));
const OUT = fileURLToPath(new URL("../data/coverage.json", import.meta.url));
const BASELINE = fileURLToPath(new URL("../data/coverage-baseline.json", import.meta.url));

const CARDLIKE_PROSE = /\b(cards?|lands?)\b/i;
const ACCESSORY_PROSE = /storage|\bbox\b|sleeve|display|walk[ -]?through|reference|arena code|helper|art[ -]?only|dungeon/i;

export function summarizeCoverage(documents, corrections) {
  const reasons = {};
  const sets = [];
  let products = 0;
  let complete = 0;
  let incomplete = 0;
  for (const document of documents) {
    let setComplete = 0;
    let setIncomplete = 0;
    for (const product of document.products) {
      products += 1;
      const correction = corrections.products?.[`${document.set}/${product.key}`];
      const packs = { ...product.packs };
      for (const code of correction?.removePacks ?? []) delete packs[code];
      for (const [code, count] of Object.entries(correction?.addPacks ?? {})) packs[code] = (packs[code] ?? 0) + count;
      const productReasons = new Set();
      for (const packCode of Object.keys(packs)) {
        const split = packCode.indexOf(":");
        const owner = split < 0 ? document.set : packCode.slice(0, split).toUpperCase();
        const bareCode = split < 0 ? packCode : packCode.slice(split + 1);
        const ownerDoc = documents.find((candidate) => candidate.set === owner);
        const booster = ownerDoc?.boosters[bareCode];
        if (!booster) productReasons.add("missing-booster");
        else if (Object.values(booster.sheets).some((sheet) => sheet.missing)) productReasons.add("missing-sheet-weight");
      }
      if ((product.other ?? []).some((text) => CARDLIKE_PROSE.test(text) && !ACCESSORY_PROSE.test(text))) {
        productReasons.add("prose-only-contents");
      }
      if (product.unresolvedContents?.length) productReasons.add("unresolved-fixed-printing");
      if (product.suspect && !correction?.contentsMultiplier) productReasons.add("suspect-contents");
      if (productReasons.size) {
        incomplete += 1;
        setIncomplete += 1;
        for (const reason of productReasons) reasons[reason] = (reasons[reason] ?? 0) + 1;
      } else {
        complete += 1;
        setComplete += 1;
      }
    }
    sets.push({
      code: document.set,
      name: document.name,
      released: document.released,
      products: document.products.length,
      complete: setComplete,
      incomplete: setIncomplete,
      mtgjson: document.src.mtgjson,
      mtgjsonDate: document.src.mtgjsonDate,
      schemaVersion: document.v,
      sha256: document.__sha256,
    });
  }
  return {
    schemaVersion: 1,
    source: "Committed MTGJSON sealed corpus after reviewed corrections",
    sets: sets.length,
    products,
    complete,
    incomplete,
    reasons,
    documents: sets.sort((a, b) => a.code.localeCompare(b.code)),
  };
}

function loadDocuments() {
  return readdirSync(SEALED_DIR)
    .filter((name) => name.endsWith(".json") && name !== "index.json")
    .map((name) => {
      const raw = readFileSync(`${SEALED_DIR}/${name}`, "utf8");
      return { ...JSON.parse(raw), __sha256: createHash("sha256").update(raw).digest("hex") };
    });
}

const report = summarizeCoverage(loadDocuments(), JSON.parse(readFileSync(`${DATA_DIR}/corrections.json`, "utf8")));
if (process.argv.includes("--check")) {
  const baseline = JSON.parse(readFileSync(BASELINE, "utf8"));
  const failures = [];
  if (report.sets < baseline.sets) failures.push(`sets regressed: ${report.sets} < ${baseline.sets}`);
  if (report.products < baseline.products) failures.push(`products regressed: ${report.products} < ${baseline.products}`);
  if (report.complete < baseline.complete) failures.push(`complete products regressed: ${report.complete} < ${baseline.complete}`);
  if (report.incomplete > baseline.incomplete) failures.push(`incomplete products increased: ${report.incomplete} > ${baseline.incomplete}`);
  if (failures.length) throw new Error(failures.join("; "));
  console.log(`coverage gate passed: ${report.complete}/${report.products} complete across ${report.sets} sets`);
} else {
  writeFileSync(OUT, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`wrote ${OUT}: ${report.complete}/${report.products} complete across ${report.sets} sets`);
}
