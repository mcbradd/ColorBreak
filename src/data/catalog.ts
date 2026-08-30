import type { ProductChoice, SetChoice } from "../domain/types";
import { choicesFromSealed, expectedDraws, loadSealed } from "./sealed";
import { prepareProductSelection } from "../domain/decision-evidence";
import type { DecisionReadiness } from "../domain/decision-readiness";
import type { BreakLine } from "../domain/types";

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
const readinessCache = new Map<string, Promise<DecisionReadiness>>();

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
  // The picker asks this for each row. Sharing the in-flight work avoids both
  // duplicate local snapshot reads and a thundering herd when a set is reopened.
  const cacheKey = `${product.set}:${product.sealedKey ?? product.key}`;
  if (now == null) {
    const cached = readinessCache.get(cacheKey);
    if (cached) return cached;
  }
  const work = readinessForProductUncached(product, now);
  if (now == null) readinessCache.set(cacheKey, work);
  return work;
}

async function readinessForProductUncached(product: ProductChoice, now?: number | Date): Promise<DecisionReadiness> {
  const line: BreakLine = {
    id: `catalog:${product.key}`,
    set: product.set,
    productKey: product.sealedKey ? `sealed:${product.sealedKey}` : product.key,
    productLabel: product.label,
    quantity: 1,
    packCount: product.packCount,
    tcgId: product.tcgId,
  };
  const assessment = await prepareProductSelection([line], 0, now);
  const status = assessment.assessment.eligibility.status;
  return {
    eligibility: status === "eligible" ? "ready" : status === "material-incomplete" ? "incomplete" : status,
    contentsStatus: assessment.assessment.analysis.valuation.status,
    priceObservedAt: assessment.assessment.observedAt,
    priceAgeMs: assessment.assessment.ageMs,
    freshnessThresholdMs: assessment.assessment.policyThresholdMs,
    materialBlockers: assessment.assessment.materialBlockers,
  };
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
