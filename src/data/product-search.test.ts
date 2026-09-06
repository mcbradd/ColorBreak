import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => vi.unstubAllGlobals());

const catalog = { sets: { FIN: { name: "Final Fantasy", released: "2025-06-13", products: [{ id: 123, key: "collector-box", label: "Collector Booster Box", packs: 12, unit: "box" }] } } };
const index = { documents: [{ code: "FIN", name: "Final Fantasy", released: "2025-06-13" }, { code: "EOE", name: "Edge of Eternities", released: "2025-08-01" }] };
const sealed = { set: "FIN", name: "Final Fantasy", released: "2025-06-13", products: [{ key: "collector-booster-box", label: "Collector Booster Box", category: "booster_box", packs: { collector: 12 }, tcgId: 123 }], boosters: {} };

describe("identity-only product catalog", () => {
  it("loads just metadata initially, then exact identity for the requested set without valuation assets", async () => {
    vi.resetModules();
    const fetcher = vi.fn(async (url: string) => {
      if (url === "data/products.json") return new Response(JSON.stringify(catalog));
      if (url === "data/sealed/index.json") return new Response(JSON.stringify(index));
      if (url === "data/sealed/FIN.json") return new Response(JSON.stringify(sealed));
      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal("fetch", fetcher);
    const { loadProductSearchIndex, quickProductsForSet } = await import("./product-search");
    const sets = await loadProductSearchIndex();
    expect(sets.map((set) => set.code)).toEqual(["FIN", "EOE"]);
    expect(fetcher).toHaveBeenCalledTimes(2);
    const choices = await quickProductsForSet(sets[0]);
    expect(choices[0]).toMatchObject({ key: "collector-booster-box", sealedKey: "collector-booster-box", packCount: 12, tcgId: 123 });
    expect(fetcher.mock.calls.map(([url]) => url)).toEqual(["data/products.json", "data/sealed/index.json", "data/sealed/FIN.json"]);
    await quickProductsForSet(sets[0]);
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it("retries failed indexes and exact documents instead of retaining failed promises or changing identity", async () => {
    vi.resetModules();
    let catalogFailures = 1;
    let sealedFailures = 1;
    const fetcher = vi.fn(async (url: string) => {
      if (url === "data/products.json") return catalogFailures-- > 0 ? new Response("offline", { status: 503 }) : new Response(JSON.stringify(catalog));
      if (url === "data/sealed/index.json") return new Response(JSON.stringify(index));
      if (url === "data/sealed/FIN.json") return sealedFailures-- > 0 ? new Response("offline", { status: 404 }) : new Response(JSON.stringify(sealed));
      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal("fetch", fetcher);
    const { loadProductSearchIndex, quickProductsForSet } = await import("./product-search");
    await expect(loadProductSearchIndex()).rejects.toThrow("503");
    const sets = await loadProductSearchIndex();
    await expect(quickProductsForSet(sets[0])).rejects.toThrow("404");
    expect((await quickProductsForSet(sets[0]))[0].sealedKey).toBe("collector-booster-box");
    expect(fetcher.mock.calls.filter(([url]) => url === "data/sealed/FIN.json")).toHaveLength(2);
  });
});
