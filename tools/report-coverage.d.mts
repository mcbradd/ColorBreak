export interface CoverageSummary {
  reasons: Record<string, number>;
  [key: string]: unknown;
}

export function summarizeCoverage(documents: Array<Record<string, unknown>>, corrections: Record<string, unknown>): CoverageSummary;
