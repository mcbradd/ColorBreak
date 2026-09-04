/** App-level view. "home" asks buyer or seller; "buyer" and "seller" are the
 * two workspaces. */
export type Mode = "home" | "buyer" | "seller";

/**
 * Reads the mode encoded in a URL hash.
 *
 * A hash-less or unrecognized URL - a first visit, a bookmark to the bare
 * origin, a shared link with no fragment - resolves to the front page, which
 * is the only place the buyer and seller jobs are both visible. Dropping a
 * first-time visitor straight into the buyer workspace hid the seller job
 * behind a wordmark nobody knows is a link.
 *
 * "#home" is still a real, distinct hash so that leaving and returning by a
 * real (non-SPA) navigation resolves to the same place either way.
 */
export function modeFromHash(hash: string, search = ""): Mode {
  if (hash === "#seller") return "seller";
  if (hash === "#buyer") return "buyer";
  // A shared break carries its composition in the query string. Such a link
  // names a break to check, so it opens the buyer workspace even when an
  // older copy of the link has no fragment at all.
  if (new URLSearchParams(search).has("b")) return "buyer";
  return "home";
}

/** The hash a mode should be represented by in the URL, chosen so that
 * `modeFromHash(hashForMode(mode)) === mode` for every mode - i.e. so the
 * mode survives a real (non-SPA-state) round trip through the URL. */
export function hashForMode(mode: Mode): string {
  return mode === "seller" ? "#seller" : mode === "home" ? "#home" : "#buyer";
}
