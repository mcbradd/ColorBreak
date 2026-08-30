/** Build metadata is informational. Data completeness and freshness determine
 * whether a current calculation can show a modeled ceiling. */
export type ReleaseContext = Readonly<{ checkoutSha?: string; buildId?: string }>;

declare const __COLORBREAK_BUILD_ID__: string | undefined;

export const runtimeReleaseContext: ReleaseContext = Object.freeze({
  buildId: typeof __COLORBREAK_BUILD_ID__ !== "undefined" ? __COLORBREAK_BUILD_ID__ : undefined,
});

export function buyerDecisionPresentation(
  eligibility: string,
) {
  const allowed = eligibility === "eligible";
  return {
    canShowDecision: allowed,
    heading: allowed ? undefined : "LIMIT UNAVAILABLE",
    maxHammer: allowed ? undefined : "—",
  } as const;
}
