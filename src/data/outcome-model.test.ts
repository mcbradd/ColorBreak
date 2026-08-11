import { describe, expect, it, vi } from "vitest";
import { outcomeModelForProduct } from "./outcome-model";
import type { SealedDocument } from "./sealed";
import type { CardPrice } from "../domain/types";

const document = {
  v: 2,
  set: "TST",
  name: "Test Set",
  released: "2026-01-01",
  src: { mtgjson: "test", mtgjsonDate: "2026-01-01", builtAt: "2026-01-01" },
  products: [{ key: "box", label: "Box", name: "Box", category: "booster_box", packs: { play: 2 } }],
  boosters: {
    play: {
      picks: { rare: 1 },
      variants: [{ weight: 3, picks: { rare: 1 } }, { weight: 1, picks: { rare: 2 } }],
      sheets: { rare: { foil: false, total: 2, cards: [["1", 1], ["2", 1]] } },
    },
  },
} as SealedDocument;

const prices: CardPrice[] = [
  { id: "one", set: "TST", collectorNumber: "1", name: "One", slot: "W", nonfoil: 10, foil: null },
  { id: "two", set: "TST", collectorNumber: "2", name: "Two", slot: "U", nonfoil: 20, foil: null },
];

describe("sealed product outcome model", () => {
  it("preserves pack count, weighted variants, and exact priced sheet cards", async () => {
    vi.stubGlobal("fetch", async () => new Response(JSON.stringify({ version: 1, verifiedAt: "now", products: {} })));
    const result = await outcomeModelForProduct(document, "box", 1, prices, 2);
    expect(result.model.complete).toBe(true);
    expect(result.model.packs[0].count).toBe(2);
    expect(result.model.packs[0].variants).toEqual(document.boosters.play.variants);
    expect(result.model.packs[0].sheets.rare.cards.map((card) => card.value)).toEqual([10, 20]);
    vi.unstubAllGlobals();
  });

  it("blocks simulation when an exact printing price is missing", async () => {
    vi.stubGlobal("fetch", async () => new Response(JSON.stringify({ version: 1, verifiedAt: "now", products: {} })));
    const result = await outcomeModelForProduct(document, "box", 1, prices.slice(0, 1), 2);
    expect(result.model.complete).toBe(false);
    expect(result.omissions.some((omission) => omission.code === "missing-printing")).toBe(true);
    vi.unstubAllGlobals();
  });
});
