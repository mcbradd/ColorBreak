import { describe, expect, it } from "vitest";
import { createBreakShareUrl, decodeBuyerShare } from "./share-url";

describe("shared break URLs", () => {
  it("round-trips break contents, quantities, format, and buyer options", () => {
    const href = createBreakShareUrl("https://example.com/ColorBreak/#buyer", {
      lines: [
        { id: "one", set: "EOE", productKey: "sealed:play-booster-box", productLabel: "Play Booster Box", quantity: 2 },
        { id: "two", set: "TDM", productKey: "collector-pack", productLabel: "Collector Booster", quantity: 3 },
      ],
      assignmentMode: "random",
      targetSlots: ["G"],
      remaining: ["W", "U", "G"],
      bulkEnabled: false,
      bulkThreshold: 1.25,
      largeSpots: 150,
    });

    const url = new URL(href);
    const decoded = decodeBuyerShare(url.search);
    expect(decoded.lines.map(({ set, productKey, quantity }) => ({ set, productKey, quantity }))).toEqual([
      { set: "EOE", productKey: "sealed:play-booster-box", quantity: 2 },
      { set: "TDM", productKey: "collector-pack", quantity: 3 },
    ]);
    expect(decoded).toMatchObject({
      assignmentMode: "random",
      targetSlots: ["G"],
      remaining: ["W", "U", "G"],
      bulkEnabled: false,
      bulkThreshold: 1.25,
    });
  });

  it("round-trips multiple slots selected for bid preview", () => {
    const href = createBreakShareUrl("https://example.com/#buyer", {
      lines: [],
      assignmentMode: "random",
      targetSlots: ["C", "L"],
      remaining: ["W", "U", "B", "R", "G", "M", "C", "L"],
      bulkEnabled: true,
      bulkThreshold: 2,
      largeSpots: 120,
    });
    expect(decodeBuyerShare(new URL(href).search).targetSlots).toEqual(["C", "L"]);
    expect(new URL(href).searchParams.has("s")).toBe(false);
  });

  it("decodes a legacy single-letter slot link exactly like a one-item list", () => {
    const decoded = decodeBuyerShare("?m=pick&s=W&r=WUBRGMCL&f=1&t=2");
    expect(decoded.selectedSlots).toEqual(["W"]);
  });

  it("includes large-break spot count only for large mode", () => {
    const shared = new URL(createBreakShareUrl("https://example.com/#buyer", {
      lines: [], assignmentMode: "large", remaining: ["W"],
      bulkEnabled: true, bulkThreshold: 2, largeSpots: 175,
    }));
    expect(shared.searchParams.get("m")).toBe("large");
    expect(shared.searchParams.get("n")).toBe("175");
    expect(decodeBuyerShare(shared.search).largeSpots).toBe(175);
  });
});
