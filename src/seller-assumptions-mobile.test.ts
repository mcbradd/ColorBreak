import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("seller assumptions phone control", () => {
  const root = process.cwd();
  const app = readFileSync(join(root, "src", "App.tsx"), "utf8");
  const css = readFileSync(join(root, "src", "modern.css"), "utf8");
  const future = readFileSync(join(root, "src", "future.css"), "utf8");

  it("keeps the compact control whole-word, full-width, and touch-sized at phone widths", () => {
    expect(app).toContain('data-testid="seller-assumptions-toggle"');
    expect(css).toMatch(/\.seller-assumptions > summary \{ min-width: 0; min-height: 44px; \}/);
    expect(css).toMatch(/\.seller-assumptions > summary > span \{ white-space: nowrap; overflow-wrap: normal; word-break: normal; hyphens: none; \}/);
    expect(css).toMatch(/\.seller-assumptions \{ grid-column: 1 \/ -1; width: 100%; \}/);
    expect(future).toContain(".seller-command-center .seller-assumptions .disclosure-summary > span");
  });
});
