import { describe, expect, it } from "vitest";
import { canonicalComposition, canonicalCompositionFingerprint } from "./canonical-composition";

describe("canonical composition", () => {
  const first = { id: "ui-a", set: "eoe", productKey: "play-box", productLabel: "Play", quantity: 2, packCount: 14 };
  const second = { id: "ui-b", set: "TDM", productKey: "collector-box", productLabel: "Collector", quantity: 1, packCount: 12 };

  it("is stable across UI order and non-material labels", () => {
    expect(canonicalCompositionFingerprint([first, second])).toBe(canonicalCompositionFingerprint([
      { ...second, id: "other" }, { ...first, productLabel: "renamed" },
    ]));
    expect(canonicalComposition([first])).toEqual([{ set: "EOE", productKey: "play-box", quantity: 2, packCount: 14 }]);
  });

  it("changes for a material product, quantity, or pack-count change", () => {
    const baseline = canonicalCompositionFingerprint([first]);
    expect(canonicalCompositionFingerprint([{ ...first, productKey: "collector-box" }])).not.toBe(baseline);
    expect(canonicalCompositionFingerprint([{ ...first, quantity: 3 }])).not.toBe(baseline);
    expect(canonicalCompositionFingerprint([{ ...first, packCount: 12 }])).not.toBe(baseline);
  });
});
