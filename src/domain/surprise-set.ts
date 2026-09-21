import type { BreakAnalysis } from "../data/evaluate";
import type { Contributor, SlotId, SlotValuation } from "./types";
import { SLOT_IDS } from "./types";
import { SLOT_NAMES } from "./types";

export interface SurpriseSetCard {
  id: string;
  slot: SlotId;
  name: string;
  value: number;
}

export function autofillStandardColorTeams(analysis: BreakAnalysis): SurpriseSetCard[] {
  return SLOT_IDS.flatMap((slot) => analysis.valuation.slots
    .find((team) => team.id === slot)?.contributors.flatMap((contributor) => {
      const value = contributor.marketPrice ?? (contributor.copies > 0 ? contributor.marketValue / contributor.copies : undefined);
      if (value == null || !Number.isFinite(value)) return [];
      return [{
        id: `model-${contributor.card.id}-${contributor.finish ?? "nonfoil"}`,
        slot,
        name: contributor.card.name,
        value,
      }];
    }) ?? []);
}

export function applySurpriseSet(analysis: BreakAnalysis, cards: readonly SurpriseSetCard[]): BreakAnalysis {
  const entries = cards.filter((card) => SLOT_IDS.includes(card.slot)
    && card.name.trim().length > 0
    && Number.isFinite(card.value)
    && card.value >= 0);
  if (!entries.length) return analysis;

  let fingerprint = 2166136261;
  for (const char of JSON.stringify(entries.map(({ id, slot, name, value }) => [id, slot, name.trim(), value]))) {
    fingerprint = Math.imul(fingerprint ^ char.charCodeAt(0), 16777619);
  }
  const dataVersion = `${analysis.valuation.dataVersion}:surprise-set:${(fingerprint >>> 0).toString(36)}`;
  const bySlot = new Map<SlotId, Contributor[]>();
  entries.forEach((entry, index) => {
    const card = {
      id: entry.id,
      set: "USR",
      collectorNumber: String(index + 1),
      name: entry.name.trim(),
      slot: entry.slot,
      nonfoil: entry.value,
      foil: null,
    };
    const contributor: Contributor = {
      card,
      finish: "nonfoil",
      marketPrice: entry.value,
      copies: 1,
      sellableCopies: 1,
      marketValue: entry.value,
      sellableValue: entry.value,
      foilCopies: 0,
      sellableFoilCopies: 0,
      pullProbability: 1,
      sellablePullProbability: 1,
      pullRateVerified: false,
    };
    bySlot.set(entry.slot, [...(bySlot.get(entry.slot) ?? []), contributor]);
  });
  const slots: SlotValuation[] = SLOT_IDS.map((id) => {
    const contributors = bySlot.get(id) ?? [];
    const marketEV = contributors.reduce((sum, row) => sum + row.marketValue, 0);
    const sellableEV = contributors.reduce((sum, row) => sum + row.sellableValue, 0);
    const chase = Math.max(0, ...contributors.map((row) => row.sellableValue));
    return {
      id,
      name: SLOT_NAMES[id],
      marketEV,
      sellableEV,
      knownEV: sellableEV,
      contributors: [...contributors].sort((a, b) => b.sellableValue - a.sellableValue),
      chaseShare: sellableEV > 0 ? chase / sellableEV : 0,
      withoutChase: Math.max(0, sellableEV - chase),
    };
  });
  const totalValue = slots.reduce((sum, slot) => sum + slot.sellableEV, 0);
  const valuation = {
    ...analysis.valuation,
    expectedCards: entries.length,
    marketEV: totalValue,
    sellableEV: totalValue,
    knownEV: totalValue,
    threshold: 0,
    status: "estimated" as const,
    statusReason: "Values are based on the card names and amounts entered by the seller.",
    slots,
    priceOnlyContributors: [],
    omissions: [],
    priceSource: "Seller-entered Surprise Set",
    dataVersion,
    evidence: {
      productIdentity: "aggregate-identified" as const,
      contents: "unresolved" as const,
      collation: "unvalidated" as const,
      finish: "exact" as const,
      breakRules: "user-entered" as const,
    },
  };

  return {
    ...analysis,
    valuation,
    outcomeModel: {
      cacheKey: dataVersion,
      fixed: entries.map((entry) => ({ id: entry.id, slot: entry.slot, value: entry.value, weight: 1 })),
      packs: [],
      complete: true,
    },
    outcomeOmissions: [],
  };
}
