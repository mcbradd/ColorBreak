// Pure-block extraction harness (S0).
// index.html marks side-effect-free functions with // @pure ... // @end-pure.
// loadPure() lifts those blocks out of the page verbatim and returns them as a
// plain object, so `node --test test/` exercises the exact shipped code with
// no build step and no DOM.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export function loadPure(file = fileURLToPath(new URL("../index.html", import.meta.url))) {
  const src = readFileSync(file, "utf8");
  const blocks = [...src.matchAll(/^\/\/ @pure\r?\n([\s\S]*?)^\/\/ @end-pure/gm)].map(m => m[1]);
  if (!blocks.length) throw new Error("no @pure blocks found in " + file);
  const code = blocks.join("\n");
  // top-level declarations only (blocks are written at column 0)
  const names = [...code.matchAll(/^(?:function\s+([A-Za-z_$][\w$]*)|const\s+([A-Za-z_$][\w$]*)\s*=)/gm)]
    .map(m => m[1] || m[2]);
  if (!names.length) throw new Error("no top-level declarations in @pure blocks");
  return new Function('"use strict";' + code + ";return {" + [...new Set(names)].join(",") + "};")();
}
