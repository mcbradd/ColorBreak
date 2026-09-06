// @vitest-environment node
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { evaluateBreakAnalysis } from "./evaluate";
import { possibleSlotBounds, simulateOutcomes } from "../domain/simulation";
import { outcomeModelForProduct } from "./outcome-model";
import { expectedDraws, type SealedDocument } from "./sealed";
import { resolveCollation } from "./collation-policy";

function files() {
  vi.stubGlobal("fetch", async (input: string | URL | Request) => {
    try { return new Response(readFileSync(String(input).replace(/^\.\//, ""))); }
    catch { return new Response("unavailable", { status: 404 }); }
  });
}
afterEach(() => vi.unstubAllGlobals());
describe("product collation through real evaluation", () => {
  it("retains Dominaria's physical pack slots instead of replacing them with independent draws", async () => {
    files();
    const analysis = await evaluateBreakAnalysis([{ id: "dom", set: "DOM", productKey: "sealed:booster-pack", productLabel: "Draft Booster", quantity: 1 }], 0);
    expect(analysis.outcomeModel.packs[0].sheets.common.minColors).toBe(5);
    expect(analysis.outcomeModel.packs[0].sheets.estimated).toBeUndefined();
    const bounds = possibleSlotBounds(analysis.outcomeModel);
    for (const color of ["W", "U", "B", "R", "G"] as const) expect(bounds[color].min).toBeGreaterThan(0);
    expect(bounds.L.min).toBeGreaterThan(0);
  });
  it("includes cross-set Expedition toppers in Zendikar boxes and scales their case counts", async () => {
    files();
    for (const [productKey, expected] of [["collector-booster-box", 2], ["collector-booster-box-case", 12]] as const) {
      const document = JSON.parse(readFileSync("data/sealed/ZNR.json", "utf8")) as SealedDocument;
      const draws = await expectedDraws(document, productKey, 1);
      expect(draws.draws.filter((draw) => draw.source.includes("ZNE:box-topper")).reduce((sum, draw) => sum + draw.copies, 0)).toBeCloseTo(expected);
      expect(draws.omissions.some((row) => row.code === "missing-booster")).toBe(false);
    }
  });
  it("keeps a guaranteed known card and pack count when a price is missing", async () => {
    files();
    const document: SealedDocument = { v: 2, set: "TST", name: "Test", released: "2020-01-01", src: { mtgjson: "test", mtgjsonDate: "test", builtAt: "test" },
      products: [{ key: "pack", label: "Pack", name: "Pack", category: "booster_pack", packs: { draft: 1 }, fixed: [{ set: "TST", cn: "1", n: 1, foil: false }] }],
      boosters: { draft: { picks: { land: 1 }, variants: [{ weight: 1, picks: { land: 1 } }], sheets: { land: { foil: false, total: 2, cards: [["2", 1], ["3", 1]] } } } },
    };
    const result = await outcomeModelForProduct(document, "pack", 2, [{ id: "fixed", set: "TST", collectorNumber: "1", name: "Fixed", slot: "W", nonfoil: 4, foil: null }], 0);
    expect(result.model.complete).toBe(false);
    expect(result.model.packs[0].count).toBe(2);
    expect(result.model.packs[0].sheets.land.cards.reduce((sum, card) => sum + (card.weight ?? 1), 0)).toBe(2);
    expect(simulateOutcomes(result.model, { seed: "missing", sampleCount: 20, remaining: ["W"] }).remainingPool).toMatchObject({ min: 8, max: 8, mean: 8 });
  });
  it("applies official insert rates identically to fast EV and opening variants", async () => {
    files();
    for (const [set, sheet, probability] of [["MKM", "theList", .125], ["DSK", "specialGuest", 1 / 64], ["EOE", "specialGuest", .018], ["FIN", "throughTheAges", 1 / 3]] as const) {
      const document = JSON.parse(readFileSync(`data/sealed/${set}.json`, "utf8")) as SealedDocument;
      const match = resolveCollation(set, "play", document.boosters.play, `${set}/play-booster-pack`);
      expect(match.recipe.picks[sheet]).toBeCloseTo(probability, 9);
      const draws = await expectedDraws(document, "play-booster-pack", 2);
      const copies = draws.draws.filter((draw) => draw.source.endsWith(`/${sheet}`)).reduce((sum, draw) => sum + draw.copies, 0);
      expect(copies).toBeCloseTo(probability * 2, 7);
    }
  });
});
