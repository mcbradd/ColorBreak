import type { DataStatus, ExpectedDraw, Omission, ProductChoice } from "../domain/types";

export interface SealedProduct {
  key: string;
  label: string;
  name: string;
  category: string;
  tcgId?: number;
  packs: Record<string, number>;
  fixed?: Array<{ set: string; cn: string; n: number; foil: boolean }>;
  other?: string[];
  suspect?: string;
}

export interface BoosterSheet {
  foil: boolean;
  finish?: import("../domain/types").Finish;
  total: number;
  missing?: number;
  allowDuplicates?: boolean;
  balanceColors?: boolean;
  cards: Array<[string, number] | [string, string, number]>;
}

export interface Booster {
  picks: Record<string, number>;
  variants: Array<{ weight: number; picks: Record<string, number> }>;
  sheets: Record<string, BoosterSheet>;
}

export interface SealedDocument {
  v: number;
  set: string;
  name: string;
  released: string;
  src: { mtgjson: string; mtgjsonDate: string; builtAt: string };
  products: SealedProduct[];
  boosters: Record<string, Booster>;
}

export interface Correction {
  addPacks?: Record<string, number>;
  removePacks?: string[];
  contentsMultiplier?: number;
  source: string;
  reason: string;
}

export interface CorrectionsFile {
  version: number;
  verifiedAt: string;
  products: Record<string, Correction>;
}

let correctionsPromise: Promise<CorrectionsFile> | null = null;
const sealedCache = new Map<string, Promise<SealedDocument | null>>();

export function releaseStatus(released: string, asOf = new Date().toISOString().slice(0, 10)): DataStatus {
  return released > asOf ? "estimated" : "verified";
}

async function json<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return response.json() as Promise<T>;
}

export function loadCorrections(): Promise<CorrectionsFile> {
  correctionsPromise ??= json<CorrectionsFile>("data/corrections.json");
  return correctionsPromise;
}

export function loadSealed(set: string): Promise<SealedDocument | null> {
  const code = set.toUpperCase();
  if (!sealedCache.has(code)) {
    sealedCache.set(code, fetch(`data/sealed/${code}.json`).then(async (response) => {
      if (response.status === 404) return null;
      if (!response.ok) throw new Error(`Sealed data for ${code}: HTTP ${response.status}`);
      return response.json() as Promise<SealedDocument>;
    }).catch(() => null));
  }
  return sealedCache.get(code)!;
}

function categoryOf(product: SealedProduct): ProductChoice["category"] {
  if (/case/.test(product.category)) return "case";
  if (product.category === "booster_box") return "box";
  if (product.category === "booster_pack") return "pack";
  if (/bundle/.test(product.category)) return "bundle";
  if (product.category === "limited_aid_tool") return "prerelease";
  return "specialty";
}

export function choicesFromSealed(document: SealedDocument): ProductChoice[] {
  return document.products.map((product) => ({
    key: product.key,
    label: product.label,
    set: document.set,
    setName: document.name,
    category: categoryOf(product),
    packCount: Object.values(product.packs).reduce((sum, count) => sum + count, 0),
    tcgId: product.tcgId,
    sealedKey: product.key,
    status: (product.suspect ? "incomplete" : releaseStatus(document.released)) as DataStatus,
  })).sort((a, b) => {
    const rank = { common: 0, box: 1, pack: 2, bundle: 3, prerelease: 4, specialty: 5, case: 6 };
    return rank[a.category] - rank[b.category] || a.label.localeCompare(b.label);
  });
}

const CARDLIKE_PROSE = /\b(cards?|lands?)\b/i;
const ACCESSORY_PROSE = /storage|\bbox\b|sleeve|display|walk-?through|reference|arena code|helper|art-only|dungeon/i;

