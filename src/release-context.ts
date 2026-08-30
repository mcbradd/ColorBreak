/** Build-supplied authority for what a release may present.  It is deliberately
 * separate from data freshness: a public Pages artifact is analysis-only. */
export type ReleasePosture = "analysis-only" | "decision-ready";

export type ReleaseContext = Readonly<{ posture: ReleasePosture; checkoutSha?: string; buildId?: string }>;

declare const __COLORBREAK_RELEASE_POSTURE__: ReleasePosture | undefined;
declare const __COLORBREAK_BUILD_ID__: string | undefined;

export const analysisOnlyReleaseContext: ReleaseContext = Object.freeze({ posture: "analysis-only" });
/** Local development is not a public artifact. Production bundles default to
 * the safe public posture; a decision-ready host must inject its own context. */
export const runtimeReleaseContext: ReleaseContext = typeof __COLORBREAK_RELEASE_POSTURE__ !== "undefined"
  ? Object.freeze({ posture: __COLORBREAK_RELEASE_POSTURE__, buildId: typeof __COLORBREAK_BUILD_ID__ !== "undefined" ? __COLORBREAK_BUILD_ID__ : undefined })
  : analysisOnlyReleaseContext;
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

/** Shared public-release language.  A release posture is the single authority
 * for both buyer and seller claims, rather than scattered UI checks. */
export function releasePresentation(context: ReleaseContext) {
  const analysisOnly = context.posture !== "decision-ready";
  return {
    analysisOnly,
    buyerScope: analysisOnly
      ? "Practice analysis — historical/modelled values, not current bid evidence"
      : "Decision evidence",
    sellerScope: analysisOnly
      ? "Practice plan only — no launch decision"
      : "Seller plan",
  } as const;
}
