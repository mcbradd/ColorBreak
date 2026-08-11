import type { BreakLine } from "./types";

const LEGACY_PRODUCT: Record<string, string> = {
  play: "play-box", playUB: "play-box", collector: "collector-box",
  set: "set-box", draft: "draft-box",
};
const LEGACY_PACKS: Record<string, number> = { play: 36, playUB: 36, collector: 12, set: 30, draft: 36 };

export function decodeComposition(value: string): BreakLine[] {
  if (!value) return [];
  return value.split("~").flatMap((part, index) => {
    const [set, productKey, rawQuantity] = part.split(".");
    const quantity = Number.parseInt(rawQuantity, 10);
    if (!set || !productKey || !Number.isFinite(quantity) || quantity <= 0) return [];
    return [{
      id: `legacy-${index}-${set}-${productKey}`,
      set: set.toUpperCase(),
      productKey,
      productLabel: productKey,
      quantity: Math.min(quantity, 99),
    }];
  });
}

export function decodeLegacySearch(search: string): BreakLine[] {
  const params = new URLSearchParams(search);
  if (params.get("b")) return decodeComposition(params.get("b") ?? "");
  const set = params.get("set")?.trim().toUpperCase();
  const preset = params.get("preset") ?? "play";
  if (!set) return [];
  const productKey = LEGACY_PRODUCT[preset] ?? "play-box";
  return [{ id: `legacy-${set}-${productKey}`, set, productKey, productLabel: productKey.replaceAll("-", " "), quantity: 1, packCount: LEGACY_PACKS[preset] ?? 1 }];
}

export function encodeComposition(lines: BreakLine[]): string {
  return lines.map((line) => `${line.set}.${line.productKey}.${line.quantity}`).join("~");
}
