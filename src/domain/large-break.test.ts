import { describe, expect, it } from "vitest";
import { createLargeBreakPlan, sortNamedCards } from "./large-break";
import { calculateBreak } from "./valuation";

describe("large random break plan", () => {
  it("ranks the named pool by either price or expected value without mutating it", () => {
    const cards = [
      { key: "chase", name: "Expensive Chase", set: "TST", marketPrice: 100, pullEV: 2 },
      { key: "common", name: "Frequent Hit", set: "TST", marketPrice: 20, pullEV: 8 },
    ];

    expect(sortNamedCards(cards, "price").map((card) => card.name)).toEqual(["Expensive Chase", "Frequent Hit"]);
    expect(sortNamedCards(cards, "expected-value").map((card) => card.name)).toEqual(["Frequent Hit", "Expensive Chase"]);
    expect(cards.map((card) => card.name)).toEqual(["Expensive Chase", "Frequent Hit"]);
  });

  it("keeps unverifiable chases in price ranking and removes them from EV ranking", () => {
    const cards = [
      { key: "uncertain", name: "Unverifiable Chase", set: "TST", marketPrice: 1000, pullEV: 0, pullRateVerified: false },
      { key: "known", name: "Verified Hit", set: "TST", marketPrice: 100, pullEV: 5, pullRateVerified: true },
    ];

    expect(sortNamedCards(cards, "price").map((card) => card.name)).toEqual(["Unverifiable Chase", "Verified Hit"]);
    expect(sortNamedCards(cards, "expected-value").map((card) => card.name)).toEqual(["Verified Hit"]);
  });

  it("removes named cards from residual creature and card-type EV", () => {
    const result = calculateBreak({ threshold: 2, prices: [
      { id: "named", set: "TST", collectorNumber: "1", name: "Named Dragon", typeLine: "Legendary Creature — Dragon", slot: "R", nonfoil: 50, foil: null },
      { id: "creature", set: "TST", collectorNumber: "2", name: "Goblin", typeLine: "Creature — Goblin", slot: "R", nonfoil: 5, foil: null },
      { id: "instant", set: "TST", collectorNumber: "3", name: "Bolt", typeLine: "Instant", slot: "R", nonfoil: 4, foil: null },
    ], draws: [
      { set: "TST", collectorNumber: "1", copies: 1, foil: false, source: "test" },
      { set: "TST", collectorNumber: "2", copies: 2, foil: false, source: "test" },
      { set: "TST", collectorNumber: "3", copies: 1, foil: false, source: "test" },
    ] });
    const plan = createLargeBreakPlan(result, 4, .25);
    expect(plan.namedCards.map((card) => card.name)).toEqual(["Named Dragon"]);
    expect(plan.namedCards[0].row.card.name).toBe("Named Dragon");
    expect(plan.categories.find((row) => row.label === "Red creatures")?.pullEV).toBe(10);
    expect(plan.categories.find((row) => row.label === "Instants")?.pullEV).toBe(4);
    expect(plan.categories.reduce((sum, row) => sum + row.spots, 0) + plan.namedCards.length).toBe(4);
    expect(plan.namedCards[0].pullEV + plan.categories.reduce((sum, row) => sum + row.pullEV, 0)).toBe(result.sellableEV);
  });

  it("reserves residual category spots when the priced pool is smaller than the named target", () => {
    const prices = Array.from({ length: 9 }, (_, index) => ({
      id: `card-${index}`,
      set: "TST",
      collectorNumber: String(index + 1),
      name: `Card ${index + 1}`,
      typeLine: index % 2 ? "Creature — Test" : "Instant",
      slot: "U" as const,
      nonfoil: 10 - index,
      foil: null,
    }));
    const result = calculateBreak({ threshold: 0, prices, draws: prices.map((card) => ({
      set: card.set,
      collectorNumber: card.collectorNumber,
      copies: 1,
      foil: false,
      source: "test",
    })) });

    const plan = createLargeBreakPlan(result, 150);

    expect(plan.namedCards).toHaveLength(6);
    expect(plan.categories.length).toBeGreaterThan(0);
    expect(plan.categories.reduce((sum, row) => sum + row.spots, 0) + plan.namedCards.length).toBe(150);
    expect(plan.namedCards.reduce((sum, row) => sum + row.pullEV, 0) + plan.categories.reduce((sum, row) => sum + row.pullEV, 0)).toBe(result.sellableEV);
  });
});
