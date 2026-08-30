import type { BreakLine } from "./domain/types";

const VERSION = 1;
export const sessionKey = (mode: "buyer" | "seller") => `colorbreak:${mode}:draft:v${VERSION}`;
export const rememberedKey = "colorbreak:buyer:composition:v1";

/** Only non-financial composition is ever allowed to leave session storage. */
export function compositionProjection(lines: BreakLine[]) {
  return lines.map(({ id, set, productKey, productLabel, quantity, tcgId, packCount }) =>
    ({ id, set, productKey, productLabel, quantity, tcgId, packCount }));
}

export function readSessionLines(mode: "buyer" | "seller"): BreakLine[] {
  try { return JSON.parse(sessionStorage.getItem(sessionKey(mode)) ?? "[]") as BreakLine[]; } catch { return []; }
}

export function writeSessionLines(mode: "buyer" | "seller", lines: BreakLine[]) {
  try { sessionStorage.setItem(sessionKey(mode), JSON.stringify(lines)); } catch { /* optional */ }
}

/** Remove the former durable drafts, especially seller cost records, before any new write. */
export function cleanupLegacyStorage(): boolean {
  let removed = false;
  try {
    for (const mode of ["buyer", "seller"] as const) {
      const key = `colorbreak:${mode}:lines`;
      if (localStorage.getItem(key) != null) { localStorage.removeItem(key); removed = true; }
    }
    for (const key of ["colorbreak:buyer:auction", "colorbreak:buyer:large-spots"]) {
      if (localStorage.getItem(key) != null) { localStorage.removeItem(key); removed = true; }
    }
  } catch { /* storage is optional */ }
  return removed;
}
