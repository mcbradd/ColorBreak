import { describe, expect, it } from "vitest";
import { layoutChaseTargets } from "./constellation-layout";

describe("chase map target layout", () => {
  it("preserves true values while separating twelve crowded mobile targets", () => {
    const points = Array.from({ length: 12 }, (_, index) => ({
      id: `card-${index}`,
      x: 48 + (index % 3),
      y: 49 + (index % 2),
    }));
    const layout = layoutChaseTargets(points);

    expect(layout.map(({ id, x, y }) => ({ id, x, y }))).toEqual(
      expect.arrayContaining(points),
    );

    const targetWidth = 38;
    const targetHeight = 53;
    const chartWidth = 320;
    const chartHeight = 260;
    const boxes = layout.map((point) => ({
      left: point.targetX / 100 * chartWidth - targetWidth / 2,
      right: point.targetX / 100 * chartWidth + targetWidth / 2,
      top: point.targetY / 100 * chartHeight - targetHeight / 2,
      bottom: point.targetY / 100 * chartHeight + targetHeight / 2,
    }));

    for (let first = 0; first < boxes.length; first += 1) {
      for (let second = first + 1; second < boxes.length; second += 1) {
        const a = boxes[first];
        const b = boxes[second];
        const overlaps = a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
        expect(overlaps).toBe(false);
      }
    }

    for (const edge of ["top", "right", "bottom", "left"] as const) {
      const rail = layout.filter((point) => point.edge === edge);
      expect(rail.length).toBeLessThanOrEqual(3);
      const graphOrder = rail.map((point) => edge === "top" || edge === "bottom" ? point.x : point.y);
      expect(graphOrder).toEqual([...graphOrder].sort((a, b) => a - b));
    }
  });
});
