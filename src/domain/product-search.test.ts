import { describe, expect, it } from "vitest";
import { matchingProducts, rankSearchSets, suggestedSearchSets, type ProductSearchSet } from "./product-search";
import type { ProductChoice } from "./types";

const set = (code: string, name: string, released = "2025-01-01"): ProductSearchSet => ({ code, name, released, type: "catalog", hasSealed: true, products: [] });
const sets = [set("FIN", "Final Fantasy"), set("EOE", "Edge of Eternities"), set("MSH", "Marvel Super Heroes"), set("DSK", "Duskmourn: House of Horror"), set("TRK", "Star Trek", "2099-01-01")];
const product = (set: string, setName: string, label: string, category: ProductChoice["category"] = "box"): ProductChoice => ({ key: label, set, setName, label, category, packCount: 1, status: "estimated" });

describe("combined product search", () => {
  it("narrows partial set names plus product terms without requiring a set-selection screen", () => {
    expect(rankSearchSets(sets, "final fant col box")[0].code).toBe("FIN");
    expect(rankSearchSets(sets, "dusk play")[0].code).toBe("DSK");
    expect(rankSearchSets(sets, "collector FIN")[0].code).toBe("FIN");
    expect(rankSearchSets(sets, "fin chocobo")[0].code).toBe("FIN");
    expect(rankSearchSets(sets, "Final Fantasy Chocobo Track Collector Booster Box")[0].code).toBe("FIN");
    expect(rankSearchSets(sets, "no-such-set")).toEqual([]);
  });

  it("matches product and set identity together and supports display/box and plural aliases", () => {
    const products = [product("FIN", "Final Fantasy", "Collector Booster Display"), product("FIN", "Final Fantasy", "Play Booster Box"), product("EOE", "Edge of Eternities", "Collector Booster Box")];
    expect(matchingProducts(products, "fin collector boxes")).toEqual([products[0]]);
    expect(matchingProducts(products, "final fan col")).toEqual([products[0]]);
    expect(matchingProducts(products, "eoe collector")).toEqual([products[2]]);
  });

  it("bounds set document requests and prefers released sets for general searches", () => {
    expect(rankSearchSets(sets, "collector box", 2)).toHaveLength(2);
    expect(rankSearchSets(sets, "collector box", 2).some((row) => row.code === "TRK")).toBe(false);
    expect(rankSearchSets(sets, "TRK collector")[0].code).toBe("TRK");
    expect(suggestedSearchSets(sets, ["FIN", "EOE", "FIN"], "2026-01-01").map((row) => row.code)).toEqual(["FIN", "EOE", "MSH", "DSK"]);
  });
});
