import { describe, expect, it, vi } from "vitest";
import { classifyContentProse, type ContentClassification } from "./content-classifier.mjs";
import { expectedDraws, type SealedDocument } from "./sealed";
import { outcomeModelForProduct } from "./outcome-model";
import { summarizeCoverage } from "../../tools/report-coverage.mjs";

const cases: Array<[string, ContentClassification]> = [
  ["First Game Walk-Through Cards", "approved-accessory"],
  ["6 Art only Scene Cards", "approved-accessory"],
  ["1 Card-storage box", "approved-accessory"],
  ["Max Speed Helper Card", "approved-accessory"],
  ["1 Box Topper Card", "cardlike-unresolved"],
  ["Collector display stand", "not-cardlike"],
];

function documentWith(other: string): SealedDocument {
  return {
    v: 2,
    set: "TST",
    name: "Test Set",
    released: "2026-01-01",
    src: { mtgjson: "test", mtgjsonDate: "2026-01-01", builtAt: "2026-01-01" },
    products: [{
      key: "product",
      label: "Product",
      name: "Product",
      category: "specialty",
      packs: {},
      fixed: [{ set: "TST", cn: "1", n: 1, foil: false }],
      other: [other],
    }],
    boosters: {},
  };
}

describe("canonical sealed content classifier", () => {
  it.each(cases)("classifies %s as %s", (text, expected) => {
    expect(classifyContentProse(text)).toBe(expected);
  });

  it.each(cases)("keeps valuation, outcome, and coverage aligned for %s", async (text, classification) => {
    vi.stubGlobal("fetch", async () => new Response(JSON.stringify({ version: 1, verifiedAt: "now", products: {} })));
    const document = documentWith(text);
    const draws = await expectedDraws(document, "product", 1, { TST: document });
    const outcome = await outcomeModelForProduct(document, "product", 1, [{
      id: "test-card", set: "TST", collectorNumber: "1", name: "Test Card", slot: "W", nonfoil: 1, foil: null,
    }], 2, { TST: document });
    const coverage = summarizeCoverage([document], { products: {} });
    const unresolved = classification === "cardlike-unresolved";

    expect(draws.omissions.some((item) => item.code === "prose-only-contents")).toBe(unresolved);
    expect(outcome.omissions.some((item) => item.code === "prose-only-contents")).toBe(unresolved);
    expect(coverage.reasons["prose-only-contents"] ?? 0).toBe(unresolved ? 1 : 0);
    vi.unstubAllGlobals();
  });
});
