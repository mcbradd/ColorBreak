import { describe, expect, it } from "vitest";
import { createLargeBreakPlan } from "./large-break";
import { calculateBreak } from "./valuation";

describe("large random break plan", () => {
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
    expect(plan.categories.find((row) => row.label === "Red creatures")?.pullEV).toBe(10);
    expect(plan.categories.find((row) => row.label === "Instants")?.pullEV).toBe(4);
    expect(plan.categories.reduce((sum, row) => sum + row.spots, 0) + plan.namedCards.length).toBe(4);
    expect(plan.namedCards[0].pullEV + plan.categories.reduce((sum, row) => sum + row.pullEV, 0)).toBe(result.sellableEV);
  });
});
