/** Build-supplied authority for what a release may present.  It is deliberately
 * separate from data freshness: a public Pages artifact is analysis-only. */
export type ReleasePosture = "analysis-only" | "decision-ready";

export type ReleaseContext = Readonly<{ posture: ReleasePosture; checkoutSha?: string }>;

declare const __COLORBREAK_RELEASE_POSTURE__: ReleasePosture | undefined;

export const analysisOnlyReleaseContext: ReleaseContext = Object.freeze({ posture: "analysis-only" });
/** Local development is not a public artifact. Production bundles default to
 * the safe public posture; a decision-ready host must inject its own context. */
export const runtimeReleaseContext: ReleaseContext = typeof __COLORBREAK_RELEASE_POSTURE__ !== "undefined"
  ? Object.freeze({ posture: __COLORBREAK_RELEASE_POSTURE__ })
  : Object.freeze({ posture: "decision-ready" });
export const decisionReadyReleaseContext: ReleaseContext = Object.freeze({ posture: "decision-ready" });

export function buyerDecisionPresentation(
  eligibility: string,
  context: ReleaseContext,
) {
  const allowed = context.posture === "decision-ready" && eligibility === "eligible";
  return {
    canShowDecision: allowed,
    heading: allowed ? undefined : "ANALYSIS ONLY — NO BID DECISION",
    maxHammer: allowed ? undefined : "—",
  } as const;
}
