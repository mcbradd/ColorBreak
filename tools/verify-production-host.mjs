// Deliberately separate from the Pages byte check. A production host must opt
// into this evidence gate; absence is a release blocker, not a passing result.
const base = process.argv[2] ?? process.env.COLORBREAK_PRODUCTION_URL;
if (!base) throw new Error("COLORBREAK_PRODUCTION_URL is required for production-host verification");
const origin = new URL(base);
if (origin.protocol !== "https:") throw new Error("Production origin must use HTTPS");
const required = {
  "content-security-policy": /frame-ancestors\s+'none'/i,
  "x-content-type-options": /^nosniff$/i,
  "referrer-policy": /^(?:no-referrer|strict-origin-when-cross-origin)$/i,
  "permissions-policy": /camera=\(\).*microphone=\(\).*geolocation=\(\)/i,
  "cross-origin-opener-policy": /^same-origin$/i,
  "cross-origin-resource-policy": /^same-origin$/i,
};
const paths = ["./", "privacy.html", "methodology.html", "production-readiness.html", "manifest.webmanifest", "sw.js", "__colorbreak_missing__"];
const results = [];
for (const path of paths) {
  const response = await fetch(new URL(path, origin), { method: "HEAD", redirect: "error" });
  if (path === "__colorbreak_missing__" ? response.ok : !response.ok) throw new Error(`Unexpected ${response.status} for ${path}`);
  for (const [name, pattern] of Object.entries(required)) {
    const value = response.headers.get(name) ?? "";
    if (!pattern.test(value)) throw new Error(`${path} lacks required ${name}`);
  }
  results.push({ path, status: response.status });
}
console.log(JSON.stringify({ origin: origin.href, checkedAt: new Date().toISOString(), results }, null, 2));
