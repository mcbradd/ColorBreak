import { cp, mkdir } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { validatePublicConfig } from "./tools/public-config.mjs";
import { stageOcrAssets } from "./tools/stage-ocr-assets.mjs";

export default defineConfig(({ mode }) => ({
  base: "./",
  define: mode === "test" ? {} : {
    __COLORBREAK_BUILD_ID__: JSON.stringify(process.env.GITHUB_SHA ?? execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim()),
  },
  plugins: [
    {
      name: "colorbreak-public-config",
      config() {
        if (mode !== "test") validatePublicConfig(process.env);
      },
    },
    {
      // Stages the self-hosted OCR engine into `public/` before Vite copies
      // that directory, so the screenshot import never reaches a third-party
      // CDN at runtime. Runs for `dev` too, so the local server serves the
      // same same-origin paths the deployment does.
      name: "colorbreak-ocr-assets",
      async buildStart() {
        if (mode !== "test") await stageOcrAssets();
      },
    },
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
