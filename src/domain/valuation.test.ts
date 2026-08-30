import { describe, expect, it } from "vitest";
import { buyerVerdict, calculateBreak, decisionEligibility, DECISION_FRESHNESS_MS, slotOfCard } from "./valuation";
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

  it("prefers the exact finish and falls back to the same printing's listed TCG foil price", () => {
    const exactPrices: CardPrice[] = [{
      ...prices[0],
      prices: { nonfoil: 20, foil: 40, etched: 17 },
    }];
    const etched = calculateBreak({
      prices: exactPrices,
      draws: [{ set: "TST", collectorNumber: "1", copies: 1, finish: "etched", foil: false, source: "etched-slot" }],
    });
    expect(etched.marketEV).toBe(17);

    const listedFallback = calculateBreak({
      prices: exactPrices,
      draws: [{ set: "TST", collectorNumber: "1", copies: 1, finish: "surge", foil: true, source: "surge-slot" }],
    });
    expect(listedFallback.marketEV).toBe(40);
    expect(listedFallback.status).toBe("verified");
    expect(listedFallback.omissions).toHaveLength(0);
    expect(listedFallback.evidence.finish).toBe("class-only");
    expect(listedFallback.slots.find((slot) => slot.id === "G")?.contributors[0]).toEqual(expect.objectContaining({
      finish: "surge",
      marketPrice: 40,
      priceBasis: "same-printing-foil-market",
    }));
  });

  it("keeps printing finishes separate so each contributor has its own price and pull rate", () => {
    const result = calculateBreak({
      prices: [{ ...prices[0], prices: { nonfoil: 8.41, foil: 35.38 } }],
      draws: [
        { set: "TST", collectorNumber: "1", copies: .1, pullProbability: .1, finish: "nonfoil", foil: false, source: "regular" },
        { set: "TST", collectorNumber: "1", copies: .01, pullProbability: .01, finish: "foil", foil: true, source: "foil" },
      ],
      threshold: 0,
    });
    const rows = result.slots.find((slot) => slot.id === "G")!.contributors;

    expect(rows).toHaveLength(2);
    expect(rows.map((row) => [row.finish, row.marketPrice])).toEqual([
      ["nonfoil", 8.41],
      ["foil", 35.38],
    ]);
    expect(rows[0].pullProbability).toBeCloseTo(.1);
    expect(rows[1].pullProbability).toBeCloseTo(.01);
  });

  it("keeps serialized collector outliers price-visible while warning that their EV is unverifiable", () => {
    const result = calculateBreak({
      prices: [{ ...prices[0], prices: { serialized: 50_000 } }],
      draws: [{ set: "TST", collectorNumber: "1", copies: .0001, finish: "serialized", foil: true, source: "serialized-slot" }],
    });
    expect(result.marketEV).toBe(0);
    expect(result.sellableEV).toBe(0);
    expect(result.status).toBe("incomplete");
    expect(result.priceOnlyContributors).toHaveLength(1);
    expect(result.omissions).toContainEqual(expect.objectContaining({
      code: "unverifiable-pull-rate",
      material: true,
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

  it("returns a lower-bound buyer verdict for incomplete results", () => {
    const result = calculateBreak({ draws, prices, omissions: [{ code: "missing", message: "topper missing", material: true }] });
    expect(buyerVerdict(result.slots.find((slot) => slot.id === "G")!, 5, result.status)).toBe("+EV");
  });

  it("keeps an unverifiable-rate chase available by price while excluding it from EV", () => {
    const result = calculateBreak({
      prices: [{
        ...prices[0], set: "EOE", collectorNumber: "382", foil: 1200,
        treatmentMetadata: {
          rawFrameEffects: [], rawPromoTypes: ["headliner"], finishClasses: ["foil"], styleTags: [],
          processTags: ["singularityfoil"], attributeTags: ["headliner"], unknownTags: [],
          fullArt: true, textless: true,
        },
      }],
      draws: [{ set: "EOE", collectorNumber: "382", copies: .002, pullProbability: .002, finish: "singularity", foil: true, source: "collector" }],
    });

    expect(result.marketEV).toBe(0);
    expect(result.sellableEV).toBe(0);
    expect(result.priceOnlyContributors).toHaveLength(1);
    expect(result.priceOnlyContributors[0]).toEqual(expect.objectContaining({ marketPrice: 1200, sellableValue: 0 }));
    expect(result.omissions).toContainEqual(expect.objectContaining({ code: "unverifiable-pull-rate", material: true }));
  });

  it.each(["surge", "textured", "gilded", "other"] as const)(
    "uses the same-printing listed foil price for a new %s treatment",
    (finish) => {
      const result = calculateBreak({
        prices: [{ ...prices[0], prices: { nonfoil: 20, foil: 40 } }],
        draws: [{ set: "TST", collectorNumber: "1", copies: 1, finish, foil: true, source: `${finish}-slot` }],
      });

      expect(result.marketEV).toBe(40);
      expect(result.status).toBe("verified");
      expect(result.slots.find((slot) => slot.id === "G")?.contributors[0]?.priceBasis).toBe("same-printing-foil-market");
    },
  );

  it("uses an exact-printing listed TCG price when no market observation exists", () => {
    const result = calculateBreak({
      prices: [{ ...prices[0], foil: null, prices: { foil: null }, listedPrices: { foil: 18.25 } }],
      draws: [{ set: "TST", collectorNumber: "1", copies: 1, finish: "foil", foil: true, source: "new-release" }],
    });

    expect(result.marketEV).toBe(18.25);
    expect(result.status).toBe("verified");
    expect(result.slots.find((slot) => slot.id === "G")?.contributors[0]?.priceBasis).toBe("listed-tcg");
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

describe("decisionEligibility", () => {
  const observedAt = "2026-08-29T12:00:00.000Z";
  const now = Date.parse(observedAt);
  const fresh = () => calculateBreak({ draws, prices, pricedAt: observedAt, priceSource: "published snapshot" });

  it("allows a complete snapshot at exactly six hours and blocks it one millisecond later", () => {
    expect(decisionEligibility(fresh(), now + DECISION_FRESHNESS_MS)).toMatchObject({
      status: "eligible", blockerCount: 0, reason: "fresh-complete",
    });
    expect(decisionEligibility(fresh(), now + DECISION_FRESHNESS_MS + 1)).toMatchObject({
      status: "stale", blockerCount: 1, reason: "stale-price-snapshot", observedAt, observedSource: "published snapshot",
    });
  });

  it.each([undefined, "not-a-date"])("fails closed when the price timestamp is %p", (pricedAt) => {
    const result = fresh();
    (result as { pricedAt?: string }).pricedAt = pricedAt;
    expect(decisionEligibility(result, now)).toMatchObject({
      status: "unavailable",
      reason: pricedAt ? "invalid-price-timestamp" : "missing-price-timestamp",
    });
  });

  it("reports every material omission as an action blocker even with a fresh snapshot", () => {
    const result = calculateBreak({
      draws, prices, pricedAt: observedAt,
      omissions: [
        { code: "missing-sheet-weight", dedupeKey: "sheet:rare", message: "Rare sheet has unresolved weights.", material: true },
        { code: "missing-price", dedupeKey: "price:TST|9", message: "TST 9 has no exact price.", material: true },
        { code: "missing-booster", dedupeKey: "booster:bonus", message: "Bonus booster is unresolved.", material: true },
      ],
    });
    expect(decisionEligibility(result, now)).toEqual(expect.objectContaining({
      status: "material-incomplete", blockerCount: 3, reason: "material-omissions",
      affectedGroups: expect.arrayContaining([
        expect.objectContaining({ id: "sheet:rare" }),
        expect.objectContaining({ id: "price:TST|9" }),
        expect.objectContaining({ id: "booster:bonus" }),
      ]),
    }));
  });
});
