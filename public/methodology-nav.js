// Progressive enhancement for methodology.html's single navigation link.
//
// methodology.html is reached only by leaving the ColorBreak app (currently
// always the front page, via its "Estimates, not guarantees" footer link).
// The link's `href` is a safe, correct fallback destination on its own
// (the front page, via ColorBreak's own "#home" route - see src/route-mode.ts)
// for a bookmarked or newly-opened tab with no ColorBreak history to return
// to. But when the visitor actually navigated here from within the app,
// real browser back-navigation returns them to the exact page/state they
// left - not just "the front page" - so this prefers that when it's safe.

/**
 * Decides whether `history.back()` is a safe, meaningful choice for this
 * page load, vs. falling through to the link's own href.
 *
 * Exported as a pure function so its branching can be unit-tested without a
 * real browser navigation.
 */
export function shouldUseHistoryBack({ referrer, currentOrigin, historyLength }) {
  // No prior entry in *this tab's* session history to go back to (a fresh
  // tab, a bookmark, a link from another site opened in a new tab).
  if (typeof historyLength !== "number" || historyLength <= 1) return false;
  // No same-origin referrer: we can't confirm the previous entry is a
  // ColorBreak page, so don't risk sending the visitor somewhere unrelated.
  if (!referrer) return false;
  try {
    return new URL(referrer).origin === currentOrigin;
  } catch {
    return false;
  }
}

/** Wires the back link. Takes `doc`/`win` so tests can pass fakes. */
export function initBackNav(doc, win) {
  const link = doc.getElementById("back-link");
  if (!link) return;
  const useBack = shouldUseHistoryBack({
    referrer: doc.referrer,
    currentOrigin: win.location.origin,
    historyLength: win.history.length,
  });
  if (useBack) {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      win.history.back();
    });
  }
}

if (typeof document !== "undefined" && typeof window !== "undefined") {
  initBackNav(document, window);
}
