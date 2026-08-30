import { defineConfig } from "vitest/config";

// The runner selects only suites authored for Vitest; node:test suites are
// executed by tools/run-root-mjs-tests.mjs.
export default defineConfig({
  test: {
    include: ["test/**/*.test.mjs"],
    pool: "forks",
    maxWorkers: 1,
    fileParallelism: false,
    environment: "node",
  },
});
