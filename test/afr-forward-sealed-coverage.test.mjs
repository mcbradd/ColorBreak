import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (name) => JSON.parse(readFileSync(resolve(process.cwd(), "data", "sealed", `${name}.json`), "utf8"));
const readData = (name) => JSON.parse(readFileSync(resolve(process.cwd(), "data", name), "utf8"));
const product = (document, key) => document.products.find((candidate) => candidate.key === key);
const sum = (items) => (items ?? []).reduce((total, item) => total + item.n, 0);

describe("AFR-forward sealed content", () => {
  it("stores exact sourced DSK and HOB fixed contents at unit and case multiplicity", () => {
    const dsk = read("DSK");
    expect(sum(product(dsk, "nightmare-bundle").fixed)).toBe(20);
    expect(sum(product(dsk, "nightmare-bundle-case").fixed)).toBe(120);

    const hob = read("HOB");
    expect(sum(product(hob, "scene-box-crack-the-plates").fixed)).toBe(6);
    expect(sum(product(hob, "scene-box-treasures-of-smaug").fixed)).toBe(6);
    expect(sum(product(hob, "scene-box-set-of-2").fixed)).toBe(12);
    expect(sum(product(hob, "scene-box-case").fixed)).toBe(24);
  });

  it("stores known land quantities but does not invent unsupported printings", () => {
    const dft = read("DFT");
    expect(sum(product(dft, "finish-line-bundle").fixed)).toBe(8); // 3 promos + 5 verified first-place lands
    expect(sum(product(dft, "finish-line-bundle").unresolvedContents)).toBe(15);
    expect(sum(product(dft, "finish-line-bundle-case").unresolvedContents)).toBe(90);

    for (const [set, keys] of Object.entries({
      ECL: ["draft-night", "draft-night-case"],
      TMT: ["draft-night", "draft-night-case"],
      SOS: ["codex-bundle", "codex-bundle-case", "draft-night", "draft-night-case"],
      HOB: ["draft-night", "draft-night-case"],
    })) {
      const document = read(set);
      for (const key of keys) expect(product(document, key).unresolvedContents?.length).toBeGreaterThan(0);
    }
  });

  it("pins MTGJSON checksums and applied research provenance", () => {
    const document = read("DSK");
    expect(document.src.mtgjsonSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(document.src.researchOverlay).toMatchObject({ version: 1, verifiedAt: "2026-08-11" });
    expect(product(document, "nightmare-bundle").evidence[0].sources[0]).toMatch(/^https:\/\//);
  });

  it("resolves globally referenced deck UUIDs to exact 60-card printings", () => {
    const index = readData("deck-card-index.json");
    expect(Object.keys(index.cards).length).toBeGreaterThan(1_000);
    expect(index.sourceDocuments.every((source) => /^[a-f0-9]{64}$/.test(source.sha256))).toBe(true);
    for (const [set, keys] of Object.entries({
      ECL: ["60-card-theme-deck-angels", "60-card-theme-deck-pirates"],
      SOS: ["60-card-theme-deck-eerie", "60-card-theme-deck-lifegain"],
    })) {
      const document = read(set);
      for (const key of keys) expect(sum(product(document, key).fixed)).toBe(60);
    }
  });
});
