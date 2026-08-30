import assert from "node:assert/strict";
import test from "node:test";
import { validateDecisionReadyReview } from "../tools/release-posture.mjs";
import { validatePublicConfig } from "../tools/public-config.mjs";

const now = Date.parse("2026-08-30T12:00:00.000Z");
const sha = "a".repeat(40);
const prices = { observedAt: "2026-08-30T10:00:00.000Z" };
const accepted = {
  reviewer: "Release reviewer",
  reviewedAt: "2026-08-30T11:00:00.000Z",
  appCommitSha: sha,
  smokeEvidenceUrl: "https://evidence.example/release/123",
  disposition: "accepted",
  observedAt: prices.observedAt,
};

function rejects(change, message) {
  assert.throws(() => validateDecisionReadyReview({ prices, review: { ...accepted, ...change }, expectedSha: sha, now }), new RegExp(message));
}

test("decision-ready posture requires an exact reviewed artifact", () => {
  assert.doesNotThrow(() => validateDecisionReadyReview({ prices, review: accepted, expectedSha: sha, now }));
  rejects({ appCommitSha: "A".repeat(40) }, "lowercase SHA");
  rejects({ appCommitSha: "b".repeat(40) }, "exact checkout SHA");
  rejects({ reviewedAt: "not-a-date" }, "reviewedAt");
  rejects({ smokeEvidenceUrl: "http://evidence.example" }, "HTTPS URL");
  rejects({ smokeEvidenceUrl: "https://user:pass@evidence.example" }, "HTTPS URL");
  rejects({ disposition: "pending" }, "exact price observation");
  rejects({ observedAt: "2026-08-30T09:00:00.000Z" }, "exact price observation");
});

test("decision-ready posture rejects missing review and stale or malformed observations", () => {
  assert.throws(() => validateDecisionReadyReview({ prices, review: null, expectedSha: sha, now }), /decision-ready-review/);
  assert.throws(() => validateDecisionReadyReview({ prices: { observedAt: "not-a-date" }, review: accepted, expectedSha: sha, now }), /parseable/);
  assert.throws(() => validateDecisionReadyReview({ prices: { observedAt: "2026-08-30T05:59:59.000Z" }, review: accepted, expectedSha: sha, now }), /within six hours/);
  assert.throws(() => validateDecisionReadyReview({ prices: { observedAt: "2026-08-30T13:00:00.000Z" }, review: accepted, expectedSha: sha, now }), /within six hours/);
});

test("public optional endpoints are blank or source-controlled HTTPS origins", () => {
  assert.doesNotThrow(() => validatePublicConfig({}));
  assert.doesNotThrow(() => validatePublicConfig({
    VITE_ANALYTICS_ENDPOINT: "https://plausible.io/api/event",
    VITE_SUPPORT_URL: "https://ko-fi.com/colorbreak",
    VITE_TCGPLAYER_AFFILIATE_URL: "https://www.tcgplayer.com/search/product?productLineName=magic&productName={card}",
  }));
  for (const [name, value] of Object.entries({
    VITE_ANALYTICS_ENDPOINT: "http://plausible.io/event",
    VITE_SUPPORT_URL: "https://user:pass@github.com/colorbreak",
    VITE_TCGPLAYER_AFFILIATE_URL: "https://example.com/?card={card}",
  })) assert.throws(() => validatePublicConfig({ [name]: value }), /approved HTTPS origin/);
});

test("Pages workflow is permanently analysis-only", async () => {
  const workflow = await import("node:fs/promises").then(({ readFile }) => readFile(new URL("../.github/workflows/deploy-pages.yml", import.meta.url), "utf8"));
  assert.match(workflow, /COLORBREAK_RELEASE_POSTURE: analysis-only/);
  assert.doesNotMatch(workflow, /decision-ready/);
  assert.match(workflow, /Pages artifacts must be analysis-only/);
});
