import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(join(process.cwd(), "src", "supplemental.css"), "utf8");

describe("buyer verdict help layout", () => {
  it("assigns Pick My Color and Typical Value help to separate right-edge rows", () => {
    expect(css).toContain(".verdict-decision .section-label .tip-icon");
    expect(css).toContain("top:10px; right:10px");
    expect(css).toContain(".ev-orb small .tip-icon");
    expect(css).toContain("top:50px; right:10px");
  });
});
