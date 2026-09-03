import { decodeLegacySearch } from "./legacy";
import type { BreakLine } from "./types";

export { mergeBreakLines } from "./break-line-identity";

export interface ParsedBreakLine {
  source: string;
  set: string;
  product: string;
  quantity: number;
}

export type BreakImportParseResult =
  | { kind: "url"; lines: BreakLine[] }
  | { kind: "list"; lines: ParsedBreakLine[]; errors: string[] };

const normalizeSpace = (value: string) => value.trim().replace(/\s+/g, " ");

export function parseBreakImport(source: string): BreakImportParseResult {
  const trimmed = source.trim();
  try {
    const url = new URL(trimmed);
    const lines = decodeLegacySearch(url.search);
    if (lines.length) return { kind: "url", lines };
  } catch {
    // Plain product lists are handled below.
  }

  const lines: ParsedBreakLine[] = [];
  const errors: string[] = [];
  for (const [index, raw] of trimmed.split(/\r?\n/).entries()) {
    const sourceLine = normalizeSpace(raw);
    if (!sourceLine) continue;
    const parts = sourceLine.split(/\s*[|,\t]\s*/).filter(Boolean);
    let set = "", product = "", quantityText = "";
    if (parts.length >= 3) {
      set = parts[0];
      quantityText = parts.at(-1) ?? "";
      product = parts.slice(1, -1).join(" ");
    } else {
      const match = sourceLine.match(/^([a-z0-9]{2,8})\s+(.+?)\s+(?:x|×)?\s*(\d+)$/i);
      if (match) [, set, product, quantityText] = match;
    }
    const quantity = Number.parseInt(quantityText, 10);
    if (!set || !product || !Number.isFinite(quantity) || quantity < 1 || quantity > 999) {
      errors.push(`Line ${index + 1}: use SET | PRODUCT | QUANTITY.`);
      continue;
    }
    lines.push({ source: raw.trim(), set: set.toUpperCase(), product: normalizeSpace(product), quantity });
  }
  if (!lines.length && !errors.length) errors.push("Paste a ColorBreak link or one product per line.");
  return { kind: "list", lines, errors };
}
