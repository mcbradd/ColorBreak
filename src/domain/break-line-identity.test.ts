import { describe, expect, it } from "vitest";
import {
  breakLineKey,
  breakLineKeyForChoice,
  findBreakLineForChoice,
  mergeBreakLines,
  productKeyForChoice,
} from "./break-line-identity";
import type { BreakLine, ProductChoice } from "./types";

const choice = (set: string, key: string): ProductChoice => ({
  key, sealedKey: key, label: "Play Booster Pack", set, setName: set,
  category: "pack", packCount: 1, status: "verified",
});
const line = (id: string, set: string, productKey: string, quantity: number): BreakLine =>
  ({ id, set, productKey, productLabel: "Play Booster Pack", quantity, packCount: 1 });

describe("break line identity", () => {
  it("keeps the same sealed key in two sets apart", () => {
    // MSH and EOE both publish `play-booster-pack`; sealed keys are unique
    // within a set document only.
    expect(breakLineKeyForChoice(choice("MSH", "play-booster-pack")))
      .not.toBe(breakLineKeyForChoice(choice("EOE", "play-booster-pack")));
  });

  it("treats set casing and padding as the same line", () => {
    expect(breakLineKey({ set: " msh ", productKey: " sealed:play-booster-pack " }))
      .toBe(breakLineKey({ set: "MSH", productKey: "sealed:play-booster-pack" }));
  });

  it("prefixes sealed keys and passes catalog keys through", () => {
    expect(productKeyForChoice({ key: "x", sealedKey: "play-booster-pack" })).toBe("sealed:play-booster-pack");
    expect(productKeyForChoice({ key: "play-box" })).toBe("play-box");
  });

  it("finds only the line belonging to the product's own set", () => {
    const lines = [
      line("msh", "MSH", "sealed:play-booster-pack", 3),
      line("eoe", "EOE", "sealed:play-booster-pack", 1),
    ];
    expect(findBreakLineForChoice(lines, choice("EOE", "play-booster-pack"))?.id).toBe("eoe");
    expect(findBreakLineForChoice(lines, choice("MSH", "play-booster-pack"))?.id).toBe("msh");
    expect(findBreakLineForChoice(lines, choice("SPM", "play-booster-pack"))).toBeUndefined();
  });

  it("never merges the same product from different sets", () => {
    const merged = mergeBreakLines([
      line("a", "MSH", "sealed:play-booster-pack", 3),
      line("b", "EOE", "sealed:play-booster-pack", 1),
      line("c", "msh", "sealed:play-booster-pack", 2),
    ]);
    expect(merged.map((row) => [row.set, row.quantity])).toEqual([["MSH", 5], ["EOE", 1]]);
  });
});
