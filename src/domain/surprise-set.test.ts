import { describe, expect, it } from "vitest";
import type { BreakAnalysis } from "../data/evaluate";
import { calculateBreak } from "./valuation";
import { applySurpriseSet, autofillStandardColorTeams } from "./surprise-set";
import type { SurpriseSetCard } from "./surprise-set";

function analysis(): BreakAnalysis {
  const valuation = calculateBreak({
    prices: [
      { id: "w", set: "TST", collectorNumber: "1", name: "White Card", slot: "W", nonfoil: 10, foil: null },
      { id: "u", set: "TST", collectorNumber: "2", name: "Blue Card", slot: "U", nonfoil: 20, foil: null },
    ],
    draws: [
      { set: "TST", collectorNumber: "1", copies: 1, foil: false, source: "fixed" },
      { set: "TST", collectorNumber: "2", copies: 1, foil: false, source: "fixed" },
    ],
    threshold: 0,
    dataVersion: "surprise-set-test",
  });
  return {
    valuation,
    outcomeModel: { cacheKey: "surprise-set-test", complete: true, packs: [], fixed: [] },
    outcomeOmissions: [],
    priceAvailability: { status: "available", source: "snapshot", message: "Available" },
  };
}

describe("seller Surprise Set configuration", () => {
  it("autofills modeled cards into their standard color teams", () => {
    const cards = autofillStandardColorTeams(analysis());

    expect(cards.map(({ slot, name, value }) => ({ slot, name, value }))).toEqual([
      { slot: "W", name: "White Card", value: 10 },
      { slot: "U", name: "Blue Card", value: 20 },
    ]);
  });

  it("uses manually entered card contents and values when the product has no card model", () => {
    const base = analysis();
    const cards: SurpriseSetCard[] = [
      { id: "w-one", slot: "W", name: "Seller's White Card", value: 12.5 },
      { id: "u-one", slot: "U", name: "Seller's Blue Card", value: 7 },
    ];
    const configured = applySurpriseSet({
      ...base,
      valuation: { ...base.valuation, slots: base.valuation.slots.map(slot => ({ ...slot, contributors: [], marketEV: 0, sellableEV: 0, knownEV: 0 })) },
      outcomeModel: { cacheKey: "empty", complete: false, packs: [], fixed: [] },
    }, cards);

    expect(configured.valuation.expectedCards).toBe(2);
    expect(configured.valuation.sellableEV).toBe(19.5);
    expect(configured.valuation.slots.find(slot => slot.id === "W")).toMatchObject({ sellableEV: 12.5, contributors: [{ card: { name: "Seller's White Card" } }] });
    expect(configured.outcomeModel.fixed).toEqual([
      { id: "w-one", slot: "W", value: 12.5, weight: 1 },
      { id: "u-one", slot: "U", value: 7, weight: 1 },
    ]);
  });

  it("keeps the product estimate when the seller has not configured any cards", () => {
    const base = analysis();
    expect(applySurpriseSet(base, [])).toBe(base);
  });
});
