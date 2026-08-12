export interface ChasePoint {
  id: string;
  x: number;
  y: number;
}

export interface ChaseLayoutPoint extends ChasePoint {
  targetX: number;
  targetY: number;
}

/**
 * Keeps the true data point intact while moving touch targets to two
 * collision-free rails. Coordinates are percentages within the chart.
 */
export function layoutChaseTargets(points: ChasePoint[]): ChaseLayoutPoint[] {
  const ordered = [...points].sort((a, b) => a.x - b.x || a.y - b.y || a.id.localeCompare(b.id));
  const leftIds = new Set(ordered.slice(0, Math.ceil(ordered.length / 2)).map((point) => point.id));

  const placeSide = (side: ChasePoint[], targetX: number) => {
    const byHeight = [...side].sort((a, b) => a.y - b.y || a.id.localeCompare(b.id));
    return byHeight.map((point, index) => ({
      ...point,
      targetX,
      targetY: byHeight.length === 1 ? 50 : 10 + index * (80 / (byHeight.length - 1)),
    }));
  };

  return [
    ...placeSide(points.filter((point) => leftIds.has(point.id)), 8),
    ...placeSide(points.filter((point) => !leftIds.has(point.id)), 92),
  ];
}
