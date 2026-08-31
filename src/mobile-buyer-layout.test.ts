import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const modernCss = readFileSync(join(process.cwd(), "src", "modern.css"), "utf8");
const finalCss = readFileSync(join(process.cwd(), "src", "future.css"), "utf8");

describe("mobile buyer landing layout", () => {
  it("keeps entry controls before results and uses a compact one-row slot rail", () => {
    expect(modernCss).toContain(".bid-check-workbench .buyer-results { order: initial; }");
    expect(modernCss).toContain("grid-template-columns: repeat(8, minmax(0, 1fr))");
    expect(modernCss).toContain(".bid-check-workbench .buyer-options-heading h2 { display: none; }");
    expect(modernCss).toContain(".bid-check-workbench .bulk-filter-details { display: none; }");
  });

  it("gives the one active decision panel the full 390px phone measure", () => {
    expect(finalCss).toContain("@media (max-width: 899px)");
    expect(finalCss).toContain(".bid-check-workbench.has-break .buyer-decision-stage");
    expect(finalCss).toContain("width: 100%;");
    expect(finalCss).toContain(".buyer-decision-stage > .bid-live-decision { width: 100%; }");
  });
});
