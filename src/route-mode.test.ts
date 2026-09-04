import { describe, expect, it } from "vitest";
import { hashForMode, modeFromHash, type Mode } from "./route-mode";

describe("route-mode", () => {
  it("sends a hash-less or unrecognized URL to the job chooser", () => {
    // A first visit, a bookmark to the bare origin, or a malformed hash must
    // land where both jobs are visible. Landing straight in the buyer
    // workspace hid the seller job behind an unlabelled wordmark link.
    expect(modeFromHash("")).toBe("home");
    expect(modeFromHash("#")).toBe("home");
    expect(modeFromHash("#nope")).toBe("home");
    expect(modeFromHash("#buyer")).toBe("buyer");
  });

  it("opens a shared break in the buyer workspace even with no fragment", () => {
    expect(modeFromHash("", "?b=abc&m=pick")).toBe("buyer");
    expect(modeFromHash("", "?utm=x")).toBe("home");
  });

  it("recognizes the seller and home hashes", () => {
    expect(modeFromHash("#seller")).toBe("seller");
    expect(modeFromHash("#home")).toBe("home");
  });

  it("round-trips every mode through its hash, for real (non-SPA-state) navigation", () => {
    // Regression guard: this is the mechanism a full page reload, browser
    // back/forward, or a static page's own link relies on. Covering every
    // mode (not just "home") protects the fix generally, in case a future
    // page links back into the seller workspace too.
    const modes: Mode[] = ["home", "buyer", "seller"];
    for (const mode of modes) {
      expect(modeFromHash(hashForMode(mode))).toBe(mode);
    }
  });

  it("gives the front page its own distinct hash instead of an empty one", () => {
    // The historical bug: leaving the front page cleared the hash instead of
    // setting one, so a real navigation back to that hash-less URL (e.g.
    // methodology.html's "back to ColorBreak" link, or the browser's own
    // back button after a full page reload) was indistinguishable from a
    // fresh visit and silently fell through to the buyer workspace.
    expect(hashForMode("home")).toBe("#home");
    expect(hashForMode("home")).not.toBe("");
  });
});
