import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, normalize, resolve, sep } from "node:path";
import { describe, expect, it } from "vitest";

const features = join(process.cwd(), "src", "features");
const files = (directory: string): string[] => readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
  const path = join(directory, entry.name);
  return entry.isDirectory() ? files(path) : path.endsWith(".tsx") ? [path] : [];
});

function resolveRelativeImport(file: string, specifier: string): string | undefined {
  if (!specifier.startsWith(".")) return undefined;
  const base = resolve(dirname(file), specifier);
  return [base, `${base}.ts`, `${base}.tsx`, join(base, "index.ts"), join(base, "index.tsx")]
    .find((candidate) => existsSync(candidate) && statSync(candidate).isFile());
}

function feature(path: string): "buyer" | "seller" | "shared" | undefined {
  const relative = normalize(path).slice(normalize(features).length + 1);
  return relative.startsWith(`buyer${sep}`) ? "buyer" : relative.startsWith(`seller${sep}`) ? "seller" : relative.startsWith(`shared${sep}`) ? "shared" : undefined;
}

function isForbidden(from: ReturnType<typeof feature>, to: ReturnType<typeof feature>) {
  return (from === "seller" && to === "buyer") || (from === "buyer" && to === "seller") || (from === "shared" && (to === "buyer" || to === "seller"));
}

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

  it("enforces the resolved feature import graph", () => {
    for (const file of files(features)) {
      const imports = [...readFileSync(file, "utf8").matchAll(/(?:from\s*|import\s*)["']([^"']+)["']/g)];
      for (const match of imports) {
        const target = resolveRelativeImport(file, match[1]);
        if (target) expect(isForbidden(feature(file), feature(target)), `${file} must not import ${target}`).toBe(false);
      }
    }
    expect(isForbidden("seller", "buyer")).toBe(true);
    expect(isForbidden("buyer", "seller")).toBe(true);
    expect(isForbidden("shared", "buyer")).toBe(true);
    expect(isForbidden("shared", "seller")).toBe(true);
    expect(isForbidden("seller", "shared")).toBe(false);
  });

  it("keeps feature components bounded for reviewable ownership", () => {
    for (const file of files(features)) {
      expect(readFileSync(file, "utf8").split(/\r?\n/).length, file).toBeLessThanOrEqual(900);
    }
  });
});
