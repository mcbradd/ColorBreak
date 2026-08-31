import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src", "features", "buyer", "BuyerVisuals.tsx"), "utf8");

describe("expandable section affordances", () => {
  it("uses the shared disclosure summary and arrow for every details section", () => {
    const detailsCount = source.match(/<details\b/g)?.length ?? 0;
    const summaryCount = source.match(/<summary(?: className="disclosure-summary")?/g)?.length ?? 0;
    const arrowCount = source.match(/<DisclosureArrow \/>/g)?.length ?? 0;

    expect(detailsCount).toBeGreaterThan(0);
    expect(summaryCount).toBe(detailsCount);
    expect(arrowCount).toBeGreaterThanOrEqual(0);
  });
});

