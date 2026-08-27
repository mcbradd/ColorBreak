import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(join(process.cwd(), "src", "modern.css"), "utf8");

describe("mobile buyer landing layout", () => {
  it("keeps entry controls before results and uses a compact one-row slot rail", () => {
    expect(css).toContain(".bid-check-workbench .buyer-results { order: initial; }");
    expect(css).toContain("grid-template-columns: repeat(8, minmax(0, 1fr))");
    expect(css).toContain(".bid-check-workbench .buyer-options-heading h2 { display: none; }");
    expect(css).toContain(".bid-check-workbench .bulk-filter-details { display: none; }");
  });
});
