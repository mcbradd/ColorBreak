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
      selectedSlot: "G",
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
      selectedSlot: "G",
      remaining: ["W", "U", "G"],
      bulkEnabled: false,
      bulkThreshold: 1.25,
    });
  });

  it("includes large-break spot count only for large mode", () => {
    const shared = new URL(createBreakShareUrl("https://example.com/#buyer", {
      lines: [], assignmentMode: "large", selectedSlot: "W", remaining: ["W"],
      bulkEnabled: true, bulkThreshold: 2, largeSpots: 175,
    }));
    expect(shared.searchParams.get("m")).toBe("large");
    expect(shared.searchParams.get("n")).toBe("175");
    expect(decodeBuyerShare(shared.search).largeSpots).toBe(175);
  });
});
