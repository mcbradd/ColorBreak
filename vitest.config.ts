import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts", "test/*sealed*.test.mjs"],
    pool: "forks",
    maxWorkers: 1,
    fileParallelism: false,
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
  },
});
