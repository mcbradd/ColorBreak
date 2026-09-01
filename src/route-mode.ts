/** App-level view. "home" is the marketing front page; "buyer" and "seller"
 * are the two workspaces. */
export type Mode = "home" | "buyer" | "seller";

/**
 * Reads the mode encoded in a URL hash.
 *
 * Bid checking is the product's default job: a hash-less or unrecognized
 * URL (a true first visit, a bookmark to the bare origin, a shared link
 * with no fragment) resolves to "buyer", not the front page.
 *
 * "#home" must be a real, distinct hash rather than an absence of one. If
 * leaving the front page cleared the hash instead of setting "#home", a
 * later *real* navigation back to that hash-less URL - a full page reload,
 * browser back/forward, or a static page's own "back to ColorBreak" link -
 * would be indistinguishable from a fresh visit and would silently land the
 * user in the buyer workspace instead of the front page they actually left.
 */
export function modeFromHash(hash: string): Mode {
  if (hash === "#seller") return "seller";
  if (hash === "#home") return "home";
  return "buyer";
}

/** The hash a mode should be represented by in the URL, chosen so that
 * `modeFromHash(hashForMode(mode)) === mode` for every mode - i.e. so the
 * mode survives a real (non-SPA-state) round trip through the URL. */
export function hashForMode(mode: Mode): string {
  return mode === "seller" ? "#seller" : mode === "home" ? "#home" : "#buyer";
}
