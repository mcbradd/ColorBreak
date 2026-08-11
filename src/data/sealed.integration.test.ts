// @vitest-environment node
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { expectedDraws, type SealedDocument } from "./sealed";

const dataDir = fileURLToPath(new URL("../../data/", import.meta.url));
const documents: Record<string, SealedDocument> = {};
for (const file of readdirSync(`${dataDir}/sealed`).filter((name) => name.endsWith(".json") && name !== "index.json")) {
  const document = JSON.parse(readFileSync(`${dataDir}/sealed/${file}`, "utf8")) as SealedDocument;
  documents[document.set] = document;
}

beforeAll(() => {
  vi.stubGlobal("fetch", async (input: string | URL | Request) => {
    const url = String(input);
    if (url.endsWith("data/corrections.json")) {
      return new Response(readFileSync(`${dataDir}/corrections.json`, "utf8"), { status: 200 });
    }
    const match = /data\/sealed\/([A-Z0-9]+)\.json$/.exec(url);
    if (match && documents[match[1]]) return new Response(JSON.stringify(documents[match[1]]), { status: 200 });
    return new Response("not found", { status: 404 });
  });
});
afterAll(() => vi.unstubAllGlobals());

describe("committed sealed corpus", () => {
  it("expands every card-bearing product or reports why it cannot", async () => {
    let count = 0;
    for (const document of Object.values(documents)) {
      for (const product of document.products) {
        count += 1;
        const result = await expectedDraws(document, product.key, 1, documents);
        expect(result.draws.every((draw) => Number.isFinite(draw.copies) && draw.copies >= 0)).toBe(true);
        const accessoryOnly = !Object.keys(product.packs).length && !product.fixed?.length;
        expect(result.draws.length > 0 || result.omissions.length > 0 || accessoryOnly).toBe(true);
      }
    }
    expect(count).toBeGreaterThan(700);
  });

  it("applies the sourced Hobbit box toppers", async () => {
    for (const key of ["play-booster-box", "collector-booster-box"]) {
      const result = await expectedDraws(documents.HOB, key, 1, documents);
      expect(result.status).toBe("verified");
      expect(result.draws.some((draw) => draw.source.includes("box-topper"))).toBe(true);
      expect(result.sources.some((source) => source.includes("magic.wizards.com"))).toBe(true);
    }
  });

  it("does not double-count the Hobbit bundle pseudo-pack", async () => {
    for (const key of ["bundle", "gift-bundle", "bundle-case", "gift-bundle-case"]) {
      const result = await expectedDraws(documents.HOB, key, 1, documents);
      expect(result.omissions.some((item) => item.message.includes("bundle-promo"))).toBe(false);
      expect(result.status).toBe("verified");
    }
  });
});
