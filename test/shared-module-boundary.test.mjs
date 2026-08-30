import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join, relative, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const builderPath = join(root, "src", "features", "shared", "ProductBuilder.tsx");

test("shared product builder keeps a narrow, used import boundary", () => {
  const source = readFileSync(builderPath, "utf8");
  const importSources = [...source.matchAll(/\bfrom\s+["']([^"']+)["']/g)].map((match) => match[1]).sort();

  assert.deepEqual(importSources, [
    "../../data/catalog",
    "../../data/ready-examples",
    "../../domain/break-import",
    "../../domain/decision-readiness",
    "../../domain/manual-budget",
    "../../domain/share-url",
    "../../domain/types",
    "./Primitives",
    "lucide-react",
    "motion/react",
    "react",
    "react-dom",
  ]);
  assert.doesNotMatch(source, /\.\.\/buyer\//);
  assert.doesNotMatch(source, /\.\.\/seller\//);
});

test("shared product builder has no unused local imports", () => {
  const result = spawnSync(
    process.execPath,
    [join(root, "node_modules", "typescript", "bin", "tsc"), "-p", "tsconfig.app.json", "--noEmit", "--noUnusedLocals"],
    { cwd: root, encoding: "utf8" },
  );
  const target = relative(root, builderPath).replaceAll("\\", "/");
  const diagnostics = `${result.stdout}\n${result.stderr}`
    .replaceAll("\\", "/")
    .split(/\r?\n/)
    .filter((line) => line.startsWith(target));

  assert.deepEqual(diagnostics, [], diagnostics.join("\n"));
});
