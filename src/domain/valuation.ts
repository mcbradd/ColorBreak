import { SLOT_IDS, SLOT_NAMES } from "./types";
import type {
  CardPrice, Contributor, DataStatus, DecisionEligibility, EvidenceState, ExpectedDraw, Finish, Omission, ResolvedOnlyLimit, SlotId, SlotValuation, ValuationResult,
} from "./types";
import { isCollectorOutlier } from "./outlier-policy";
import { cardDisplayName } from "./card-label";
import { resolveCardPrice } from "./card-price";

export interface ValuationInput {
  draws: ExpectedDraw[];
  prices: CardPrice[];
  omissions?: Omission[];
  threshold?: number;
  sourceStatus?: DataStatus;
  pricedAt?: string;
  priceSource?: string;
  dataVersion?: string;
  evidence?: EvidenceState;
}

const STATUS_RANK: Record<DataStatus, number> = { verified: 0, estimated: 1, incomplete: 2 };

export function worstStatus(...states: DataStatus[]): DataStatus {
  return states.reduce((worst, state) => STATUS_RANK[state] > STATUS_RANK[worst] ? state : worst, "verified");
}

export function calculateBreak(input: ValuationInput): ValuationResult {
  const threshold = input.threshold ?? 2;
  const priceIndex = new Map(input.prices.map((card) => [`${card.set}|${card.collectorNumber}`, card]));
  const omissions = [...(input.omissions ?? [])];
  const byCard = new Map<string, Contributor>();
  const priceOnlyByCard = new Map<string, Contributor>();

  for (const draw of input.draws) {
    const card = priceIndex.get(`${draw.set}|${draw.collectorNumber}`);
    if (!card) {
      omissions.push({
        code: "missing-printing",
        dedupeKey: `printing:${draw.set}|${draw.collectorNumber}`,
        message: `${draw.set} ${draw.collectorNumber} is absent from the price source.`,
        expectedCards: draw.copies,
        material: draw.copies >= 0.01,
      });
      continue;
    }
    const finish: Finish = draw.finish ?? (draw.foil ? "foil" : "nonfoil");
    const resolvedPrice = resolveCardPrice(card, finish);
    if (resolvedPrice == null) {
      omissions.push({
        code: finish === "nonfoil" ? "missing-price" : `missing-${finish}-price`,
        dedupeKey: `price:${draw.set}|${draw.collectorNumber}|${finish}`,
        message: `${cardDisplayName(card, finish)} has neither a treatment-specific market price nor a listed TCG price for this printing and foil class. Its value is omitted, so the projection may be too low.`,
        expectedCards: draw.copies,
        material: draw.copies >= 0.01,
      });
      continue;
    }
    const price = resolvedPrice.amount;
    const contributorKey = `${card.id}|${finish}`;
    if (isCollectorOutlier(card, finish)) {
      const dedupeKey = `pull-rate:${card.set}|${card.collectorNumber}|${finish}`;
      if (!omissions.some((item) => item.dedupeKey === dedupeKey)) omissions.push({
        code: "unverifiable-pull-rate",
        dedupeKey,
        message: `${cardDisplayName(card, finish)} has no independently verifiable exact pull rate. Its price remains visible, but it is excluded from expected value and Rank by EV until the rate can be verified.`,
        expectedCards: draw.copies,
        material: true,
      });
      const sourceProbability = Math.max(0, Math.min(1, draw.pullProbability ?? 1 - Math.exp(-draw.copies)));
      const existing = priceOnlyByCard.get(contributorKey) ?? {
        card, finish, marketPrice: price, priceBasis: resolvedPrice.basis, copies: 0, sellableCopies: 0,
        marketValue: 0, sellableValue: 0, foilCopies: 0, sellableFoilCopies: 0,
        pullProbability: 0, sellablePullProbability: 0, pullRateVerified: false,
      };
      existing.copies += draw.copies;
      existing.pullProbability = 1 - (1 - existing.pullProbability) * (1 - sourceProbability);
      if (finish !== "nonfoil") existing.foilCopies += draw.copies;
      priceOnlyByCard.set(contributorKey, existing);
      continue;
    }
    const existing = byCard.get(contributorKey) ?? {
      card, finish, marketPrice: price, priceBasis: resolvedPrice.basis, copies: 0, sellableCopies: 0, marketValue: 0, sellableValue: 0,
      foilCopies: 0, sellableFoilCopies: 0, pullProbability: 0,
      sellablePullProbability: 0,
    };
    existing.copies += draw.copies;
    existing.marketValue += draw.copies * price;
    if (finish !== "nonfoil") existing.foilCopies += draw.copies;
    const sourceProbability = Math.max(
      0,
      Math.min(1, draw.pullProbability ?? 1 - Math.exp(-draw.copies)),
    );
    existing.pullProbability =
      1 - (1 - existing.pullProbability) * (1 - sourceProbability);
    if (price >= threshold) {
      existing.sellableValue += draw.copies * price;
      existing.sellableCopies += draw.copies;
      if (finish !== "nonfoil") existing.sellableFoilCopies += draw.copies;
      existing.sellablePullProbability =
        1 - (1 - existing.sellablePullProbability) * (1 - sourceProbability);
    }
    byCard.set(contributorKey, existing);
  }

  const contributors = [...byCard.values()];
  const priceOnlyContributors = [...priceOnlyByCard.values()];
  const slots: SlotValuation[] = SLOT_IDS.map((id) => {
    const allRows = contributors.filter((row) => row.card.slot === id);
    const rows = allRows
      .filter((row) => row.sellableValue > 0)
      .sort((a, b) => b.sellableValue - a.sellableValue);
    const marketEV = allRows.reduce((sum, row) => sum + row.marketValue, 0);
    const sellableEV = rows.reduce((sum, row) => sum + row.sellableValue, 0);
    const chase = rows[0]?.sellableValue ?? 0;
    return {
      id,
      name: SLOT_NAMES[id],
      marketEV,
      sellableEV,
      knownEV: sellableEV,
      contributors: rows,
      chaseShare: sellableEV > 0 ? chase / sellableEV : 0,
      withoutChase: Math.max(0, sellableEV - chase),
    };
  });
  const materialOmission = omissions.some((item) => item.material);
  const sourceStatus = input.sourceStatus ?? "verified";
  const status = worstStatus(sourceStatus, materialOmission ? "incomplete" : "verified");
  const unverifiedPullRate = omissions.some((item) => item.material && item.code === "unverifiable-pull-rate");
  const structuralOmission = omissions.some((item) => item.material && !(
    item.code === "price-source-unavailable" || item.code === "missing-printing" || item.code.includes("price")
  ));
  const priceUnavailable = omissions.some((item) => item.material && item.code === "price-source-unavailable");
  const priceOmission = omissions.some((item) => item.material && (
    item.code === "missing-printing" || item.code.includes("price")
  ));
  const usedClassPrice = contributors.some((row) => row.priceBasis !== "exact-market");
  const evidence: EvidenceState = input.evidence ?? {
    productIdentity: sourceStatus === "incomplete" && structuralOmission ? "ambiguous" : "aggregate-identified",
    contents: sourceStatus === "incomplete" && structuralOmission ? "unresolved" : "mtgjson-structured",
    collation: unverifiedPullRate ? "unvalidated" : sourceStatus === "incomplete" && structuralOmission ? "unresolved" : sourceStatus === "estimated" ? "unvalidated" : "weighted-upstream",
    finish: priceOmission ? "unresolved" : usedClassPrice ? "class-only" : "exact",
    breakRules: "preset",
  };
  return {
    marketEV: slots.reduce((sum, slot) => sum + slot.marketEV, 0),
    sellableEV: slots.reduce((sum, slot) => sum + slot.sellableEV, 0),
    knownEV: slots.reduce((sum, slot) => sum + slot.knownEV, 0),
    threshold,
    status,
    statusReason: status === "verified"
      ? usedClassPrice
        ? "Product contents and collation are resolved. A same-printing foil market price or listed TCG price is used where no treatment-specific market price exists."
        : "Product contents, collation, and exact-finish prices resolved."
      : status === "estimated"
        ? "Product contents are known, but at least one collation rule is modeled."
        : unverifiedPullRate
          ? "One or more chase-card pull rates cannot be verified. Those cards remain visible by price but are excluded from expected value."
        : priceUnavailable && !structuralOmission
          ? "Product contents are resolved, but exact-printing prices are temporarily unavailable; values are a lower bound."
          : structuralOmission
            ? "Known product contents or collation are unresolved; values are a lower bound."
            : "One or more exact-printing prices are unavailable; values are a lower bound.",
    slots,
    priceOnlyContributors,
    omissions,
    pricedAt: input.pricedAt ?? new Date().toISOString(),
    priceSource: input.priceSource,
    dataVersion: input.dataVersion ?? "unknown",
    evidence,
  };
}

