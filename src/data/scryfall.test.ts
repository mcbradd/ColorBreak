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

  it("retains combined appearance metadata and an exact glossy listing", async () => {
    const observedAt = new Date().toISOString();
    const variantCard = {
      ...card,
      border_color: "borderless",
      promo_types: ["fracturefoil"],
      tcgplayer: { prices: { glossy: { market: null, listed: 12.34 } } },
    };
    vi.stubGlobal("fetch", async (input: string | URL | Request) => {
      const url = String(input);
      if (url === "data/prices/index.json") return new Response(JSON.stringify({
        schemaVersion: 1, provider: "Scryfall", observedAt, generatedAt: observedAt,
        sets: { ONE: { file: "ONE.json", cards: 1, sha256: "test" } },
      }));
      if (url === "data/prices/ONE.json") return new Response(JSON.stringify({
        schemaVersion: 1, set: "ONE", provider: "Scryfall", observedAt, generatedAt: observedAt, cards: [variantCard],
      }));
      throw new Error(`unexpected request: ${url}`);
    });

    const result = await loadPrices({ sets: ["ONE"], printings: [{ set: "ONE", collectorNumber: "1" }] });
    expect(result.cards[0]).toMatchObject({
      treatment: "Borderless",
      treatments: ["Borderless", "Showcase", "Fracture Foil"],
      treatmentMetadata: {
        rawFrameEffects: ["showcase"],
        rawPromoTypes: ["fracturefoil"],
        finishClasses: [],
        styleTags: ["showcase"],
        processTags: ["fracturefoil"],
        attributeTags: [],
        unknownTags: [],
        borderColor: "borderless",
        fullArt: false,
        textless: false,
      },
      listedPrices: { glossy: 12.34 },
    });
  });

  it("retains distinct face art and rules for a double-faced printing", async () => {
    const observedAt = new Date().toISOString();
    const doubleFacedCard = {
      ...card,
      layout: "modal_dfc",
      image_uris: undefined,
      oracle_text: undefined,
      card_faces: [
        { name: "Front", type_line: "Creature", oracle_text: "Front rules", image_uris: { normal: "https://cards.scryfall.io/front.jpg" } },
        { name: "Back", type_line: "Land", oracle_text: "Back rules", image_uris: { normal: "https://cards.scryfall.io/back.jpg" } },
      ],
    };
    vi.stubGlobal("fetch", async (input: string | URL | Request) => {
      const url = String(input);
      if (url === "data/prices/index.json") return new Response(JSON.stringify({
        schemaVersion: 1, provider: "Scryfall", observedAt, generatedAt: observedAt,
        sets: { ONE: { file: "ONE.json", cards: 1, sha256: "test" } },
      }));
      if (url === "data/prices/ONE.json") return new Response(JSON.stringify({
        schemaVersion: 1, set: "ONE", provider: "Scryfall", observedAt, generatedAt: observedAt, cards: [doubleFacedCard],
      }));
      throw new Error(`unexpected request: ${url}`);
    });

    const result = await loadPrices({ sets: ["ONE"], printings: [{ set: "ONE", collectorNumber: "1" }] });
    expect(result.cards[0]).toMatchObject({
      layout: "modal_dfc",
      image: "https://cards.scryfall.io/front.jpg",
      faces: [
        { name: "Front", oracleText: "Front rules", image: "https://cards.scryfall.io/front.jpg" },
        { name: "Back", oracleText: "Back rules", image: "https://cards.scryfall.io/back.jpg" },
      ],
    });
  });

  it("never turns a snapshot miss into a live request", async () => {
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

    expect(searches).toBe(0);
  });

  it("reports an exact-printing snapshot miss without a batched lookup", async () => {
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
    expect(result.cards).toHaveLength(0);
    expect(result.availability.source).toBe("snapshot");
    expect(result.omissions[0].code).toBe("price-source-unavailable");
    expect(requests.some((request) => request.url.includes("api.scryfall.com"))).toBe(false);
  });
});
