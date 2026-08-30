import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("mobile Chrome viewport contract", () => {
  const root = process.cwd();
  const html = readFileSync(join(root, "index.html"), "utf8");
  const app = readFileSync(join(root, "src", "features", "shared", "ProductBuilder.tsx"), "utf8");
  const css = readFileSync(join(root, "src", "future.css"), "utf8");

  it("asks Chrome to resize page content when the onscreen keyboard opens", () => {
    expect(html).toContain("interactive-widget=resizes-content");
    expect(css).toContain("height: var(--visual-viewport-height, 100dvh)");
  });

  it("keeps the focused composer field and primary action together", () => {
    expect(css).toMatch(/\.keyboard-open \.composer-status \{ display: none; \}/);
    expect(css).toMatch(/\.keyboard-open \.break-import textarea \{[\s\S]*?height: clamp\(72px,/);
    expect(app).toContain('composerMode === "paste"');
    expect(app).toContain('onClick={resolveImport}>{importing ? "Checking products…" : "Review products"}');
  });

  it("accounts for phone safe areas in persistent navigation", () => {
    expect(css).toContain("--safe-top: env(safe-area-inset-top, 0px)");
    expect(css).toContain("--safe-bottom: env(safe-area-inset-bottom, 0px)");
    expect(css).toContain("top: calc(52px + var(--safe-top))");
    expect(css).toContain("padding-bottom: max(14px, var(--safe-bottom))");
  });
});


