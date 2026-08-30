import assert from "node:assert/strict";
import test from "node:test";
import { validatePublicConfig } from "../tools/public-config.mjs";

test("public optional endpoints are blank or source-controlled HTTPS origins", () => {
  assert.doesNotThrow(() => validatePublicConfig({}));
  assert.doesNotThrow(() => validatePublicConfig({
    VITE_ANALYTICS_ENDPOINT: "https://plausible.io/api/event",
    VITE_SUPPORT_URL: "https://ko-fi.com/colorbreak",
    VITE_TCGPLAYER_AFFILIATE_URL: "https://www.tcgplayer.com/search/product?productLineName=magic&productName={card}",
  }));
  for (const [name, value] of Object.entries({
    VITE_ANALYTICS_ENDPOINT: "http://plausible.io/event",
    VITE_SUPPORT_URL: "https://user:pass@github.com/colorbreak",
    VITE_TCGPLAYER_AFFILIATE_URL: "https://example.com/?card={card}",
  })) assert.throws(() => validatePublicConfig({ [name]: value }), /approved HTTPS origin/);
});

test("Pages workflow verifies and publishes the built artifact", async () => {
  const workflow = await import("node:fs/promises").then(({ readFile }) => readFile(new URL("../.github/workflows/deploy-pages.yml", import.meta.url), "utf8"));
  assert.match(workflow, /verifyReleaseArtifact\(\{ outputDir: '\.\/dist' \}\)/);
  assert.match(workflow, /Release manifest:/);
  assert.match(workflow, /path: dist/);
});
