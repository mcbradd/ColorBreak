import { describe, expect, it } from "vitest";
import { assignSlot, createAuction, toggleSlotTaken, undoAssignment } from "./auction";

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
});
