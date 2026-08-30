import { describe, expect, it, vi } from "vitest";

const evaluateBreakAnalysis = vi.hoisted(() => vi.fn());
vi.mock("../data/evaluate", () => ({ evaluateBreakAnalysis }));

import { assessBuyerDecision } from "./decision-evidence";
import type { BreakLine, ValuationResult } from "./types";

const line: BreakLine = { id: "one", set: "TST", productKey: "sealed:test", productLabel: "Test", quantity: 1 };
const observed = Date.parse("2026-08-30T00:00:00.000Z");
const valuation = (patch: Partial<ValuationResult> = {}): ValuationResult => ({
  marketEV: 1, sellableEV: 1, knownEV: 1, threshold: 0, status: "verified", statusReason: "ok", slots: [], omissions: [], pricedAt: new Date(observed).toISOString(), priceSource: "snapshot", dataVersion: "snapshot-1", evidence: { productIdentity: "official-verified", contents: "mtgjson-structured", collation: "weighted-upstream", finish: "exact", breakRules: "preset" }, ...patch,
});

describe("buyer decision evidence", () => {
  it.each([
    ["fresh", 0, "verified", [], "eligible"],
    ["exact policy boundary", 6 * 60 * 60 * 1000, "verified", [], "eligible"],
    ["one millisecond stale", 6 * 60 * 60 * 1000 + 1, "verified", [], "stale"],
    ["estimated", 0, "estimated", [], "unavailable"],
    ["material omission", 0, "verified", [{ code: "missing-price", message: "Exact price missing", material: true }], "material-incomplete"],
  ] as const)("projects %s identically", async (_name, age, status, omissions, expected) => {
    evaluateBreakAnalysis.mockResolvedValue({ valuation: valuation({ status, omissions }), outcomeModel: { fixed: [], packs: [] }, outcomeOmissions: [], priceAvailability: { source: "snapshot", observedAt: new Date(observed).toISOString(), status: "available" } });
    const assessment = await assessBuyerDecision([line], 0, observed + age);
    expect(assessment.presentation).toBe(expected);
    expect(assessment.eligibility.status).toBe(expected);
    expect(assessment.compositionFingerprint).toContain("sealed:test");
    expect(assessment.evidenceFingerprint).toContain("snapshot-1");
  });

  it("marks a missing timestamp unavailable", async () => {
    evaluateBreakAnalysis.mockResolvedValue({ valuation: valuation({ pricedAt: "" }), outcomeModel: { fixed: [], packs: [] }, outcomeOmissions: [], priceAvailability: { source: "snapshot", status: "unavailable" } });
    expect((await assessBuyerDecision([line], 0, observed)).presentation).toBe("unavailable");
  });
});
