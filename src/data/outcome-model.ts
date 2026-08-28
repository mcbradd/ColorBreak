import type { CardPrice, Finish, Omission } from "../domain/types";
import type { OutcomeCard, OutcomePack, PackOutcomeModel } from "../domain/simulation";
import { loadCorrections, loadSealed } from "./sealed";
import type { BoosterSheet, SealedDocument } from "./sealed";
import { isCollectorOutlierFinish } from "../domain/outlier-policy";
import { cardDisplayName } from "../domain/card-label";
import { resolveCardPrice } from "../domain/card-price";

export interface OutcomeModelResult {
  model: PackOutcomeModel;
  omissions: Omission[];
}

function pricedCard(
  set: string,
  collectorNumber: string,
  finish: Finish,
  prices: Map<string, CardPrice>,
  threshold: number,
  weight: number,
  omissions: Omission[],
  expectedCopies = Number.POSITIVE_INFINITY,
): OutcomeCard | null {
  const card = prices.get(`${set}|${collectorNumber}`);
  if (!card) {
    omissions.push({
      code: "missing-printing",
      dedupeKey: `printing:${set}|${collectorNumber}`,
      message: `${set} ${collectorNumber} is absent from the price source.`,
      material: true,
    });
    return null;
  }
  if (isCollectorOutlierFinish(finish)) {
    omissions.push({
      code: "collector-outlier-excluded",
      message: `${cardDisplayName(card, finish)} is retained in its pull slot but excluded from buyer decision ranges.`,
      expectedCards: expectedCopies,
      material: false,
    });
    return { id: `${card.id}:${finish}`, slot: card.slot, value: 0, weight };
  }
  const resolvedPrice = resolveCardPrice(card, finish);
  if (resolvedPrice == null) {
    omissions.push({
      code: finish === "nonfoil" ? "missing-price" : `missing-${finish}-price`,
      dedupeKey: `price:${set}|${collectorNumber}|${finish}`,
      message: `${cardDisplayName(card, finish)} has neither a treatment-specific market price nor a listed TCG price for this printing and foil class. Its value is modeled as $0.00, so the outcome range may be too low.`,
      expectedCards: expectedCopies,
      material: expectedCopies >= 0.01,
    });
    // Preserve the printing's exact weight and color assignment. Removing it
    // would redistribute its pull chance across the other cards and overstate
    // their odds. Zero is an explicit lower bound, never a finish-price proxy.
    return { id: `${card.id}:${finish}`, slot: card.slot, value: 0, weight };
  }
  const value = resolvedPrice.amount;
  return { id: `${card.id}:${finish}`, slot: card.slot, value: value >= threshold ? value : 0, weight };
}

function sheetCards(
  owner: string,
  sheetName: string,
  sheet: BoosterSheet,
  prices: Map<string, CardPrice>,
  threshold: number,
  omissions: Omission[],
  expectedSheetCopies: number,
): OutcomeCard[] {
  const finish: Finish = sheet.finish ?? (sheet.foil ? "foil" : "nonfoil");
  const cards: OutcomeCard[] = [];
  for (const tuple of sheet.cards) {
    const [set, collectorNumber, weight] = tuple.length === 3
      ? tuple
      : [owner, tuple[0], tuple[1]];
    const expectedCopies = sheet.total > 0 ? expectedSheetCopies * Number(weight) / sheet.total : expectedSheetCopies;
    const card = pricedCard(String(set).toUpperCase(), String(collectorNumber), finish, prices, threshold, Number(weight), omissions, expectedCopies);
    if (card) cards.push(card);
  }
  if (sheet.missing) {
    omissions.push({
      code: "missing-sheet-weight",
      message: `${sheetName} contains unresolved printing weight.`,
      expectedCards: sheet.missing / sheet.total,
      material: true,
    });
  }
  if (sheet.balanceColors) {
    omissions.push({
      code: "unsupported-color-balancing",
      message: `${sheetName} uses color balancing that is not yet preserved by the simulator.`,
      material: true,
    });
  }
  return cards;
}

