import { describe, expect, it } from "vitest";
import { buyerVerdict, calculateBreak, slotOfCard } from "./valuation";
import type { CardPrice, ExpectedDraw } from "./types";

const prices: CardPrice[] = [
  { id: "a", set: "TST", collectorNumber: "1", name: "Green Chase", slot: "G", nonfoil: 20, foil: 40 },
  { id: "b", set: "TST", collectorNumber: "2", name: "Green Bulk", slot: "G", nonfoil: 0.5, foil: null },
  { id: "c", set: "TST", collectorNumber: "3", name: "Island", slot: "L", nonfoil: 2, foil: 5 },
];
const draws: ExpectedDraw[] = [
  { set: "TST", collectorNumber: "1", copies: 0.5, foil: false, source: "play/rare" },
  { set: "TST", collectorNumber: "2", copies: 2, foil: false, source: "play/common" },
  { set: "TST", collectorNumber: "3", copies: 1, foil: true, source: "play/land" },
];

describe("calculateBreak", () => {
  it("returns market, sellable, and per-slot downside through one interface", () => {
    const result = calculateBreak({ draws, prices, threshold: 2, sourceStatus: "verified" });
    expect(result.marketEV).toBe(16);
    expect(result.sellableEV).toBe(15);
    expect(result.knownEV).toBe(15);
    expect(result.status).toBe("verified");
    const green = result.slots.find((slot) => slot.id === "G")!;
    expect(green.marketEV).toBe(11);
    expect(green.withoutChase).toBe(0);
    expect(green.chaseShare).toBe(1);
    expect(green.contributors.map((row) => row.card.name)).toEqual(["Green Chase"]);
  });

  it("reconciles counted EV and excluded bulk at every threshold boundary", () => {
    const cases = [
      { threshold: 0, counted: 16, excluded: 0 },
      { threshold: 0.5, counted: 16, excluded: 0 },
      { threshold: 2, counted: 15, excluded: 1 },
      { threshold: 100, counted: 0, excluded: 16 },
    ];
    for (const expected of cases) {
      const result = calculateBreak({ draws, prices, threshold: expected.threshold });
      const excluded = result.marketEV - result.sellableEV;
      expect(result.sellableEV).toBeCloseTo(expected.counted);
      expect(excluded).toBeCloseTo(expected.excluded);
      expect(result.marketEV).toBeCloseTo(result.sellableEV + excluded);
      expect(excluded).toBeGreaterThanOrEqual(0);
    }
  });

  it("never substitutes a nonfoil price for a missing foil price", () => {
    const result = calculateBreak({
      draws: [{ set: "TST", collectorNumber: "2", copies: 1, foil: true, source: "foil" }],
      prices,
    });
    expect(result.marketEV).toBe(0);
    expect(result.status).toBe("incomplete");
    expect(result.omissions[0].code).toBe("missing-foil-price");
  });

  it("uses the exact requested finish and never substitutes a different premium finish", () => {
    const exactPrices: CardPrice[] = [{
      ...prices[0],
      prices: { nonfoil: 20, foil: 40, etched: 17 },
    }];
    const etched = calculateBreak({
      prices: exactPrices,
      draws: [{ set: "TST", collectorNumber: "1", copies: 1, finish: "etched", foil: false, source: "etched-slot" }],
    });
    expect(etched.marketEV).toBe(17);

    const missing = calculateBreak({
      prices: exactPrices,
      draws: [{ set: "TST", collectorNumber: "1", copies: 1, finish: "surge", foil: true, source: "surge-slot" }],
    });
    expect(missing.marketEV).toBe(0);
    expect(missing.status).toBe("incomplete");
    expect(missing.omissions[0].code).toBe("missing-surge-price");
  });

  it("excludes serialized collector outliers from decision value without blocking the break", () => {
    const result = calculateBreak({
      prices: [{ ...prices[0], prices: { serialized: 50_000 } }],
      draws: [{ set: "TST", collectorNumber: "1", copies: .0001, finish: "serialized", foil: true, source: "serialized-slot" }],
    });
    expect(result.marketEV).toBe(0);
    expect(result.sellableEV).toBe(0);
    expect(result.status).toBe("verified");
    expect(result.omissions).toContainEqual(expect.objectContaining({
      code: "collector-outlier-excluded",
      material: false,
    }));
  });

  it("combines pull odds across every source in the current break", () => {
    const result = calculateBreak({
      prices,
      draws: [
        { ...draws[0], pullProbability: 0.25, source: "box-one" },
        { ...draws[0], pullProbability: 0.5, source: "box-two" },
      ],
    });
    const chase = result.slots.find((slot) => slot.id === "G")!.contributors[0];
    expect(chase.pullProbability).toBeCloseTo(0.625);
  });

  it("suppresses buyer verdicts for incomplete results", () => {
    const result = calculateBreak({ draws, prices, omissions: [{ code: "missing", message: "topper missing", material: true }] });
    expect(buyerVerdict(result.slots.find((slot) => slot.id === "G")!, 5, result.status)).toBe("NO VERDICT");
  });

  it("does not mislabel a price-source outage as incomplete product contents", () => {
    const result = calculateBreak({
      draws,
      prices: [],
      sourceStatus: "verified",
      omissions: [{
        code: "price-source-unavailable",
        message: "Scryfall is rate limited.",
        material: true,
      }],
    });
    expect(result.status).toBe("incomplete");
    expect(result.statusReason).toContain("Product contents are resolved");
    expect(result.evidence.contents).toBe("mtgjson-structured");
    expect(result.evidence.collation).toBe("weighted-upstream");
    expect(result.evidence.finish).toBe("unresolved");
  });
});

describe("slotOfCard", () => {
  it("uses front-face printed color and sends lands to Lands", () => {
    expect(slotOfCard({ colors: ["R"], typeLine: "Creature" })).toBe("R");
    expect(slotOfCard({ colors: ["W", "U"], typeLine: "Creature" })).toBe("M");
    expect(slotOfCard({ colors: [], typeLine: "Artifact" })).toBe("C");
    expect(slotOfCard({ colors: ["G"], typeLine: "Land Creature" })).toBe("L");
  });
});
