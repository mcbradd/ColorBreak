import type { ProductChoice, SetChoice } from "../domain/types";
import { choicesFromSealed, expectedDraws, loadSealed } from "./sealed";

interface CatalogFile {
  sets: Record<string, {
    name: string;
    released: string;
    groupId: number;
    products: Array<{ id?: number; key: string; label: string; packType: string; packs: number; unit: string }>;
  }>;
}

let catalogPromise: Promise<CatalogFile> | null = null;

export async function loadCatalog(): Promise<CatalogFile> {
  catalogPromise ??= fetch("data/products.json").then((response) => {
    if (!response.ok) throw new Error(`Product catalog: HTTP ${response.status}`);
    return response.json() as Promise<CatalogFile>;
  });
  return catalogPromise;
}

function categoryOf(unit: string): ProductChoice["category"] {
  if (unit === "box") return "box";
  if (unit === "pack") return "pack";
  if (unit === "bundle") return "bundle";
  if (unit === "prerelease") return "prerelease";
  if (unit === "case") return "case";
  return "specialty";
}

export async function productsForSet(set: string): Promise<ProductChoice[]> {
  const code = set.toUpperCase();
  const [catalog, sealed] = await Promise.all([loadCatalog(), loadSealed(code)]);
  if (sealed) {
    return Promise.all(choicesFromSealed(sealed).map(async (choice) => ({
      ...choice,
      status: (await expectedDraws(sealed, choice.sealedKey!, 1)).status,
    })));
  }
  const entry = catalog.sets[code];
  if (!entry) return [];
  return entry.products.map((product) => ({
    key: product.key,
    label: product.label,
    set: code,
    setName: entry.name,
    category: categoryOf(product.unit),
    packCount: product.packs,
    tcgId: product.id,
    status: "estimated",
  }));
}

export async function catalogSets(): Promise<SetChoice[]> {
  const catalog = await loadCatalog();
  return Object.entries(catalog.sets).map(([code, set]) => ({
    code, name: set.name, released: set.released, type: "catalog",
  }));
}
