import { describe, expect, it } from "vitest";
import { chaseMapScale } from "./constellation-layout";

describe("chase map target layout", () => {
  it("scales both axes to the highest displayed value", () => {
    const scale = chaseMapScale([
      { price: 8.41, probability: .0083 },
      { price: 35.38, probability: .28 },
    ]);

    expect(scale.maxPrice).toBe(35.38);
    expect(scale.maxProbability).toBe(.28);
    expect(scale.position({ price: 8.41, probability: .0083 })).toEqual({
      x: expect.closeTo(23.66, 1),
      y: expect.closeTo(65.21, 1),
    });
    expect(scale.position({ price: 35.38, probability: .28 })).toEqual({ x: 78, y: 21 });
  });
});
