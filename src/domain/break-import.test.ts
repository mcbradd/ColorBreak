import { describe, expect, it } from "vitest";
import { mergeBreakLines, parseBreakImport } from "./break-import";

describe("break import", () => {
  it("parses the supplied ColorBreak URL composition", () => {
    const parsed = parseBreakImport("https://example.test/?b=CMM.sealed%3Acollector-booster-pack.1~HOB.sealed%3Aplay-booster-pack.5");
    expect(parsed.kind).toBe("url");
    if (parsed.kind === "url") expect(parsed.lines.map((line) => [line.set, line.quantity])).toEqual([["CMM", 1], ["HOB", 5]]);
  });

  it("parses readable product lists with explicit quantities", () => {
    const parsed = parseBreakImport("SPM | Play Booster Pack | 10\nHOB Collector Booster Pack x4");
    expect(parsed).toMatchObject({ kind: "list", errors: [], lines: [
      { set: "SPM", product: "Play Booster Pack", quantity: 10 },
      { set: "HOB", product: "Collector Booster Pack", quantity: 4 },
    ] });
  });

  it("merges only identical canonical set and product keys", () => {
    const lines = mergeBreakLines([
      { id: "a", set: "HOB", productKey: "sealed:play", productLabel: "Play", quantity: 2 },
      { id: "b", set: "HOB", productKey: "sealed:play", productLabel: "Play", quantity: 3 },
      { id: "c", set: "HOB", productKey: "sealed:collector", productLabel: "Collector", quantity: 1 },
    ]);
    expect(lines.map((line) => [line.productKey, line.quantity])).toEqual([["sealed:play", 5], ["sealed:collector", 1]]);
  });
});
