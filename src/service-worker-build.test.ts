import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("service worker build identity", () => {
  const root = process.cwd();
  const worker = readFileSync(join(root, "public", "sw.js"), "utf8");
  const main = readFileSync(join(root, "src", "main.tsx"), "utf8");

  it("derives the cache key from the immutable bundle registration rather than a manual label", () => {
    expect(worker).toContain('searchParams.get("build")');
    expect(worker).toContain("const CACHE = `colorbreak-${BUILD}`");
    expect(worker).not.toMatch(/colorbreak-v\d/);
    expect(main).toContain("./sw.js?build=${encodeURIComponent(buildId)}");
  });
});
