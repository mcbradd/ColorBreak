import { describe, expect, it } from "vitest";
// public/ is served statically (untouched by the build) and deliberately
// framework-free so it can't depend on the SPA bundle; import it directly
// from its actual served location so this test exercises the real file.
import { shouldUseHistoryBack } from "../public/methodology-nav.js";

describe("methodology.html back-navigation link", () => {
  const currentOrigin = "https://mcbradd.github.io";

  it("prefers real browser back-navigation when it came from ColorBreak itself", () => {
    expect(
      shouldUseHistoryBack({
        referrer: "https://mcbradd.github.io/ColorBreak/",
        currentOrigin,
        historyLength: 3,
      }),
    ).toBe(true);
  });

  it("falls back to the href (not history.back()) with no prior same-tab history", () => {
    // A bookmark, a link opened in a new tab, or a directly-typed URL: there
    // is nothing meaningful to go back to, so the link's own href (the
    // front page) must be used instead of leaving the site or doing nothing.
    expect(
      shouldUseHistoryBack({
        referrer: "https://mcbradd.github.io/ColorBreak/",
        currentOrigin,
        historyLength: 1,
      }),
    ).toBe(false);
  });

  it("falls back to the href with no referrer at all", () => {
    expect(shouldUseHistoryBack({ referrer: "", currentOrigin, historyLength: 3 })).toBe(false);
  });

  it("falls back to the href when the referrer is a different site", () => {
    // Never send history.back() past ColorBreak to wherever a link from
    // another origin happened to come from.
    expect(
      shouldUseHistoryBack({
        referrer: "https://example.com/some-other-page",
        currentOrigin,
        historyLength: 3,
      }),
    ).toBe(false);
  });

  it("falls back to the href on an unparsable referrer instead of throwing", () => {
    expect(
      shouldUseHistoryBack({ referrer: "not a url", currentOrigin, historyLength: 3 }),
    ).toBe(false);
  });
});
