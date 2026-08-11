import { describe, expect, it } from "vitest";
import { applySealedContentOverrides } from "../tools/sealed-content-overrides.mjs";

const overlay = {
  version: 1,
  verifiedAt: "2026-08-11",
  claims: {
    lands: {
      evidenceLevel: "official-verified",
      retrievedAt: "2026-08-11",
      sources: ["https://example.test/official"],
      note: "fixture",
      removeOther: ["20 foil lands"],
      fixed: [{ set: "ABC", cn: "1", n: 4, foil: true, finish: "foil" }],
      unresolved: [{ label: "unknown lands", n: 2, finish: "foil", reason: "fixture" }],
    },
    promo: {
      evidenceLevel: "official-verified",
      retrievedAt: "2026-08-11",
      sources: ["https://example.test/promo"],
      note: "fixture",
      fixed: [{ set: "XYZ", cn: "2", n: 1, foil: false, finish: "nonfoil" }],
    },
  },
  products: {
    "ABC/bundle-case": { claims: ["lands", "promo"], multiplier: 6 },
  },
};

describe("sealed content research overlays", () => {
  it("multiplies case contents, removes resolved prose, and retains evidence", () => {
    const document = {
      set: "ABC",
      src: {},
      products: [{ key: "bundle-case", other: ["20 foil lands", "Spindown"] }],
    };
    applySealedContentOverrides(document, overlay);
    expect(document.products[0].fixed).toEqual([
      { set: "ABC", cn: "1", n: 24, foil: true, finish: "foil" },
      { set: "XYZ", cn: "2", n: 6, foil: false, finish: "nonfoil" },
    ]);
    expect(document.products[0].other).toEqual(["Spindown"]);
    expect(document.products[0].evidence).toHaveLength(2);
    expect(document.products[0].unresolvedContents).toEqual([
      { label: "unknown lands", n: 12, finish: "foil", reason: "fixture", claim: "lands" },
    ]);
    expect(document.src.researchOverlay.claims).toEqual(["lands", "promo"]);
  });
});
