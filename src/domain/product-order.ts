import type { ProductChoice } from "./types";

// Editorial break/wheel priority, not a claim of measured marketplace frequency.
const categoryRank: Record<ProductChoice["category"], number> = { pack: 0, box: 1, bundle: 2, prerelease: 3, specialty: 4, common: 5, case: 6 };
function specialtyRank(product: ProductChoice): number {
  if (product.category !== "specialty") return 0;
  if (/commander|deck/i.test(product.label) && !/starter/i.test(product.label)) return 0;
  if (/gift|collection|scene/i.test(product.label)) return 1;
  if (/starter|beginner/i.test(product.label)) return 2;
  return 3;
}
/** Shared by grouped pickers and the combined seller search. */
export function compareProducts(a: ProductChoice, b: ProductChoice): number {
  return categoryRank[a.category] - categoryRank[b.category] || specialtyRank(a) - specialtyRank(b)
    || a.label.localeCompare(b.label) || a.key.localeCompare(b.key);
}
