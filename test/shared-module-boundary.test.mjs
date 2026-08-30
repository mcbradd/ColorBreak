import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const extensions = [".ts", ".tsx", ".mts", ".js", ".jsx"];
const importPattern = /(?:import|export)\s+(type\s+)?(?:[^"']*?\s+from\s+)?["']([^"']+)["']/g;

function resolveLocal(from, specifier) {
  if (!specifier.startsWith(".")) return undefined;
  const plain = resolve(dirname(from), specifier);
  for (const candidate of [plain, ...extensions.map((extension) => `${plain}${extension}`), ...extensions.map((extension) => join(plain, `index${extension}`))]) if (existsSync(candidate)) return candidate;
  throw new Error(`Unresolved local import ${specifier} from ${from}`);
}

export function reachableImports(entry) {
  const resolved = resolve(entry), queue = [resolved], seen = new Map([[resolved, [resolved]]]);
  while (queue.length) {
    const file = queue.shift();
    for (const match of readFileSync(file, "utf8").matchAll(importPattern)) {
      const child = resolveLocal(file, match[2]);
      if (child && !seen.has(child)) { seen.set(child, [...seen.get(file), child]); queue.push(child); }
    }
  }
  return seen;
}

function assertClosure(entry, forbidden) {
  const graph = reachableImports(entry);
  const violation = [...graph.entries()].find(([file]) => forbidden.some((part) => file.replaceAll("\\", "/").includes(part)));
  assert.equal(violation, undefined, violation && `Forbidden reachable path: ${violation[1].map((file) => file.replace(root, "").replaceAll("\\", "/")).join(" -> ")}`);
}

test("Primitives has a pure UI transitive closure", () => assertClosure(join(root, "src/features/shared/Primitives.tsx"), ["/data/", "/persistence", "/analytics", "/release-context", "/features/buyer/", "/features/seller/", "/domain/auction", "/domain/marketplace", "/domain/simulation", "/domain/seller"]));
test("ProductBuilder cannot reach buyer, seller, persistence, or business workbenches", () => assertClosure(join(root, "src/features/shared/ProductBuilder.tsx"), ["/features/buyer/", "/features/seller/", "/persistence", "/analytics", "/release-context", "/domain/seller", "/domain/marketplace"]));

test("closure diagnostics include the complete shortest forbidden path", () => {
  const fixture = mkdtempSync(join(tmpdir(), "colorbreak-closure-"));
  try {
    writeFileSync(join(fixture, "entry.ts"), 'import "./middle";');
    writeFileSync(join(fixture, "middle.ts"), 'import "./forbidden";');
    writeFileSync(join(fixture, "forbidden.ts"), "export const bad = true;");
    assert.throws(() => assertClosure(join(fixture, "entry.ts"), ["/forbidden.ts"]), /entry\.ts -> .*middle\.ts -> .*forbidden\.ts/);
  } finally { rmSync(fixture, { recursive: true, force: true }); }
});
