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
    expect(result.knownEV).toBe(16);
    expect(result.status).toBe("verified");
    const green = result.slots.find((slot) => slot.id === "G")!;
    expect(green.marketEV).toBe(11);
    expect(green.withoutChase).toBe(1);
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

  it("suppresses buyer verdicts for incomplete results", () => {
    const result = calculateBreak({ draws, prices, omissions: [{ code: "missing", message: "topper missing", material: true }] });
    expect(buyerVerdict(result.slots.find((slot) => slot.id === "G")!, 5, result.status)).toBe("NO VERDICT");
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
