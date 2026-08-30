import { describe, expect, it } from "vitest";
import { compositionProjection, cleanupLegacyStorage } from "./persistence";

describe("private draft persistence", () => {
  it("removes every financial field from a remembered composition", () => {
    const remembered = compositionProjection([{ id: "x", set: "TDM", productKey: "sealed:box", productLabel: "Box", quantity: 1, myCost: 42, marketCost: 55 }]);
    expect(JSON.stringify(remembered)).not.toMatch(/myCost|marketCost|42|55/);
  });
  it("deletes legacy durable seller records", () => {
    localStorage.setItem("colorbreak:seller:lines", JSON.stringify([{ myCost: 44 }]));
    expect(cleanupLegacyStorage()).toBe(true);
    expect(localStorage.getItem("colorbreak:seller:lines")).toBeNull();
  });
});
