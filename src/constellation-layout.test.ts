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

  it("separates a full twelve-card cluster inside the non-negative plot axes", () => {
    const diameter = 38;
    const layout = chaseMapLayout(Array.from({ length: 12 }, () => ({
      price: 20,
      probability: .1,
      diameter,
    })));
    const plot = {
      left: .22 * 280,
      right: .78 * 280,
      top: .21 * 300,
      bottom: .79 * 300,
    };
    const points = layout.points.map((point) => ({
      x: point.x / 100 * 280,
      y: point.y / 100 * 300,
    }));

    for (const point of points) {
      expect(point.x - diameter / 2).toBeGreaterThanOrEqual(plot.left);
      expect(point.x + diameter / 2).toBeLessThanOrEqual(plot.right);
      expect(point.y - diameter / 2).toBeGreaterThanOrEqual(plot.top);
      expect(point.y + diameter / 2).toBeLessThanOrEqual(plot.bottom);
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
