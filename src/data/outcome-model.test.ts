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

  it("keeps a very rare unpriced finish in the model as a disclosed zero-value lower bound", async () => {
    vi.stubGlobal("fetch", async () => new Response(JSON.stringify({ version: 1, verifiedAt: "now", products: {} })));
    const rareFinishDocument = {
      ...document,
      products: [{ key: "pack", label: "Pack", name: "Pack", category: "booster_pack", packs: { collector: 1 } }],
      boosters: {
        collector: {
          picks: { showcase: 1 },
          variants: [{ weight: 1, picks: { showcase: 1 } }],
          sheets: { showcase: { foil: true, total: 1_000, cards: [["1", 1], ["2", 999]] } },
        },
      },
    } as SealedDocument;
    const finishPrices: CardPrice[] = [
      { ...prices[0], foil: null, prices: { nonfoil: 10, foil: null } },
      { ...prices[1], foil: 20, prices: { nonfoil: 20, foil: 20 } },
    ];

    const result = await outcomeModelForProduct(rareFinishDocument, "pack", 1, finishPrices, 2);

    expect(result.model.complete).toBe(true);
    expect(result.model.packs[0].sheets.showcase.cards).toHaveLength(2);
    expect(result.model.packs[0].sheets.showcase.cards.find((card) => card.id.startsWith("one:"))?.value).toBe(0);
    expect(result.omissions).toContainEqual(expect.objectContaining({
      code: "missing-foil-price",
      material: false,
      expectedCards: 0.001,
    }));
    vi.unstubAllGlobals();
  });

  it("removes serialized sheets from buyer outcome ranges", async () => {
    vi.stubGlobal("fetch", async () => new Response(JSON.stringify({ version: 1, verifiedAt: "now", products: {} })));
    const serializedDocument = {
      ...document,
      products: [{ key: "pack", label: "Pack", name: "Pack", category: "booster_pack", packs: { collector: 1 } }],
      boosters: {
        collector: {
          picks: { serialized: 1 },
          variants: [{ weight: 1, picks: { serialized: 1 } }],
          sheets: { serialized: { foil: true, finish: "serialized", total: 1, cards: [["1", 1]] } },
        },
      },
    } as SealedDocument;
    const result = await outcomeModelForProduct(serializedDocument, "pack", 1, [{
      ...prices[0], prices: { serialized: 50_000 },
    }], 2);
    expect(result.model.complete).toBe(true);
    expect(result.model.packs[0].sheets.serialized.cards[0].value).toBe(0);
    expect(result.omissions).toContainEqual(expect.objectContaining({
      code: "collector-outlier-excluded",
      material: false,
    }));
    vi.unstubAllGlobals();
  });
});
