import type { ProductChoice, SetChoice } from "../domain/types";
import { choicesFromSealed, expectedDraws, loadSealed } from "./sealed";
import { loadPrices } from "./scryfall";
import { calculateBreak } from "../domain/valuation";
import { decisionReadiness, type DecisionReadiness } from "../domain/decision-readiness";

interface CatalogFile {
  sets: Record<string, {
    name: string;
    released: string;
    groupId: number;
    products: Array<{ id?: number; key: string; label: string; packType: string; packs: number; unit: string }>;
  }>;
}

let catalogPromise: Promise<CatalogFile> | null = null;
let sealedIndexPromise: Promise<{
  documents?: Array<{ code: string; name: string; released: string; products: number }>;
}> | null = null;

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

/** Local-first catalog adapter for a single prospective product.  Picker code
 * can call this deliberately; it never repairs a snapshot miss with Scryfall. */
export async function readinessForProduct(product: ProductChoice, now?: number | Date): Promise<DecisionReadiness> {
  const sealed = await loadSealed(product.set);
  if (!sealed || !product.sealedKey) return decisionReadiness({ contentsStatus: product.status, now });
  const expected = await expectedDraws(sealed, product.sealedKey, 1);
  const prices = await loadPrices({
    sets: [...new Set(expected.draws.map((draw) => draw.set))],
    printings: expected.draws.map((draw) => ({ set: draw.set, collectorNumber: draw.collectorNumber })),
  });
  const valuation = calculateBreak({ draws: expected.draws, prices: prices.cards, omissions: [...expected.omissions, ...prices.omissions], sourceStatus: expected.status, pricedAt: prices.availability.observedAt, priceSource: prices.availability.source });
  return decisionReadiness({ contentsStatus: valuation.status, priceObservedAt: valuation.pricedAt, materialOmissions: valuation.omissions, now });
}

export async function catalogSets(): Promise<SetChoice[]> {
  const [catalog, sealedIndex] = await Promise.all([
    loadCatalog(),
    sealedIndexPromise ??= fetch("data/sealed/index.json").then((response) =>
      response.ok ? response.json() : { documents: [] },
    ),
  ]);
  const choices = new Map(Object.entries(catalog.sets).map(([code, set]) => [code, ({
    code, name: set.name, released: set.released, type: "catalog",
  } satisfies SetChoice)]));
  for (const document of sealedIndex.documents ?? []) {
    choices.set(document.code, {
      code: document.code,
      name: document.name,
      released: document.released,
      type: "exact-sealed",
    });
  }
  return [...choices.values()];
}
