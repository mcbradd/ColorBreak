import { describe, expect, it } from "vitest";
import { resolveCollation, type CollationRule } from "./collation-policy";
import type { Booster } from "./sealed";

const raw: Booster = { picks: { common: 6.5, guest: .5 }, variants: [
  { weight: 1, picks: { common: 7 } }, { weight: 1, picks: { common: 6, guest: 1 } },
], sheets: {
  common: { total: 2, cards: [["1", 1], ["2", 1]], foil: false },
  guest: { total: 1, cards: [["SPG", "1", 1]], foil: false },
} };
const rule = (tier: CollationRule["tier"], probability: number): CollationRule => ({ id: tier, set: "TST", booster: "play", tier, source: "https://example.test/source", reviewedAt: "2026-09-06", note: "Insert rate", fact: { kind: "variant-rate", sheet: "guest", probability } });
describe("per-product source hierarchy", () => {
  it("prefers official rates over community and inference in both variants and analytic picks", () => {
    const result = resolveCollation("TST", "play", raw, "TST/box", [rule("inferred", .7), rule("community", .2), rule("official", .01)]);
    expect(result.recipe.picks.guest).toBeCloseTo(.01);
    expect(result.recipe.picks.common).toBeCloseTo(6.99);
    expect(result.recipe.variants[1].weight).toBeCloseTo(.01);
    expect(raw.picks.guest).toBe(.5);
  });
  it("matches an exact product override without affecting another product", () => {
    const specific = { ...rule("official", .1), product: "TST/special-box", id: "specific" };
    expect(resolveCollation("TST", "play", raw, "TST/special-box", [rule("official", .01), specific]).recipe.picks.guest).toBeCloseTo(.1);
    expect(resolveCollation("TST", "play", raw, "TST/pack", [rule("official", .01), specific]).recipe.picks.guest).toBeCloseTo(.01);
  });
  it("retains a usable source-qualified recipe for incompatible official claims", () => {
    const impossible = { ...rule("official", .01), fact: { kind: "variant-rate" as const, sheet: "absent", probability: .01 } };
    const result = resolveCollation("TST", "play", raw, "TST/pack", [impossible]);
    expect(result.recipe.variants).toEqual(raw.variants);
    expect(result.conflicts).toHaveLength(1);
    expect(result.evidence.some((row) => row.rule === "official")).toBe(false);
  });
  it("never applies Play color assumptions to Set or Collector boosters", () => {
    expect(resolveCollation("TST", "set", raw, "TST/set-pack").recipe.sheets.common.minColors).toBeUndefined();
    expect(resolveCollation("TST", "collector", raw, "TST/collector-pack").recipe.sheets.common.minColors).toBeUndefined();
  });
});
