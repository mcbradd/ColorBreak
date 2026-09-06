import type { ProductChoice } from "../domain/types";
import type { ProductSearchSet } from "../domain/product-search";
import { choicesFromSealed, type SealedDocument } from "./sealed";

interface ProductIndex {
  sets: Record<string, {
    name: string;
    released: string;
    products: Array<{ id?: number; key: string; label: string; packs: number; unit: string }>;
  }>;
}
interface SealedIndex {
  documents?: Array<{ code: string; name: string; released: string }>;
}

let indexPromise: Promise<ProductSearchSet[]> | undefined;
const productPromises = new Map<string, Promise<ProductChoice[]>>();

async function readJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`The product catalog could not load (${response.status}).`);
  return response.json() as Promise<T>;
}

/** Small metadata indexes only; no pricing, card sheets or valuation requests. */
export function loadProductSearchIndex(): Promise<ProductSearchSet[]> {
  indexPromise ??= Promise.all([
    readJson<ProductIndex>("data/products.json"),
    readJson<SealedIndex>("data/sealed/index.json"),
  ]).then(([catalog, sealed]) => {
    const sets = new Map<string, ProductSearchSet>();
    for (const [code, entry] of Object.entries(catalog.sets)) {
      sets.set(code, {
        code, name: entry.name, released: entry.released, type: "catalog", hasSealed: false,
        products: entry.products.map((product) => ({
          key: product.key, label: product.label, set: code, setName: entry.name,
          category: ["box", "pack", "bundle", "prerelease", "case"].includes(product.unit)
            ? product.unit as ProductChoice["category"] : "specialty",
          packCount: product.packs, tcgId: product.id, status: "estimated",
        })),
      });
    }
    for (const document of sealed.documents ?? []) {
      sets.set(document.code, {
        code: document.code, name: document.name, released: document.released,
        type: "exact-sealed", hasSealed: true, products: sets.get(document.code)?.products ?? [],
      });
    }
    return [...sets.values()];
  }).catch((error) => { indexPromise = undefined; throw error; });
  return indexPromise;
}

/**
 * Resolve exact product identity only after metadata narrows the relevant sets.
 * Choice labels can render before any break valuation or foreign sheet loads.
 * Failed loads are evicted so Retry can actually recover. A missing exact
 * document is an error, never a silent downgrade to a different product key.
 */
export function quickProductsForSet(set: ProductSearchSet): Promise<ProductChoice[]> {
  if (!set.hasSealed) return Promise.resolve(set.products);
  let request = productPromises.get(set.code);
  if (!request) {
    request = readJson<SealedDocument>(`data/sealed/${set.code}.json`)
      .then((document) => {
        if (document.set !== set.code) throw new Error("This product catalog does not match the selected set.");
        return choicesFromSealed(document);
      }).catch((error) => { productPromises.delete(set.code); throw error; });
    productPromises.set(set.code, request);
  }
  return request;
}
