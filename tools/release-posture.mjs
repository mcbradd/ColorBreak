import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const MAX_AGE = 6 * 60 * 60 * 1000;
const desired = process.env.COLORBREAK_RELEASE_POSTURE ?? "analysis-only";
if (!["analysis-only", "decision-ready"].includes(desired)) throw new Error("COLORBREAK_RELEASE_POSTURE must be analysis-only or decision-ready");

const prices = JSON.parse(await readFile(resolve(ROOT, "data/prices/index.json"), "utf8"));
const observedAt = prices.observedAt;
const fresh = Number.isFinite(Date.parse(observedAt)) && Date.now() - Date.parse(observedAt) <= MAX_AGE;
if (desired === "analysis-only") {
  console.log(`release posture: analysis-only (snapshot ${fresh ? "fresh" : "stale"}; Pages remains a browser-local demo)`);
  process.exit(0);
}

const reviewPath = resolve(ROOT, "data/decision-ready-review.json");
let review;
try { review = JSON.parse(await readFile(reviewPath, "utf8")); } catch { throw new Error("Decision-ready release requires committed data/decision-ready-review.json"); }
if (!fresh) throw new Error("Decision-ready release requires a price snapshot observed within six hours");
for (const field of ["reviewer", "reviewedAt", "appCommitSha", "smokeEvidenceUrl", "disposition"]) {
  if (!review[field]) throw new Error(`Decision-ready release review is missing ${field}`);
}
if (review.disposition !== "accepted" || review.observedAt !== observedAt) throw new Error("Decision-ready release review must accept this exact price observation");
console.log(`release posture: decision-ready (reviewed snapshot ${observedAt})`);
