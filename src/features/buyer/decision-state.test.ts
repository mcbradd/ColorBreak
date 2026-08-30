import { describe, expect, it } from "vitest";
import { decisionFingerprint } from "./decision-state";

const input = {
  lines: [{ id: "unrelated-id", set: "tst", productKey: "box", productLabel: "Box", quantity: 1 }],
  selected: "W" as const, assignmentMode: "pick", remaining: ["W" as const], bid: 12,
  shipping: 3, risk: "median", omissionIds: ["a"], valuationVersion: "v1",
  priceSource: "snapshot", observedAt: "2026-08-30T00:00:00.000Z", distribution: { median: 20, mean: 21 },
};

describe("decisionFingerprint", () => {
  it("is stable across non-material line ids and object key order", () => {
    expect(decisionFingerprint(input)).toBe(decisionFingerprint({ ...input, distribution: { mean: 21, median: 20 } }));
  });

  it("changes for composition, evidence, and resolved distribution changes", () => {
    const original = decisionFingerprint(input);
    expect(decisionFingerprint({ ...input, lines: [{ ...input.lines[0], quantity: 2 }] })).not.toBe(original);
    expect(decisionFingerprint({ ...input, observedAt: "2026-08-30T01:00:00.000Z" })).not.toBe(original);
    expect(decisionFingerprint({ ...input, distribution: "pending" })).not.toBe(original);
  });
});