/** Published price observations are actionable for exactly six hours. */
export const DECISION_FRESHNESS_MS = 6 * 60 * 60 * 1000;

/** Presentation contract shared by product choice and the live buyer result. */
export interface DecisionAvailability {
  label: "Decision-ready" | "Analysis only — stale" | "Unavailable";
  detail: string;
  observedAt?: string;
  observedSource?: string;
  ageMs?: number;
}

export function decisionAvailability(
  valuation: Pick<ValuationResult, "status" | "omissions" | "pricedAt" | "priceSource">,
  now: number | Date = Date.now(),
): DecisionAvailability {
  const eligibility = decisionEligibility(valuation, now);
  if (eligibility.status === "eligible") return {
    label: "Decision-ready",
    detail: "Bid decision available from evidence observed under the published six-hour policy.",
    observedAt: eligibility.observedAt, observedSource: eligibility.observedSource, ageMs: eligibility.ageMs,
  };
  if (eligibility.status === "stale") return {
    label: "Analysis only — stale",
    detail: "Contents are resolved, but the price snapshot is older than six hours; no bid decision is available on this demo.",
    observedAt: eligibility.observedAt, observedSource: eligibility.observedSource, ageMs: eligibility.ageMs,
  };
  const reason = eligibility.affectedGroups[0]?.label ?? "price or product evidence is unavailable";
  return { label: "Unavailable", detail: `No bid decision: ${reason}`, observedAt: eligibility.observedAt, observedSource: eligibility.observedSource, ageMs: eligibility.ageMs };
}

