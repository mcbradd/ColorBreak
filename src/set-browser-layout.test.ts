import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const css = ["styles.css", "supplemental.css", "modern.css"]
  .map((file) => readFileSync(join(process.cwd(), "src", file), "utf8"))
  .join("\n")
  .replace(/\s+/g, " ");

describe("Add Product scrolling", () => {
  it("locks the page and set browser to vertical panning only", () => {
    expect(css).toMatch(/html, body \{[^}]*overflow-x: hidden/);
    expect(css).toMatch(/\.sheet \{[^}]*overflow-x: hidden;[^}]*overflow-y: auto;[^}]*touch-action: pan-y/);
    expect(css).toMatch(/\.sheet > \.section-label \{[^}]*width: auto/);
  });
});