export async function expectedDraws(
  document: SealedDocument,
  productKey: string,
  quantity: number,
  foreign: Record<string, SealedDocument | null> = {},
): Promise<{ draws: ExpectedDraw[]; omissions: Omission[]; status: DataStatus; sources: string[] }> {
  const product = document.products.find((candidate) => candidate.key === productKey);
  if (!product) {
    return {
      draws: [],
      omissions: [{ code: "missing-product", message: `${document.set} ${productKey} has no sealed contents record.`, material: true }],
      status: "incomplete",
      sources: [],
    };
  }
  const corrections = await loadCorrections();
  const correction = corrections.products[`${document.set}/${product.key}`];
  const multiplier = (correction?.contentsMultiplier ?? 1) * quantity;
  const packs = { ...product.packs };
  for (const code of correction?.removePacks ?? []) delete packs[code];
  for (const [code, count] of Object.entries(correction?.addPacks ?? {})) packs[code] = (packs[code] ?? 0) + count;
  const draws: ExpectedDraw[] = [];
  const omissions: Omission[] = [];
  for (const fixed of product.fixed ?? []) {
    draws.push({
      set: fixed.set.toUpperCase(), collectorNumber: String(fixed.cn),
      copies: fixed.n * multiplier, foil: fixed.foil, source: `${product.key}/fixed`,
      pullProbability: fixed.n * multiplier > 0 ? 1 : 0,
    });
  }
  for (const [packCode, unitCount] of Object.entries(packs)) {
    const split = packCode.indexOf(":");
    const owner = split < 0 ? document.set : packCode.slice(0, split).toUpperCase();
    const bareCode = split < 0 ? packCode : packCode.slice(split + 1);
    const packDocument = split < 0 ? document : (foreign[owner] ?? await loadSealed(owner));
    const booster = packDocument?.boosters[bareCode];
    if (!booster) {
      omissions.push({
        code: "missing-booster",
        message: `${unitCount}× ${owner} ${bareCode} booster has no parsed collation.`,
        expectedCards: unitCount * multiplier,
        material: true,
      });
      continue;
    }
    for (const [sheetName, picks] of Object.entries(booster.picks)) {
      const sheet = booster.sheets[sheetName];
      if (!sheet?.total) continue;
      for (const tuple of sheet.cards) {
        const [set, collectorNumber, weight] = tuple.length === 3
          ? tuple
          : [owner, tuple[0], tuple[1]];
        draws.push({
          set: String(set).toUpperCase(),
          collectorNumber: String(collectorNumber),
          copies: unitCount * multiplier * picks * Number(weight) / sheet.total,
          pullProbability: 1 - Math.pow(
            1 - Number(weight) / sheet.total,
            unitCount * multiplier * picks,
          ),
          foil: sheet.foil,
          finish: sheet.finish ?? (sheet.foil ? "foil" : "nonfoil"),
          source: `${product.key}/${packCode}/${sheetName}`,
        });
      }
      if (sheet.missing) {
        omissions.push({
          code: "missing-sheet-weight",
          message: `${packCode}/${sheetName} contains unresolved printing weight.`,
          expectedCards: unitCount * multiplier * picks * sheet.missing / sheet.total,
          material: true,
        });
      }
    }
  }
  for (const prose of product.other ?? []) {
    if (CARDLIKE_PROSE.test(prose) && !ACCESSORY_PROSE.test(prose)) {
      omissions.push({
        code: "prose-only-contents",
        message: `${prose} is named by the product source but has no exact card list.`,
        material: true,
      });
    }
  }
  if (product.suspect && !correction?.contentsMultiplier) {
    omissions.push({ code: "suspect-contents", message: product.suspect, material: true });
  }
  return {
    draws,
    omissions,
    status: omissions.some((item) => item.material) ? "incomplete" : releaseStatus(document.released),
    sources: [
      `MTGJSON ${document.src.mtgjson} (${document.src.mtgjsonDate})`,
      ...(correction ? [correction.source] : []),
    ],
  };
}