/**
 * Classifies whether a valuation can drive a buyer or seller decision.  This is
 * intentionally independent from presentation: callers must gate action,
 * sharing, export, and analytics on `status === "eligible"`.
 */
export function decisionEligibility(
  valuation: Pick<ValuationResult, "status" | "omissions" | "pricedAt" | "priceSource">,
  now: number | Date = Date.now(),
  freshnessThresholdMs = DECISION_FRESHNESS_MS,
): DecisionEligibility {
  const observedAt = valuation.pricedAt;
  const observedSource = valuation.priceSource;
  const currentTime = now instanceof Date ? now.getTime() : now;
  const observedTime = Date.parse(observedAt ?? "");
  const materialOmissions = valuation.omissions.filter((omission) => omission.material);
  const groups = [...new Map(materialOmissions.map((omission) => {
    const id = omission.dedupeKey ?? omission.source ?? omission.code;
    return [id, { id, label: omission.message, directionallyUsable: false }] as const;
  })).values()];

  if (!observedAt) {
    return {
      status: "unavailable", blockerCount: 1, affectedGroups: groups, observedSource,
      freshnessThresholdMs, reason: "missing-price-timestamp",
      resolvedOnlyAvailable: false,
    };
  }
  if (!Number.isFinite(observedTime) || !Number.isFinite(currentTime)) {
    return {
      status: "unavailable", blockerCount: 1, affectedGroups: groups, observedAt, observedSource,
      freshnessThresholdMs, reason: "invalid-price-timestamp",
      resolvedOnlyAvailable: false,
    };
  }
  const ageMs = Math.max(0, currentTime - observedTime);
  if (ageMs > freshnessThresholdMs) {
    return {
      status: "stale", blockerCount: 1, affectedGroups: groups, observedAt, observedSource, ageMs,
      freshnessThresholdMs, reason: "stale-price-snapshot",
      resolvedOnlyAvailable: false,
    };
  }
  if (materialOmissions.length || valuation.status === "incomplete") {
    return {
      status: "material-incomplete", blockerCount: Math.max(1, groups.length), affectedGroups: groups,
      observedAt, observedSource, ageMs, freshnessThresholdMs, resolvedOnlyAvailable: true,
      reason: "material-omissions",
    };
  }
  if (valuation.status !== "verified") {
    return {
      status: "unavailable", blockerCount: 1, affectedGroups: groups, observedAt, observedSource, ageMs,
      freshnessThresholdMs, reason: "unavailable-source-status",
      resolvedOnlyAvailable: false,
    };
  }
  return {
    status: "eligible", blockerCount: 0, affectedGroups: [], observedAt, observedSource, ageMs,
    freshnessThresholdMs, reason: "fresh-complete",
    resolvedOnlyAvailable: false,
  };
}

/**
 * Derives a deliberately incomplete ceiling without inventing a value for any
 * omission. Callers may offer it only after explicit user consent.
 */
export function resolvedOnlyLimit(
  resolvedValue: number,
  shipping: number,
  eligibility: DecisionEligibility,
): ResolvedOnlyLimit | undefined {
  if (!eligibility.resolvedOnlyAvailable || eligibility.status !== "material-incomplete") return undefined;
  if (!Number.isFinite(resolvedValue) || !Number.isFinite(shipping) || shipping < 0) return undefined;
  const amount = Math.max(0, Math.floor((resolvedValue - shipping) * 100) / 100);
  return {
    scope: "resolved-only", amount, allIn: amount + shipping,
    omittedGroups: eligibility.affectedGroups,
    observedAt: eligibility.observedAt, observedSource: eligibility.observedSource,
  };
}

export function slotOfCard(card: {
  typeLine?: string;
  colors?: string[];
  frontFace?: { typeLine?: string; colors?: string[] };
}): SlotId {
  const face = card.frontFace ?? card;
  if ((face.typeLine ?? "").split("//")[0].includes("Land")) return "L";
  const colors = face.colors ?? [];
  if (colors.length === 0) return "C";
  if (colors.length > 1) return "M";
  return colors[0] as SlotId;
}

export type Verdict = "+EV" | "FAIR" | "−EV";

export function buyerVerdict(slot: SlotValuation, landedCost: number, _status: DataStatus): Verdict {
  const net = slot.sellableEV - landedCost;
  const deadband = Math.max(1, landedCost * 0.08);
  return net > deadband ? "+EV" : net < -deadband ? "−EV" : "FAIR";
}
