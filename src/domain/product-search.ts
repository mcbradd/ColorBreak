import { compareProducts } from "./product-order";
import type { ProductChoice, SetChoice } from "./types";

export interface ProductSearchSet extends SetChoice {
  products: ProductChoice[];
  hasSealed: boolean;
}

/** Prefix matching keeps partial product names useful while the user types. */
export function searchWords(value: string): string[] {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[’']/g, "").replace(/[^a-z0-9]+/g, " ").trim().split(/\s+/).filter(Boolean)
    .map((word) => ({ boxes: "box", display: "box", displays: "box", packs: "pack", boosters: "booster", collectors: "collector", bundles: "bundle", cases: "case" })[word] ?? word);
}

const productWords = searchWords("play collector draft set booster box pack bundle gift prerelease case starter commander deck kit scene jumpstart value sample sampler omega beyond box topper premium collection festival collector sample special edition");
const stopWords = new Set(["the", "of", "in", "a", "and", "for", "to"]);
const matches = (word: string, haystack: readonly string[]) => haystack.some((candidate) => candidate.startsWith(word));

/**
 * Rank metadata first, so a search never downloads the whole sealed catalog.
 * A recognized set name/code also permits specialty product words absent from
 * the small legacy index; its exact product document resolves those words.
 */
export function rankSearchSets(sets: readonly ProductSearchSet[], query: string, limit = 4): ProductSearchSet[] {
  const words = searchWords(query).filter((word) => !stopWords.has(word));
  if (!words.length) return [];
  const today = new Date().toISOString().slice(0, 10);
  const knownProductWords = [...productWords, ...sets.flatMap((set) => set.products.flatMap((product) => searchWords(product.label)))];
  return sets.map((set) => {
    const setWords = searchWords(`${set.code} ${set.name}`);
    const code = set.code.toLowerCase();
    const exactCode = words.includes(code);
    const completeName = searchWords(set.name).filter((word) => !stopWords.has(word))
      .every((word) => words.some((queryWord) => word.startsWith(queryWord)));
    const nameMatches = words.filter((word) => matches(word, setWords));
    const distinctiveMatches = nameMatches.filter((word) => !matches(word, productWords));
    const productOnly = words.every((word) => matches(word, knownProductWords));
    const allKnown = words.every((word) => matches(word, setWords) || matches(word, knownProductWords));
    const eligible = exactCode || (distinctiveMatches.length > 0 && (allKnown || completeName || words.length <= 4)) || productOnly;
    return { set, score: eligible ? (exactCode ? 100 : 0) + distinctiveMatches.length * 15 + nameMatches.length * 3 + (set.released <= today ? 1 : 0) : -1 };
  }).filter(({ score }) => score >= 0)
    .sort((a, b) => b.score - a.score || b.set.released.localeCompare(a.set.released) || a.set.name.localeCompare(b.set.name))
    .slice(0, limit).map(({ set }) => set);
}

export function matchingProducts(products: readonly ProductChoice[], query: string): ProductChoice[] {
  const words = searchWords(query).filter((word) => !stopWords.has(word));
  return products.filter((product) => {
    const haystack = searchWords(`${product.set} ${product.setName} ${product.label} ${product.category}`);
    return words.every((word) => matches(word, haystack));
  }).sort(compareProducts);
}

export function suggestedSearchSets(sets: readonly ProductSearchSet[], currentSets: readonly string[], today = new Date().toISOString().slice(0, 10)): ProductSearchSet[] {
  const recent = [...sets].filter((set) => set.released <= today)
    .sort((a, b) => b.released.localeCompare(a.released));
  const byCode = new Map(sets.map((set) => [set.code, set]));
  const codes = [...new Set([...currentSets, ...recent.map((set) => set.code)])];
  return codes.flatMap((code) => byCode.has(code) ? [byCode.get(code)!] : []).slice(0, 4);
}
