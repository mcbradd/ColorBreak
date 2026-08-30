import { cp, mkdir } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
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
      },
    },
  ],
});
