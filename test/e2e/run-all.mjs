// Runs every e2e scenario in order; nonzero exit on any failure.
// Suite bootstrap asserts the standing G1/G2 gate helpers exist (S8a DoD),
// so no later suite can silently drop them.
import assert from "node:assert/strict";
import { assertG1, assertG2 } from "./harness.mjs";

assert.equal(typeof assertG1, "function", "standing gate G1 helper missing");
assert.equal(typeof assertG2, "function", "standing gate G2 helper missing");

const files = process.argv.slice(2).length ? process.argv.slice(2)
  : ["./s1-relays.mjs", "./s2-swr.mjs", "./s8a-gates.mjs"];

let failed = 0;
for (const f of files) {
  let mod;
  try { mod = await import(f); } catch (e) {
    if (e.code === "ERR_MODULE_NOT_FOUND") { console.log(`SKIP ${f} (not present yet)`); continue; }
    throw e;
  }
  for (const [name, fn] of Object.entries(mod.scenarios || {})) {
    const t0 = Date.now();
    try {
      await fn();
      console.log(`PASS ${f} :: ${name} (${Date.now() - t0} ms)`);
    } catch (e) {
      failed++;
      console.log(`FAIL ${f} :: ${name}\n  ${e.message}`);
    }
  }
}
console.log(failed ? `\n${failed} scenario(s) FAILED` : "\nall e2e scenarios passed");
process.exit(failed ? 1 : 0);
