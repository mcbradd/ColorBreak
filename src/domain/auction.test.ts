import { describe, expect, it } from "vitest";
import { assignSlot, createAuction, markSlotsTaken, toggleSlotTaken, undoAssignment } from "./auction";

describe("remaining-slot auction", () => {
  it("removes one assigned slot per sale and can undo the latest assignment", () => {
    const initial = createAuction();

    const afterBlue = assignSlot(initial, "U");
    expect(afterBlue.remaining).toEqual(["W", "B", "R", "G", "M", "C", "L"]);
    expect(afterBlue.assignments).toEqual(["U"]);

    const restored = undoAssignment(afterBlue);
    expect(restored).toEqual(initial);
  });

  it("refuses to assign a slot that is no longer available", () => {
    const afterBlue = assignSlot(createAuction(), "U");
    expect(() => assignSlot(afterBlue, "U")).toThrow("Blue is no longer available");
  });

  it("toggles any color between available and taken while preserving slot order", () => {
    const withoutBlue = toggleSlotTaken(createAuction(), "U");
    const withoutBlueAndRed = toggleSlotTaken(withoutBlue, "R");

    expect(withoutBlueAndRed.remaining).toEqual(["W", "B", "G", "M", "C", "L"]);
    expect(toggleSlotTaken(withoutBlueAndRed, "U").remaining).toEqual([
      "W", "U", "B", "G", "M", "C", "L",
    ]);
  });

  it("keeps the final available color enabled", () => {
    const finalWhite = createAuction(["W"]);
    expect(toggleSlotTaken(finalWhite, "W")).toBe(finalWhite);
  });

  it("marks a combined lot of several slots taken as one atomic transition", () => {
    // A seller commonly sells Colorless and Lands together as one lot.
    const combined = markSlotsTaken(createAuction(), ["C", "L"]);
    expect(combined.remaining).toEqual(["W", "U", "B", "R", "G", "M"]);
    expect(combined.assignments).toEqual(["C", "L"]);
  });

  it("ignores slots already taken and duplicates within one combined batch", () => {
    const oneTaken = toggleSlotTaken(createAuction(), "C");
    const combined = markSlotsTaken(oneTaken, ["C", "C", "L"]);
    expect(combined.remaining).toEqual(["W", "U", "B", "R", "G", "M"]);
    expect(combined.assignments).toEqual(["C", "L"]);
  });

  it("refuses a combined batch that would leave zero slots remaining", () => {
    const downToTwo = createAuction(["W", "U"]);
    expect(markSlotsTaken(downToTwo, ["W", "U"])).toBe(downToTwo);
  });

  it("is a no-op for an empty or entirely-already-taken batch", () => {
    const auction = createAuction();
    expect(markSlotsTaken(auction, [])).toBe(auction);
    const withoutBlue = toggleSlotTaken(auction, "U");
    expect(markSlotsTaken(withoutBlue, ["U"])).toBe(withoutBlue);
  });
});
