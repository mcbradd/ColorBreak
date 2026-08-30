import { describe, expect, it } from "vitest";
import { DECISION_FRESHNESS_MS } from "./valuation";
import { decisionReadiness } from "./decision-readiness";

describe("decisionReadiness", () => {
  const now = Date.parse("2026-08-30T12:00:00.000Z");
  const fresh = (age = 0) => decisionReadiness({ contentsStatus: "verified", priceObservedAt: new Date(now - age).toISOString(), now });
  it("is ready exactly at the six-hour boundary and stale immediately after", () => {
    expect(fresh(DECISION_FRESHNESS_MS).eligibility).toBe("ready");
    expect(fresh(DECISION_FRESHNESS_MS + 1).eligibility).toBe("stale");
  });
  it("does not confuse verified contents with a usable decision", () => {
    expect(decisionReadiness({ contentsStatus: "verified", now }).eligibility).toBe("unavailable");
    expect(decisionReadiness({ contentsStatus: "verified", priceObservedAt: new Date(now).toISOString(), now, materialOmissions: [{ material: true, message: "Missing exact price" }] })).toMatchObject({ eligibility: "incomplete", materialBlockers: ["Missing exact price"] });
  });
});
