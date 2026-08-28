import { afterEach, describe, expect, it, vi } from "vitest";
import { clearPriceCache, loadPrices } from "./scryfall";

const card = {
  id: "one-1",
  set: "one",
  collector_number: "1",
  name: "Against All Odds",
  rarity: "uncommon",
  type_line: "Sorcery",
  colors: ["W"],
  prices: { usd: "0.12", usd_foil: "0.25", usd_etched: null },
  image_uris: { normal: "https://cards.scryfall.io/normal/test.jpg" },
  frame_effects: ["showcase"],
};

afterEach(() => {
  vi.unstubAllGlobals();
  clearPriceCache();
});

describe("exact-printing price module", () => {
  it("loads a compact published shard without calling the live card endpoints", async () => {
    const calls: string[] = [];
    const observedAt = new Date().toISOString();
    vi.stubGlobal("fetch", async (input: string | URL | Request) => {
      const url = String(input);
      calls.push(url);
      if (url === "data/prices/index.json") return new Response(JSON.stringify({
        schemaVersion: 1, provider: "Scryfall", observedAt, generatedAt: observedAt,
        sets: { ONE: { file: "ONE.json", cards: 1, sha256: "test" } },
      }));
      if (url === "data/prices/ONE.json") return new Response(JSON.stringify({
        schemaVersion: 1, set: "ONE", provider: "Scryfall", observedAt, generatedAt: observedAt, cards: [card],
      }));
      throw new Error(`unexpected live request: ${url}`);
    });

    const result = await loadPrices({
      sets: ["ONE"], printings: [{ set: "ONE", collectorNumber: "1" }],
    });
    expect(result.cards).toHaveLength(1);
    expect(result.cards[0]).toMatchObject({ set: "ONE", collectorNumber: "1", treatment: "Showcase", nonfoil: 0.12, foil: 0.25 });
    expect(result.availability).toMatchObject({ status: "available", source: "snapshot" });
    expect(result.omissions).toEqual([]);
    expect(calls).toEqual(["data/prices/index.json", "data/prices/ONE.json"]);
  });

  it("retains an exact TCG listing when a new printing has no market observation", async () => {
    const observedAt = new Date().toISOString();
    const newReleaseCard = {
      ...card,
      prices: { usd: null, usd_foil: null, usd_etched: null },
      tcgplayer: { prices: { foil: { market: null, listed: 19.21 } } },
    };
    vi.stubGlobal("fetch", async (input: string | URL | Request) => {
      const url = String(input);
      if (url === "data/prices/index.json") return new Response(JSON.stringify({
        schemaVersion: 1, provider: "Scryfall", observedAt, generatedAt: observedAt,
        sets: { ONE: { file: "ONE.json", cards: 1, sha256: "test" } },
      }));
      if (url === "data/prices/ONE.json") return new Response(JSON.stringify({
        schemaVersion: 1, set: "ONE", provider: "Scryfall", observedAt, generatedAt: observedAt, cards: [newReleaseCard],
      }));
      throw new Error(`unexpected request: ${url}`);
    });

    const result = await loadPrices({ sets: ["ONE"], printings: [{ set: "ONE", collectorNumber: "1" }] });

    expect(result.cards[0]).toMatchObject({
      foil: null,
      listedPrices: { foil: 19.21 },
    });
  });

  it("turns a live rate limit into an availability state and retries cleanly on the next calculation", async () => {
    let searches = 0;
    vi.stubGlobal("fetch", async (input: string | URL | Request) => {
      const url = String(input);
      if (url === "data/prices/index.json") return new Response("missing", { status: 404 });
      if (url.includes("api.scryfall.com/cards/search")) {
        searches += 1;
        if (searches === 1) return new Response("rate limited", { status: 429 });
        return new Response(JSON.stringify({ data: [card], has_more: false }));
      }
      throw new Error(`unexpected request: ${url}`);
    });

    const unavailable = await loadPrices({ sets: ["ONE"], fullSets: ["ONE"] });
    expect(unavailable.availability.status).toBe("unavailable");
    expect(unavailable.omissions[0].code).toBe("price-source-unavailable");

    await Promise.resolve();
    const recovered = await loadPrices({ sets: ["ONE"], fullSets: ["ONE"] });
    expect(recovered.cards).toHaveLength(1);
    expect(recovered.availability).toMatchObject({ status: "available", source: "live" });
    expect(searches).toBe(2);
  });

  it("uses an exact batched lookup only for a printing absent from the snapshot", async () => {
    const requests: Array<{ url: string; method?: string }> = [];
    const observedAt = new Date().toISOString();
    vi.stubGlobal("fetch", async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      requests.push({ url, method: init?.method });
      if (url === "data/prices/index.json") return new Response(JSON.stringify({
        schemaVersion: 1, provider: "Scryfall", observedAt, generatedAt: observedAt,
        sets: { ONE: { file: "ONE.json", cards: 0, sha256: "test" } },
      }));
      if (url === "data/prices/ONE.json") return new Response(JSON.stringify({
        schemaVersion: 1, set: "ONE", provider: "Scryfall", observedAt, generatedAt: observedAt, cards: [],
      }));
      if (url.endsWith("/cards/collection")) return new Response(JSON.stringify({ data: [card], not_found: [] }));
      throw new Error(`unexpected request: ${url}`);
    });

    const result = await loadPrices({ sets: ["ONE"], printings: [{ set: "ONE", collectorNumber: "1" }] });
    expect(result.cards).toHaveLength(1);
    expect(result.availability.source).toBe("mixed");
    expect(requests.at(-1)).toEqual({ url: "https://api.scryfall.com/cards/collection", method: "POST" });
  });
});
