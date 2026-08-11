import { describe, expect, it } from "vitest";
import { assignSlot, createAuction, undoAssignment } from "./auction";

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
});
