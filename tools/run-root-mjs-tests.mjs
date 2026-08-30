// Discover every root MJS suite, then route node:test and Vitest suites to the
// runner they were authored for. This keeps test discovery independent of shell
// glob behavior and prevents silently skipping a newly added root test.
import { readFile, readdir } from "node:fs/promises";
import { spawn } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

async function discover(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  return (await Promise.all(entries.map(async (entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return discover(path);
    return entry.isFile() && entry.name.endsWith(".test.mjs") ? [path] : [];
  }))).flat();
}

export async function discoveredRootMjsTests(root = ROOT) {
  return (await discover(join(root, "test"))).sort();
}

async function isNodeTest(path) {
  return (await readFile(path, "utf8")).includes('node:test');
}

function run(command, args) {
  return new Promise((done) => {
    const child = spawn(command, args, { cwd: ROOT, stdio: "inherit" });
    child.once("exit", (code) => done(code ?? 1));
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const tests = await discoveredRootMjsTests();
  if (!tests.length) throw new Error("No root MJS tests discovered.");
  const nodeTests = [];
  const vitestTests = [];
  for (const path of tests) (await isNodeTest(path) ? nodeTests : vitestTests).push(path);
  console.log(`Discovered ${tests.length} root MJS test files (${vitestTests.length} Vitest, ${nodeTests.length} node:test).`);
  if (process.argv.includes("--discovery-only")) process.exit(0);
  if (vitestTests.length) {
    const code = await run(process.execPath, [join(ROOT, "node_modules", "vitest", "vitest.mjs"), "run", "--config", "vitest.root-mjs.config.ts", ...vitestTests]);
    if (code) process.exit(code);
  }
  if (nodeTests.length) process.exitCode = await run(process.execPath, ["--test", ...nodeTests]);
}
