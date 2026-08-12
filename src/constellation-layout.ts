export interface ChasePoint {
  id: string;
  x: number;
  y: number;
}

export type ChaseEdge = "top" | "right" | "bottom" | "left";

export interface ChaseLayoutPoint extends ChasePoint {
  edge: ChaseEdge;
  targetX: number;
  targetY: number;
  exitX: number;
  exitY: number;
}

const PLOT = { left: 22, right: 78, top: 21, bottom: 79 };
const EDGES: ChaseEdge[] = ["top", "right", "bottom", "left"];

const distanceToEdge = (point: ChasePoint, edge: ChaseEdge) => ({
  top: point.y - PLOT.top,
  right: PLOT.right - point.x,
  bottom: PLOT.bottom - point.y,
  left: point.x - PLOT.left,
}[edge]);

/**
 * Places card thumbnails on four outside rails. Each rail is ordered by the
 * matching graph coordinate, so leader lines cannot braid across one another.
 */
export function layoutChaseTargets(points: ChasePoint[]): ChaseLayoutPoint[] {
  const capacity = Math.max(1, Math.ceil(points.length / 4));
  const groups = new Map<ChaseEdge, ChasePoint[]>(EDGES.map((edge) => [edge, []]));
  const hardestFirst = [...points].sort((a, b) => {
    const aDistances = EDGES.map((edge) => distanceToEdge(a, edge)).sort((x, y) => x - y);
    const bDistances = EDGES.map((edge) => distanceToEdge(b, edge)).sort((x, y) => x - y);
    return (bDistances[1] - bDistances[0]) - (aDistances[1] - aDistances[0]) || a.id.localeCompare(b.id);
  });

  for (const point of hardestFirst) {
    const edge = [...EDGES]
      .filter((candidate) => groups.get(candidate)!.length < capacity)
      .sort((a, b) => distanceToEdge(point, a) - distanceToEdge(point, b) || EDGES.indexOf(a) - EDGES.indexOf(b))[0];
    groups.get(edge)!.push(point);
  }

  const placed: ChaseLayoutPoint[] = [];
  for (const edge of EDGES) {
    const horizontal = edge === "top" || edge === "bottom";
    const ordered = groups.get(edge)!.sort((a, b) => (horizontal ? a.x - b.x : a.y - b.y) || a.id.localeCompare(b.id));
    ordered.forEach((point, index) => {
      const position = ordered.length === 1 ? 50 : 27 + index * (46 / (ordered.length - 1));
      placed.push({
        ...point,
        edge,
        targetX: horizontal ? position : edge === "left" ? 8 : 92,
        targetY: horizontal ? edge === "top" ? 8 : 92 : position,
        exitX: horizontal ? point.x : edge === "left" ? PLOT.left : PLOT.right,
        exitY: horizontal ? edge === "top" ? PLOT.top : PLOT.bottom : point.y,
      });
    });
  }
  return placed;
}
