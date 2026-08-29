import { describe, expect, it } from "vitest";
import { CATCH_ALL_SPOTS, createLargeBreakPlan, sortNamedCards, summarizeAssignmentValues } from "./large-break";
import { calculateBreak } from "./valuation";

describe("large random break plan", () => {
  it("summarizes the deterministic assignment-value distribution", () => {
    const summary = summarizeAssignmentValues({
      spotCount: 4,
      namedTarget: 2,
      namedCards: [{ pullEV: 1 }, { pullEV: 3 }] as never,
      categories: [{ pullEV: 5 }, { pullEV: 7 }] as never,
      totalPullEV: 16,
    });
    expect(summary.values).toEqual([1, 3, 5, 7]);
    expect(summary.median).toBe(4);
    expect(summary.mean).toBe(4);
    expect(summary.namedAverage).toBe(2);
    expect(summary.categoryAverage).toBe(6);
    expect(summary.categoryShare).toBe(.75);
  });

  it("reserves all 17 observed catch-all slots and fills the rest with top-value identities", () => {
    const prices = Array.from({ length: 110 }, (_, index) => ({
      id: `card-${index}`,
      set: "TST",
      collectorNumber: String(index + 1),
      name: `Card ${index + 1}`,
      typeLine: "Instant",
      slot: "U" as const,
      nonfoil: 110 - index,
      foil: null,
    }));
    const result = calculateBreak({ threshold: 0, prices, draws: prices.map((card) => ({
      set: card.set, collectorNumber: card.collectorNumber, copies: 1, foil: false, source: "test",
    })) });

    const plan = createLargeBreakPlan(result, 120);

    expect(CATCH_ALL_SPOTS).toHaveLength(17);
    expect(plan.categories.map((category) => category.key)).toEqual(CATCH_ALL_SPOTS.map((category) => category.key));
    expect(plan.namedCards).toHaveLength(103);
    expect(plan.namedCards.at(-1)?.marketPrice).toBe(8);
    expect(plan.namedCards.some((card) => card.marketPrice === 7)).toBe(false);
    expect(plan.namedCards.length + plan.categories.length).toBe(120);
  });

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
    const plan = createLargeBreakPlan(result, 18);
    expect(plan.namedCards.map((card) => card.name)).toEqual(["Named Dragon"]);
    expect(plan.namedCards[0].row.card.name).toBe("Named Dragon");
    expect(plan.categories.find((row) => row.label === "Red Creature (All Unlisted)")?.pullEV).toBe(10);
    expect(plan.categories.find((row) => row.label === "Instant")?.pullEV).toBe(4);
    expect(plan.categories).toHaveLength(17);
    expect(plan.namedCards[0].pullEV + plan.categories.reduce((sum, row) => sum + row.pullEV, 0)).toBe(result.sellableEV);
  });

  it("creates only one spot for each residual category type", () => {
    const prices = [
      { id: "named", set: "TST", collectorNumber: "1", name: "Named Dragon", typeLine: "Legendary Creature — Dragon", slot: "R" as const, nonfoil: 50, foil: null },
      { id: "creature", set: "TST", collectorNumber: "2", name: "Goblin", typeLine: "Creature — Goblin", slot: "R" as const, nonfoil: 5, foil: null },
      { id: "instant", set: "TST", collectorNumber: "3", name: "Bolt", typeLine: "Instant", slot: "R" as const, nonfoil: 4, foil: null },
    ];
    const result = calculateBreak({ threshold: 0, prices, draws: prices.map((card) => ({
      set: card.set, collectorNumber: card.collectorNumber, copies: 1, foil: false, source: "test",
    })) });

    const plan = createLargeBreakPlan(result, 18);

    expect(plan.categories.filter((category) => category.cardCount > 0).map((category) => category.label)).toEqual([
      "Red Creature (All Unlisted)", "Instant",
    ]);
  });

  it("represents a residual category as one indivisible slot", () => {
    const result = calculateBreak({ threshold: 0, prices: [
      { id: "instant", set: "TST", collectorNumber: "1", name: "Bolt", typeLine: "Instant", slot: "R", nonfoil: 4, foil: null },
    ], draws: [
      { set: "TST", collectorNumber: "1", copies: 2, foil: false, source: "test" },
    ] });

    const category = createLargeBreakPlan(result, 17).categories.find((row) => row.key === "instant")!;

    expect(category.pullEV).toBe(8);
    expect(category).not.toHaveProperty("spots");
    expect(category).not.toHaveProperty("evPerSpot");
  });

  it("combines finishes of the same named card into one slot", () => {
    const result = calculateBreak({ threshold: 0, prices: [
      { id: "dual-finish", set: "TST", collectorNumber: "1", name: "Dual Finish", typeLine: "Creature — Test", slot: "U", nonfoil: 10, foil: 20 },
    ], draws: [
      { set: "TST", collectorNumber: "1", copies: 1, foil: false, source: "test" },
      { set: "TST", collectorNumber: "1", copies: 1, foil: true, source: "test" },
    ] });

    const plan = createLargeBreakPlan(result, 18);

    expect(plan.namedCards).toHaveLength(1);
    expect(plan.namedCards[0].pullEV).toBe(30);
  });

  it("combines every card for a character into one named character slot", () => {
    const jaceNames = [
      "Jace Beleren",
      "Jace Reawakened",
      "Jace, Arcane Strategist",
      "Jace, Architect of Thought",
      "Jace, Cunning Castaway",
      "Jace, Ingenious Mind Mage",
      "Jace, Memory Adept",
      "Jace, Mirror Mage",
      "Jace, Telepath Unbound",
      "Jace, Unraveler of Secrets",
      "Jace, Vryn’s Prodigy",
      "Jace, Wielder of Mysteries",
      "Jace, The Living Guildpact",
    ];
    const characterCards = [
      ...jaceNames.map((name) => ({ name, typeLine: name === "Jace, Vryn’s Prodigy" ? "Legendary Creature — Human Wizard" : "Legendary Planeswalker — Jace" })),
      { name: "Aang, Swift Savior", typeLine: "Legendary Creature — Human Avatar Ally" },
      { name: "Aang at the Crossroads", typeLine: "Legendary Creature — Human Avatar Ally" },
      { name: "Avatar Aang // Aang, Master of Elements", typeLine: "Legendary Creature — Human Avatar Ally // Legendary Creature — Human Avatar Ally" },
      { name: "Michelangelo, Party Dude", typeLine: "Legendary Creature — Mutant Ninja Turtle" },
      { name: "Michelangelo, the Heart", typeLine: "Legendary Creature — Mutant Ninja Turtle" },
    ];
    const prices = characterCards.map((card, index) => ({
      id: `character-${index}`,
      set: index < jaceNames.length ? "TST" : index < jaceNames.length + 2 ? "TLA" : "TMT",
      collectorNumber: String(index + 1),
      name: card.name,
      typeLine: card.typeLine,
      slot: "M" as const,
      nonfoil: 10,
      foil: null,
    }));
    const result = calculateBreak({ threshold: 0, prices, draws: prices.map((card) => ({
      set: card.set, collectorNumber: card.collectorNumber, copies: 1, foil: false, source: "test",
    })) });

    const plan = createLargeBreakPlan(result, 20);

    expect(plan.namedCards.map((spot) => spot.name).sort()).toEqual(["Aang", "Jace", "Michelangelo"]);
    expect(plan.namedCards.find((spot) => spot.name === "Jace")?.pullEV).toBe(jaceNames.length * 10);
    expect(plan.namedCards.find((spot) => spot.name === "Aang")?.pullEV).toBe(30);
  });

  it("does not merge unrelated non-character cards by their first word", () => {
    const prices = [
      { id: "black-lotus", set: "TST", collectorNumber: "1", name: "Black Lotus", typeLine: "Artifact", slot: "C" as const, nonfoil: 100, foil: null },
      { id: "black-market", set: "TST", collectorNumber: "2", name: "Black Market", typeLine: "Enchantment", slot: "B" as const, nonfoil: 50, foil: null },
    ];
    const result = calculateBreak({ threshold: 0, prices, draws: prices.map((card) => ({
      set: card.set, collectorNumber: card.collectorNumber, copies: 1, foil: false, source: "test",
    })) });

    const plan = createLargeBreakPlan(result, 19);

    expect(plan.namedCards.map((spot) => spot.name).sort()).toEqual(["Black Lotus", "Black Market"]);
  });

  it("uses the observed catch-all spot categories", () => {
    const prices = [
      { id: "artifact", collectorNumber: "1", name: "Relic", typeLine: "Artifact", colors: [] },
      { id: "equipment", collectorNumber: "2", name: "Sword", typeLine: "Artifact — Equipment", colors: [] },
      { id: "vehicle", collectorNumber: "3", name: "Ship", typeLine: "Artifact — Vehicle", colors: [] },
      { id: "land", collectorNumber: "4", name: "Realm", typeLine: "Legendary Land", colors: [] },
      { id: "dragon", collectorNumber: "5", name: "Ancient Dragon", typeLine: "Legendary Creature — Elder Dragon", colors: ["R"] },
      { id: "multi", collectorNumber: "6", name: "Pair", typeLine: "Creature — Human", colors: ["W", "U"] },
      { id: "colorless", collectorNumber: "7", name: "Construct", typeLine: "Artifact Creature — Construct", colors: [] },
    ].map((card) => ({ ...card, set: "TST", slot: "C" as const, nonfoil: 5, foil: null }));
    const result = calculateBreak({ threshold: 0, prices, draws: prices.map((card) => ({
      set: card.set, collectorNumber: card.collectorNumber, copies: 1, foil: false, source: "test",
    })) });

    const labels = createLargeBreakPlan(result, 17).categories.map((row) => row.label);

    expect(labels).toEqual(expect.arrayContaining([
      "Artifact (Excluding Creature, Vehicle, Land & Equipment)",
      "Equipment (All Unlisted)",
      "Vehicle",
      "Legendary Land",
      "Ancient Elder Dragon",
      "Multicolor Creature (All Unlisted)",
      "Colorless Creature (All Unlisted)",
    ]));
  });

  it("accounts for otherwise unmatched card types in the final catch-all", () => {
    const result = calculateBreak({ threshold: 0, prices: [
      { id: "battle", set: "TST", collectorNumber: "1", name: "Invasion of Test", typeLine: "Battle — Siege", slot: "M", nonfoil: 5, foil: null },
    ], draws: [
      { set: "TST", collectorNumber: "1", copies: 1, foil: false, source: "test" },
    ] });

    const plan = createLargeBreakPlan(result, 17);
    const catchAll = plan.categories.find((category) => category.key === "planeswalker-other");

    expect(catchAll).toMatchObject({ label: "Planeswalker & Other Cards", pullEV: 5, cardCount: 1 });
    expect(plan.categories.reduce((sum, category) => sum + category.pullEV, 0)).toBe(result.sellableEV);
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

    expect(plan.namedCards).toHaveLength(9);
    expect(plan.categories).toHaveLength(17);
    expect(new Set(plan.categories.map((row) => row.key)).size).toBe(plan.categories.length);
    expect(plan.namedCards.reduce((sum, row) => sum + row.pullEV, 0) + plan.categories.reduce((sum, row) => sum + row.pullEV, 0)).toBe(result.sellableEV);
  });
});
