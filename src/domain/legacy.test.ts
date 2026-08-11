import { describe, expect, it } from "vitest";
import { decodeComposition, decodeLegacySearch, encodeComposition } from "./legacy";

describe("legacy composition migration", () => {
  it("decodes shared multi-product links", () => {
    const lines = decodeComposition("EOE.play-box.2~TDM.collector-pack.1");
    expect(lines.map(({ set, productKey, quantity }) => ({ set, productKey, quantity }))).toEqual([
      { set: "EOE", productKey: "play-box", quantity: 2 },
      { set: "TDM", productKey: "collector-pack", quantity: 1 },
    ]);
  });

  it("decodes v2 single-set links", () => {
    expect(decodeLegacySearch("?set=eoe&preset=collector")[0]).toMatchObject({ set: "EOE", productKey: "collector-box" });
  });

  it("round-trips the public composition contract", () => {
    const lines = decodeComposition("EOE.play-box.2");
    expect(encodeComposition(lines)).toBe("EOE.play-box.2");
  });
});
