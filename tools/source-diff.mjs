import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const sealedDir = resolve(root, "data/sealed");
const triagePath = resolve(root, "data/source-diff-triage.json");

function triageRecord() {
  try {
    const value = JSON.parse(readFileSync(triagePath, "utf8"));
    const required = ["owner", "classification", "disposition", "createdAt", "responseTarget"];
    if (!required.every((key) => typeof value[key] === "string" && value[key])) return null;
    return value;
  } catch { return null; }
}

function previous(path) {
  try { return JSON.parse(execFileSync("git", ["show", `HEAD:${path}`], { cwd: root, encoding: "utf8" })); }
  catch { return null; }
}

function changed(before, after) {
  return JSON.stringify(before) !== JSON.stringify(after);
}

function keys(value) { return Object.keys(value ?? {}).sort(); }
function setDifference(a, b) { return a.filter((value) => !b.includes(value)); }

const report = {
  generatedAt: new Date().toISOString(),
  against: "HEAD",
  sets: [],
  summary: { addedSets: 0, removedSets: 0, changedSets: 0, materialChanges: 0 },
};

const currentFiles = readdirSync(sealedDir).filter((name) => /^[A-Z0-9]+\.json$/.test(name));
const priorIndex = previous("data/sealed/index.json") ?? { sets: [] };
const currentCodes = currentFiles.map((name) => name.replace(/\.json$/, "")).sort();
for (const code of setDifference(currentCodes, priorIndex.sets ?? [])) {
  report.sets.push({ code, state: "added" });
  report.summary.addedSets += 1;
  report.summary.materialChanges += 1;
}
for (const code of setDifference(priorIndex.sets ?? [], currentCodes)) {
  report.sets.push({ code, state: "removed" });
  report.summary.removedSets += 1;
  report.summary.materialChanges += 1;
}

for (const code of currentCodes.filter((value) => (priorIndex.sets ?? []).includes(value))) {
  const before = previous(`data/sealed/${code}.json`);
  const after = JSON.parse(readFileSync(resolve(sealedDir, `${code}.json`), "utf8"));
  if (!before || !changed(before, after)) continue;
  const delta = { code, state: "changed", products: {}, boosters: {} };
  const beforeProducts = new Map((before.products ?? []).map((row) => [row.key, row]));
  const afterProducts = new Map((after.products ?? []).map((row) => [row.key, row]));
  delta.products.added = setDifference(keys(Object.fromEntries(afterProducts)), keys(Object.fromEntries(beforeProducts)));
  delta.products.removed = setDifference(keys(Object.fromEntries(beforeProducts)), keys(Object.fromEntries(afterProducts)));
  delta.products.contentsChanged = [...afterProducts.keys()].filter((key) => beforeProducts.has(key) && changed(
    { packs: beforeProducts.get(key).packs, fixed: beforeProducts.get(key).fixed, decks: beforeProducts.get(key).decks, contains: beforeProducts.get(key).contains },
    { packs: afterProducts.get(key).packs, fixed: afterProducts.get(key).fixed, decks: afterProducts.get(key).decks, contains: afterProducts.get(key).contains },
  ));
  const beforeBoosters = before.boosters ?? {};
  const afterBoosters = after.boosters ?? {};
  delta.boosters.added = setDifference(keys(afterBoosters), keys(beforeBoosters));
  delta.boosters.removed = setDifference(keys(beforeBoosters), keys(afterBoosters));
  delta.boosters.branchesChanged = keys(afterBoosters).filter((key) => beforeBoosters[key] && changed(beforeBoosters[key].variants, afterBoosters[key].variants));
  delta.boosters.sheetsChanged = keys(afterBoosters).filter((key) => beforeBoosters[key] && changed(beforeBoosters[key].sheets, afterBoosters[key].sheets));
  delta.materialChangeCount = Object.values(delta.products).reduce((sum, rows) => sum + rows.length, 0)
    + Object.values(delta.boosters).reduce((sum, rows) => sum + rows.length, 0);
  if (delta.materialChangeCount) {
    report.sets.push(delta);
    report.summary.changedSets += 1;
    report.summary.materialChanges += delta.materialChangeCount;
  }
}

report.sets.sort((a, b) => a.code.localeCompare(b.code));
const triage = triageRecord();
report.triage = triage ?? {
  status: "unreviewed",
  owner: "unassigned (product decision required)",
  disposition: "investigate",
};
if (triage) {
  const reviewDue = triage.reviewBy && Date.parse(triage.reviewBy) < Date.now();
  report.triage = { ...triage, status: report.summary.materialChanges ? (reviewDue ? "deferred-expired" : "review-required") : "no-current-diff" };
}
const outputArg = process.argv.indexOf("--output");
const output = outputArg >= 0 ? process.argv[outputArg + 1] : "data/source-diff.json";
writeFileSync(resolve(root, output), `${JSON.stringify(report, null, 2)}\n`);
console.log(`source diff: ${report.summary.materialChanges} material changes across ${report.sets.length} sets`);
// A record is durable evidence, not an override: an actual delta remains red
// until its reviewed baseline is committed.
if (process.argv.includes("--check") && report.summary.materialChanges > 0) process.exitCode = 1;
