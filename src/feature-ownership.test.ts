import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const features = join(process.cwd(), "src", "features");
const files = (directory: string): string[] => readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
  const path = join(directory, entry.name);
  return entry.isDirectory() ? files(path) : path.endsWith(".tsx") ? [path] : [];
});

describe("feature ownership boundary", () => {
  it("keeps role controllers separate and leaves no mixed workspace shell", () => {
    const buyer = readFileSync(join(features, "buyer", "BuyerWorkspace.tsx"), "utf8");
    const seller = readFileSync(join(features, "seller", "SellerWorkspace.tsx"), "utf8");
    expect(existsSync(join(features, "workspace", "WorkspaceShell.tsx"))).toBe(false);
    expect(buyer).toContain("export function BuyerWorkspace");
    expect(seller).toContain("export function SellerWorkspace");
    expect(buyer).not.toContain("SellerView");
    expect(seller).not.toContain("readBuyerDecisionRecord");
  });

  it("keeps feature components bounded for reviewable ownership", () => {
    for (const file of files(features)) {
      expect(readFileSync(file, "utf8").split(/\r?\n/).length, file).toBeLessThanOrEqual(900);
    }
  });
});
