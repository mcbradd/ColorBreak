const PLOT = { left: 22, right: 78, top: 21, bottom: 79 };

export interface ChaseDatum { price: number; probability: number }

/** Keeps the visible cards spread across the plot without changing their values. */
export function chaseMapScale(rows: ChaseDatum[]) {
  const maxPrice = Math.max(Number.EPSILON, ...rows.map((row) => row.price));
  const maxProbability = Math.max(Number.EPSILON, ...rows.map((row) => row.probability));
  return {
    maxPrice,
    maxProbability,
    position: (row: ChaseDatum) => ({
      x: PLOT.left + row.probability / maxProbability * (PLOT.right - PLOT.left),
      y: PLOT.bottom - row.price / maxPrice * (PLOT.bottom - PLOT.top),
    }),
  };
}
