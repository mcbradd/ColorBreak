import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Home } from "./features/shared/Primitives";

/** Splits a CSS grid-template-columns value into its top-level tracks,
 * respecting parens so `minmax(0, 1fr) 24px` counts as 2 tracks, not 3. */
function countTracks(value: string): number {
  let depth = 0;
  let tracks = 1;
  for (const ch of value.trim()) {
    if (ch === "(") depth++;
    else if (ch === ")") depth--;
    else if (ch === " " && depth === 0) tracks++;
  }
  return tracks;
}

describe("Home mode-card grid matches its actual DOM children", () => {
  it("renders exactly two grid items per mode-card (content + chevron)", () => {
    render(createElement(Home, { choose: vi.fn() }));
    const card = document.querySelector(".mode-card.buyer-card");
    expect(card).not.toBeNull();
    // Regression guard for the bug where auto-placement dropped .mode-copy
    // into a leftover narrow first column sized for an abandoned 4-item
    // design, squeezing every word in the heading/body onto its own line.
    expect(card!.children).toHaveLength(2);
  });

  it("declares a 2-track grid-template-columns for .mode-card at every breakpoint", () => {
    const css = readFileSync(join(process.cwd(), "src", "future.css"), "utf8");
    const baseMatch = css.match(/\.mode-card\s*\{[^}]*grid-template-columns:\s*([^;]+);/);
    expect(baseMatch, "base .mode-card rule should declare grid-template-columns").not.toBeNull();
    expect(countTracks(baseMatch![1])).toBe(2);

    const mobileMatch = css.match(/@media \(max-width: 520px\)[\s\S]*?\.mode-card\s*\{[^}]*grid-template-columns:\s*([^;]+);/);
    expect(mobileMatch, "mobile .mode-card override should declare grid-template-columns").not.toBeNull();
    expect(countTracks(mobileMatch![1])).toBe(2);
  });
});
