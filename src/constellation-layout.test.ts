import { describe, expect, it } from "vitest";
import { chaseMapLayout, chaseMapScale } from "./constellation-layout";

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

  it("separates a full twelve-card cluster within the mobile chart", () => {
    const diameter = 38;
    const layout = chaseMapLayout(Array.from({ length: 12 }, () => ({
      price: 20,
      probability: .1,
      diameter,
    })));
    const points = layout.points.map((point) => ({
      x: point.x / 100 * 280,
      y: point.y / 100 * 300,
    }));

    for (const point of points) {
      expect(point.x).toBeGreaterThanOrEqual(diameter / 2 + 4);
      expect(point.x).toBeLessThanOrEqual(280 - diameter / 2 - 4);
      expect(point.y).toBeGreaterThanOrEqual(diameter / 2 + 4);
      expect(point.y).toBeLessThanOrEqual(300 - diameter / 2 - 4);
    }
    for (let first = 0; first < points.length; first += 1) {
      for (let second = first + 1; second < points.length; second += 1) {
        expect(Math.hypot(
          points[first].x - points[second].x,
          points[first].y - points[second].y,
        )).toBeGreaterThanOrEqual(diameter + 4);
      }
    }
  });
});
