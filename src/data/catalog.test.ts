import { afterAll, describe, expect, it, vi } from "vitest";
import { catalogSets } from "./catalog";

describe("catalog set coverage", () => {
  it("includes exact historical sealed documents even when the legacy TCG catalog lacks them", async () => {
    vi.stubGlobal("fetch", async (input: string | URL | Request) => {
      const url = String(input);
      if (url.endsWith("data/products.json")) return new Response(JSON.stringify({
        sets: { TLA: { name: "Avatar", released: "2025-01-01", groupId: 1, products: [] } },
      }));
      if (url.endsWith("data/sealed/index.json")) return new Response(JSON.stringify({
        sets: ["GRN"], documents: [{ code: "GRN", name: "Guilds of Ravnica", released: "2018-10-05", products: 23 }],
      }));
      return new Response("not found", { status: 404 });
    });
    const sets = await catalogSets();
    expect(sets.map((set) => set.code).sort()).toEqual(["GRN", "TLA"]);
  });
});

afterAll(() => vi.unstubAllGlobals());
