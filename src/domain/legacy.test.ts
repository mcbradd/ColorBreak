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

describe("shared composition identity", () => {
  it("keeps the same product key in two sets as two lines", () => {
    const lines = decodeComposition("MSH.sealed:play-booster-pack.3~EOE.sealed:play-booster-pack.1");
    expect(lines.map((line) => [line.set, line.productKey, line.quantity])).toEqual([
      ["MSH", "sealed:play-booster-pack", 3],
      ["EOE", "sealed:play-booster-pack", 1],
    ]);
  });

  it("folds a repeated set-and-product into one line the picker can fully edit", () => {
    const lines = decodeComposition("MSH.sealed:play-booster-pack.2~MSH.sealed:play-booster-pack.1");
    expect(lines.map((line) => [line.set, line.quantity])).toEqual([["MSH", 3]]);
  });
});
