import { cp, mkdir } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig(({ mode }) => ({
  base: "./",
  define: mode === "test" ? {} : {
    __COLORBREAK_RELEASE_POSTURE__: JSON.stringify("analysis-only"),
  },
  plugins: [
    react(),
    {
      name: "colorbreak-static-data",
      async closeBundle() {
        const root = fileURLToPath(new URL(".", import.meta.url));
        const output = resolve(root, "dist");
        await mkdir(output, { recursive: true });
        await cp(resolve(root, "data"), resolve(output, "data"), { recursive: true });
        execFileSync(process.execPath, [resolve(root, "tools/build-release-manifest.mjs"), output], { stdio: "inherit" });
        execFileSync(process.execPath, ["-e", `import(${JSON.stringify(new URL("./tools/build-release-manifest.mjs", import.meta.url).href)}).then(m => m.verifyReleaseArtifact({ outputDir: ${JSON.stringify(output)} }))`], { stdio: "inherit" });
      },
    },
  ],
}));
