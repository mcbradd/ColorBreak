import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const files = ["BuyerVisuals.tsx", "BuyerDetails.tsx"] as const;

describe("expandable section affordances", () => {
  it.each(files)("uses the shared disclosure summary and arrow for every details section in %s", (file) => {
    const source = readFileSync(join(process.cwd(), "src", "features", "buyer", file), "utf8");
    const detailsCount = source.match(/<details\b/g)?.length ?? 0;
    const summaryCount = source.match(/<summary(?: className="disclosure-summary")?/g)?.length ?? 0;
    const arrowCount = source.match(/<DisclosureArrow \/>/g)?.length ?? 0;

    expect(detailsCount).toBeGreaterThan(0);
    expect(summaryCount).toBe(detailsCount);
    // Every disclosure — "Break evidence" included — must carry a real,
    // rendered open/close affordance, not just a bare header that looks
    // clickable. A <details> with no matching arrow is exactly the bug this
    // guards against.
    expect(arrowCount).toBe(detailsCount);
  });

  it("has no bare disclosure-summary header left outside a <details> element", () => {
    const source = readFileSync(join(process.cwd(), "src", "features", "buyer", "BuyerDetails.tsx"), "utf8");
    expect(source).not.toMatch(/<header className="disclosure-summary">/);
  });
});
