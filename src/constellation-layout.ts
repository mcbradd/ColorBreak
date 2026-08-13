const PLOT = { left: 22, right: 78, top: 21, bottom: 79 };
const REFERENCE_SIZE = { width: 280, height: 300 };
const POINT_GAP = 4;

export interface ChaseDatum { price: number; probability: number }
export interface ChaseMarkerDatum extends ChaseDatum { diameter: number }

/** Keeps the visible cards spread across the plot without changing their values. */
export function chaseMapScale(rows: ChaseDatum[]) {
  const price = (row: ChaseDatum) => Math.max(0, Number.isFinite(row.price) ? row.price : 0);
  const probability = (row: ChaseDatum) => Math.max(0, Number.isFinite(row.probability) ? row.probability : 0);
  const maxPrice = Math.max(Number.EPSILON, ...rows.map(price));
  const maxProbability = Math.max(Number.EPSILON, ...rows.map(probability));
  return {
    maxPrice,
    maxProbability,
    position: (row: ChaseDatum) => ({
      x: PLOT.left + probability(row) / maxProbability * (PLOT.right - PLOT.left),
      y: PLOT.bottom - price(row) / maxPrice * (PLOT.bottom - PLOT.top),
    }),
  };
}

/**
 * Keeps dense points legible while leaving isolated points at their exact data
 * coordinates. Placement uses the narrow mobile chart as its reference, so the
 * same percentage positions only gain clearance on wider screens.
 */
export function chaseMapLayout(rows: ChaseMarkerDatum[]) {
  const scale = chaseMapScale(rows);
  const placed: Array<{ x: number; y: number; diameter: number } | undefined> = new Array(rows.length);
  const placementOrder = rows
    .map((row, index) => ({ row, index }))
    .sort((first, second) => second.row.diameter - first.row.diameter || first.index - second.index);
  const maxSearchRadius = Math.hypot(REFERENCE_SIZE.width, REFERENCE_SIZE.height);

  for (const { row, index } of placementOrder) {
    const anchor = scale.position(row);
    const anchorX = anchor.x / 100 * REFERENCE_SIZE.width;
    const anchorY = anchor.y / 100 * REFERENCE_SIZE.height;
    const pointRadius = row.diameter / 2;
    const minX = PLOT.left / 100 * REFERENCE_SIZE.width + pointRadius;
    const maxX = PLOT.right / 100 * REFERENCE_SIZE.width - pointRadius;
    const minY = PLOT.top / 100 * REFERENCE_SIZE.height + pointRadius;
    const maxY = PLOT.bottom / 100 * REFERENCE_SIZE.height - pointRadius;
    let position: { x: number; y: number } | undefined;

    for (let searchRadius = 0; searchRadius <= maxSearchRadius && !position; searchRadius += 4) {
      const samples = searchRadius === 0 ? 1 : Math.max(8, Math.ceil(2 * Math.PI * searchRadius / 4));
      for (let sample = 0; sample < samples; sample += 1) {
        const angle = -Math.PI / 2 + sample / samples * Math.PI * 2;
        const candidate = {
          x: Math.min(maxX, Math.max(minX, anchorX + Math.cos(angle) * searchRadius)),
          y: Math.min(maxY, Math.max(minY, anchorY + Math.sin(angle) * searchRadius)),
        };
        const clearsPlacedPoints = placed.every((other) => {
          if (!other) return true;
          const requiredDistance = pointRadius + other.diameter / 2 + POINT_GAP;
          return Math.hypot(candidate.x - other.x, candidate.y - other.y) >= requiredDistance;
        });
        if (clearsPlacedPoints) {
          position = candidate;
          break;
        }
      }
    }

    const resolved = position ?? {
      x: Math.min(maxX, Math.max(minX, anchorX)),
      y: Math.min(maxY, Math.max(minY, anchorY)),
    };
    placed[index] = { ...resolved, diameter: row.diameter };
  }

  return {
    ...scale,
    points: placed.map((point) => ({
      x: point!.x / REFERENCE_SIZE.width * 100,
      y: point!.y / REFERENCE_SIZE.height * 100,
    })),
  };
}