export async function outcomeModelForProduct(
  document: SealedDocument,
  productKey: string,
  quantity: number,
  cardPrices: CardPrice[],
  threshold: number,
  foreign: Record<string, SealedDocument | null> = {},
): Promise<OutcomeModelResult> {
  const product = document.products.find((candidate) => candidate.key === productKey);
  if (!product) {
    const omissions = [{
      code: "missing-product", message: `${document.set} ${productKey} has no sealed contents record.`, material: true,
    } satisfies Omission];
    return { model: { fixed: [], packs: [], complete: false }, omissions };
  }

  const corrections = await loadCorrections();
  const correction = corrections.products[`${document.set}/${product.key}`];
  const multiplier = (correction?.contentsMultiplier ?? 1) * quantity;
  const packs = { ...product.packs };
  for (const code of correction?.removePacks ?? []) delete packs[code];
  for (const [code, count] of Object.entries(correction?.addPacks ?? {})) packs[code] = (packs[code] ?? 0) + count;

  const omissions: Omission[] = [];
  const prices = new Map(cardPrices.map((card) => [`${card.set}|${card.collectorNumber}`, card]));
  const fixed: OutcomeCard[] = [];
  for (const item of product.fixed ?? []) {
    const finish: Finish = item.finish ?? (item.foil ? "foil" : "nonfoil");
    const card = pricedCard(item.set.toUpperCase(), String(item.cn), finish, prices, threshold, 1, omissions, item.n * multiplier);
    if (card) fixed.push({ ...card, count: item.n * multiplier });
  }

  const outcomePacks: OutcomePack[] = [];
  for (const [packCode, unitCount] of Object.entries(packs)) {
    const split = packCode.indexOf(":");
    const owner = split < 0 ? document.set : packCode.slice(0, split).toUpperCase();
    const bareCode = split < 0 ? packCode : packCode.slice(split + 1);
    const packDocument = split < 0 ? document : (foreign[owner] ?? await loadSealed(owner));
    const booster = packDocument?.boosters[bareCode];
    if (!booster?.variants?.length) {
      omissions.push({
        code: "missing-booster-variants",
        message: `${unitCount}× ${owner} ${bareCode} booster has no generative collation variants.`,
        expectedCards: unitCount * multiplier,
        material: true,
      });
      continue;
    }
    const sheets = Object.fromEntries(Object.entries(booster.sheets).map(([name, sheet]) => [name, {
      totalWeight: sheet.total,
      cards: sheetCards(
        owner,
        `${packCode}/${name}`,
        sheet,
        prices,
        threshold,
        omissions,
        unitCount * multiplier * (booster.picks[name] ?? 0),
      ),
      allowDuplicates: sheet.allowDuplicates,
    }]));
    outcomePacks.push({
      count: unitCount * multiplier,
      variants: booster.variants,
      sheets,
    });
  }

  for (const prose of product.other ?? []) {
    if (/\b(cards?|lands?)\b/i.test(prose) && !/storage|\bbox\b|sleeve|display|walk[ -]?through|reference|arena code|helper|art[ -]?only|dungeon/i.test(prose)) {
      omissions.push({ code: "prose-only-contents", message: `${prose} has no exact card list.`, material: true });
    }
  }
  for (const unresolved of product.unresolvedContents ?? []) {
    omissions.push({
      code: "unresolved-fixed-printing",
      message: `${unresolved.n}× ${unresolved.label} (${unresolved.finish}) has no verified collector-number distribution: ${unresolved.reason}`,
      expectedCards: unresolved.n * multiplier,
      material: true,
    });
  }
  if (product.suspect && !correction?.contentsMultiplier) {
    omissions.push({ code: "suspect-contents", message: product.suspect, material: true });
  }
  return {
    model: { fixed, packs: outcomePacks, complete: !omissions.some((item) => item.material) },
    omissions,
  };
}
