import { describe, expect, it } from "vitest";
import { possibleSlotBounds, simulateOutcomes, type PackOutcomeModel } from "./simulation";
import { SLOT_IDS } from "./types";

const colors = SLOT_IDS.slice(0, 5);
function pack(minColors: number, picks = 6): PackOutcomeModel {
  return { fixed: [], packs: [{ count: 1, variants: [{ weight: 1, picks: { common: picks } }], sheets: {
    common: { totalWeight: 16, minColors, cards: [
      ...colors.flatMap((slot) => [1, 2, 3].map((value) => ({ id: `${slot}${value}`, slot, value }))),
      { id: "land", slot: "L", value: 1 },
    ] },
  } }] };
}
describe("physical collation constraints", () => {
  it("enforces five colors in Draft MIN/MAX and every sampled pack", () => {
    const model = pack(5);
    const bounds = possibleSlotBounds(model);
    for (const color of colors) expect(bounds[color]).toEqual({ min: 1, max: 5 });
    expect(bounds.C).toEqual({ min: 0, max: 0 });
    const sampled = simulateOutcomes(model, { seed: "draft-colors", sampleCount: 1000, remaining: [...colors] });
    for (const color of colors) { expect(sampled.slotDistributions[color].p01).toBeGreaterThanOrEqual(1); expect(sampled.slotDistributions[color].p99).toBeLessThanOrEqual(5); }
  });
  it("allows a particular Play color to miss while reserving room for four colors", () => {
    const model = pack(4);
    const bounds = possibleSlotBounds(model);
    for (const color of colors) expect(bounds[color]).toEqual({ min: 0, max: 6 });
    const sampled = simulateOutcomes(model, { seed: "play-colors", sampleCount: 1000, remaining: [...colors] });
    expect(colors.some((color) => sampled.slotDistributions[color].p01 === 0)).toBe(true);
  });
  it("keeps color guarantees when filtering bulk, but correctly permits $0", () => {
    const model = pack(5);
    model.packs[0].sheets.common.cards.forEach((card) => { card.value = 0; });
    const result = simulateOutcomes(model, { seed: "filtered", sampleCount: 20, remaining: ["W"] });
    expect(result.slotDistributions.W).toMatchObject({ min: 0, max: 0, mean: 0 });
  });
  it("does not draw two alternate printings of one identity from a sheet", () => {
    const model: PackOutcomeModel = { fixed: [], packs: [{ count: 1, variants: [{ weight: 1, picks: { rare: 2 } }], sheets: {
      rare: { totalWeight: 3, cards: [
        { id: "base", duplicateKey: "Same card", slot: "W", value: 100 },
        { id: "showcase", duplicateKey: "Same card", slot: "W", value: 200 },
        { id: "other", slot: "U", value: 1 },
      ] },
    } }] };
    const result = simulateOutcomes(model, { seed: "identity", sampleCount: 100, remaining: ["W"] });
    expect(result.slotDistributions.W).toMatchObject({ min: 100, max: 200 });
    expect(result.slotDistributions.U).toMatchObject({ min: 1, max: 1, mean: 1 });
  });
  it("preserves every fixed Jumpstart card and repeated basic land", () => {
    const model: PackOutcomeModel = { fixed: [], packs: [{ count: 2, variants: [{ weight: 1, picks: { theme: 20 } }], sheets: {
      theme: { totalWeight: 20, fixed: true, cards: [
        { id: "land", slot: "L", value: 1, weight: 8 },
        { id: "common", slot: "W", value: 2, weight: 11 },
        { id: "rare", slot: "W", value: 20, weight: 1 },
      ] },
    } }] };
    const result = simulateOutcomes(model, { seed: "fixed-theme", sampleCount: 50, remaining: ["W"] });
    expect(result.slotDistributions.W).toMatchObject({ min: 84, max: 84, mean: 84 });
    expect(result.slotDistributions.L).toMatchObject({ min: 16, max: 16, mean: 16 });
  });
  it("uses collation color independently of the break's land assignment", () => {
    const model = pack(5, 5);
    model.packs[0].sheets.common.cards = model.packs[0].sheets.common.cards.filter((card) => card.slot !== "G");
    model.packs[0].sheets.common.cards.push({ id: "green-land", color: "G", slot: "L", value: 2 });
    expect(possibleSlotBounds(model).L.min).toBe(2);
    expect(simulateOutcomes(model, { seed: "front-color", sampleCount: 10, remaining: ["L"] }).remainingPool.mean).toBe(2);
  });
});
