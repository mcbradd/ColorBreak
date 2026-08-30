import { readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const MAX_AGE = 6 * 60 * 60 * 1000;

export function checkoutSha(root = ROOT, environment = process.env) {
  if (environment.GITHUB_SHA) return environment.GITHUB_SHA.trim().toLowerCase();
  return execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim().toLowerCase();
}

function exactSha(value) {
  return typeof value === "string" && /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(value);
}

function approvedHttpsUrl(value) {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && Boolean(url.hostname) && !url.username && !url.password;
  } catch { return false; }
}

export function validateDecisionReadyReview({ prices, review, expectedSha, now = Date.now() }) {
  const observedAt = prices?.observedAt;
  const observedMs = Date.parse(observedAt);
  if (!Number.isFinite(observedMs)) throw new Error("Decision-ready release requires a parseable price snapshot observation");
  if (now - observedMs > MAX_AGE || observedMs > now) throw new Error("Decision-ready release requires a price snapshot observed within six hours");
  if (!review || typeof review !== "object") throw new Error("Decision-ready release requires committed data/decision-ready-review.json");
  for (const field of ["reviewer", "reviewedAt", "appCommitSha", "smokeEvidenceUrl", "disposition"]) {
    if (!review[field]) throw new Error(`Decision-ready release review is missing ${field}`);
  }
  if (!Number.isFinite(Date.parse(review.reviewedAt))) throw new Error("Decision-ready release review has an invalid reviewedAt timestamp");
  if (!exactSha(review.appCommitSha)) throw new Error("Decision-ready release review appCommitSha must be a full lowercase SHA");
  if (!exactSha(expectedSha) || review.appCommitSha !== expectedSha) throw new Error("Decision-ready release review must accept this exact checkout SHA");
  if (!approvedHttpsUrl(review.smokeEvidenceUrl)) throw new Error("Decision-ready release review smokeEvidenceUrl must be an approved HTTPS URL without credentials");
  if (review.disposition !== "accepted" || review.observedAt !== observedAt) throw new Error("Decision-ready release review must accept this exact price observation");
}

export async function releasePosture({ root = ROOT, environment = process.env, now = Date.now() } = {}) {
  const desired = environment.COLORBREAK_RELEASE_POSTURE ?? "analysis-only";
  if (!["analysis-only", "decision-ready"].includes(desired)) throw new Error("COLORBREAK_RELEASE_POSTURE must be analysis-only or decision-ready");

  const prices = JSON.parse(await readFile(resolve(root, "data/prices/index.json"), "utf8"));
  const observedAt = prices.observedAt;
  const fresh = Number.isFinite(Date.parse(observedAt)) && now - Date.parse(observedAt) <= MAX_AGE;
  if (desired === "analysis-only") {
    console.log(`release posture: analysis-only (snapshot ${fresh ? "fresh" : "stale"}; Pages remains a browser-local demo)`);
    return "analysis-only";
  }

  let review;
  try { review = JSON.parse(await readFile(resolve(root, "data/decision-ready-review.json"), "utf8")); } catch { review = null; }
  validateDecisionReadyReview({ prices, review, expectedSha: checkoutSha(root, environment), now });
  console.log(`release posture: decision-ready (reviewed snapshot ${observedAt})`);
  return "decision-ready";
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await releasePosture();
