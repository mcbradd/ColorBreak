import { evaluateBreakAnalysis, type BreakAnalysis } from "../data/evaluate";
import { canonicalCompositionFingerprint } from "./canonical-composition";
import type { BreakLine, DecisionEligibility, DecisionEligibilityStatus } from "./types";
import { DECISION_FRESHNESS_MS, decisionEligibility } from "./valuation";

/** One immutable answer to “can this exact break drive a buyer decision now?”. */
export interface BuyerDecisionAssessment {
  analysis: BreakAnalysis;
  eligibility: DecisionEligibility;
  presentation: DecisionEligibilityStatus;
  compositionFingerprint: string;
  evidenceFingerprint: string;
  dataVersion: string;
  observedAt?: string;
  source?: string;
  policyThresholdMs: number;
  ageMs?: number;
  materialBlockers: string[];
  assessedAt: number;
}

export interface PreparedProductSelection {
  lines: BreakLine[];
  assessment: BuyerDecisionAssessment;
  compositionFingerprint: string;
  evidenceFingerprint: string;
}

export async function assessBuyerDecision(
  lines: BreakLine[],
  threshold: number,
  now: number | Date = Date.now(),
): Promise<BuyerDecisionAssessment> {
  const assessedAt = now instanceof Date ? now.getTime() : now;
  const analysis = await evaluateBreakAnalysis(lines, threshold);
  const eligibility = decisionEligibility(analysis.valuation, assessedAt, DECISION_FRESHNESS_MS);
  const compositionFingerprint = canonicalCompositionFingerprint(lines);
  const materialBlockers = eligibility.affectedGroups.map((group) => group.label);
  const evidenceFingerprint = JSON.stringify({
    compositionFingerprint,
    threshold,
    dataVersion: analysis.valuation.dataVersion,
    observedAt: eligibility.observedAt,
    source: eligibility.observedSource,
    policyThresholdMs: eligibility.freshnessThresholdMs,
    materialBlockers,
  });
  return {
    analysis,
    eligibility,
    presentation: eligibility.status,
    compositionFingerprint,
    evidenceFingerprint,
    dataVersion: analysis.valuation.dataVersion,
    observedAt: eligibility.observedAt,
    source: eligibility.observedSource,
    policyThresholdMs: eligibility.freshnessThresholdMs,
    ageMs: eligibility.ageMs,
    materialBlockers,
    assessedAt,
  };
}

export async function prepareProductSelection(
  lines: BreakLine[],
  threshold: number,
  now?: number | Date,
): Promise<PreparedProductSelection> {
  const assessment = await assessBuyerDecision(lines, threshold, now);
  return {
    lines,
    assessment,
    compositionFingerprint: assessment.compositionFingerprint,
    evidenceFingerprint: assessment.evidenceFingerprint,
  };
}
