import type { BreakLine, ProductChoice } from "./types";

/**
 * Sealed product keys — `play-booster-pack`, `collector-booster-box` — are
 * unique inside one set document and nowhere else.  Marvel Super Heroes and
 * Edge of Eternities each publish a `play-booster-pack`, so a product key on
 * its own never identifies a break line: the set is half of the identity.
 *
 * Every "which line is this product?" question in the app resolves through
 * this module so identity cannot drift between adding, merging, editing,
 * removing, sharing, and restoring.
 */

/** The stored `productKey` for a catalog choice. Set-scoped only with its set. */
export function productKeyForChoice(product: Pick<ProductChoice, "key" | "sealedKey">): string {
  return product.sealedKey ? `sealed:${product.sealedKey}` : product.key;
}

/** The canonical, set-scoped identity of one product line. */
export function breakLineKey(line: Pick<BreakLine, "set" | "productKey">): string {
  return `${line.set.trim().toUpperCase()}|${line.productKey.trim()}`;
}

/** The identity the given catalog choice would take as a break line. */
export function breakLineKeyForChoice(product: Pick<ProductChoice, "set" | "key" | "sealedKey">): string {
  return breakLineKey({ set: product.set, productKey: productKeyForChoice(product) });
}

/** The existing line for this catalog choice, matched on set *and* product. */
export function findBreakLineForChoice(
  lines: readonly BreakLine[],
  product: Pick<ProductChoice, "set" | "key" | "sealedKey">,
): BreakLine | undefined {
  const key = breakLineKeyForChoice(product);
  return lines.find((line) => breakLineKey(line) === key);
}

/**
 * Collapses repeats of the same set-and-product into one line, adding their
 * quantities.  Different sets never merge, however identical their product
 * names or sealed keys are.
 */
export function mergeBreakLines(lines: BreakLine[]): BreakLine[] {
  const merged = new Map<string, BreakLine>();
  for (const line of lines) {
    const key = breakLineKey(line);
    const current = merged.get(key);
    if (current) current.quantity += line.quantity;
    else merged.set(key, { ...line, set: line.set.trim().toUpperCase() });
  }
  return [...merged.values()];
}
