import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile, readdir, stat } from "node:fs/promises";
import { dirname, extname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const output = join(root, "dist");
const deploymentBase = "/ColorBreak/";

const contentTypes = {
  ".css": "text/css",
  ".html": "text/html",
  ".js": "text/javascript",
  ".json": "application/json",
  ".svg": "image/svg+xml",
};

async function builtArtifactExists() {
  try {
    return (await stat(join(output, "index.html"))).isFile();
  } catch {
    return false;
  }
}

async function serveArtifact() {
  const server = createServer(async (request, response) => {
    const url = new URL(request.url ?? deploymentBase, "http://127.0.0.1");
    if (!url.pathname.startsWith(deploymentBase)) {
      response.writeHead(404).end();
      return;
    }
    const relative = decodeURIComponent(url.pathname.slice(deploymentBase.length));
    const candidate = resolve(output, relative || "index.html");
    if (!candidate.startsWith(`${output}\\`) && candidate !== output) {
      response.writeHead(400).end();
      return;
    }
    try {
      const file = (await stat(candidate)).isDirectory() ? join(candidate, "index.html") : candidate;
      const body = await readFile(file);
      response.writeHead(200, { "content-type": contentTypes[extname(file)] ?? "application/octet-stream" }).end(body);
    } catch {
      response.writeHead(404).end();
    }
  });
  await new Promise((done) => server.listen(0, "127.0.0.1", done));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Could not start the smoke-test server.");
  return { server, origin: `http://127.0.0.1:${address.port}` };
}

async function fetchText(origin, path) {
  const response = await fetch(`${origin}${path}`);
  return { response, text: await response.text() };
}

test("built static documents work when ColorBreak is deployed under a subpath", async (t) => {
  if (!await builtArtifactExists()) {
    t.skip("Run this suite after `npm run build` (the normal check command does this).");
    return;
  }

  const { server, origin } = await serveArtifact();
  t.after(() => server.close());

  for (const [file, heading] of [["methodology.html", "Methodology"], ["privacy.html", "Privacy"]]) {
    const { response, text } = await fetchText(origin, `${deploymentBase}${file}`);
    assert.equal(response.status, 200, `${file} should be served from the deployment base`);
    assert.match(text, new RegExp(`<h1>${heading}</h1>`));

    const returnHref = text.match(/<a\s+href="([^"]+)"[^>]*>← ColorBreak<\/a>/)?.[1];
    assert.ok(returnHref, `${file} needs a ColorBreak return link`);
    const resolvedReturn = new URL(returnHref, `${origin}${deploymentBase}${file}`);
    assert.equal(resolvedReturn.pathname, deploymentBase, `${file} return link must stay under the deployment base`);
    assert.equal((await fetch(resolvedReturn)).status, 200);
  }
});

test("built app bundle does not retain root-relative privacy or methodology paths", async (t) => {
  if (!await builtArtifactExists()) {
    t.skip("Run this suite after `npm run build` (the normal check command does this).");
    return;
  }

  const assets = await readdir(join(output, "assets"));
  const scripts = await Promise.all(assets.filter((asset) => asset.endsWith(".js")).map((asset) => readFile(join(output, "assets", asset), "utf8")));
  const bundle = scripts.join("\n");
  assert.match(bundle, /methodology\.html/);
  assert.match(bundle, /privacy\.html/);
  assert.doesNotMatch(bundle, /["']\/methodology\.html/);
  assert.doesNotMatch(bundle, /["']\/privacy\.html/);
});
