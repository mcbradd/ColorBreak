import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src", "features", "workflow", "WorkflowImplementation.tsx"), "utf8");

describe("seller bonus-pack pricing", () => {
  it("shows market price separately from the seller cost override", () => {
    expect(source).toContain('label="My cost for this pack"');
    expect(source).toContain("Current pack market price");
    expect(source).toContain("Cost used in profit math");
  });

  it("does not calculate profit from a silently assumed zero pack cost", () => {
    expect(source).not.toContain("bonusCostOverride ?? bonusMarket ?? 0");
    expect(source).toContain("bonusCostKnown");
  });
});
