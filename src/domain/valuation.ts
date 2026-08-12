import { SLOT_IDS, SLOT_NAMES } from "./types";
import type {
  CardPrice, Contributor, DataStatus, EvidenceState, ExpectedDraw, Finish, Omission, SlotId, SlotValuation, ValuationResult,
} from "./types";
import { isCollectorOutlierFinish } from "./outlier-policy";

export interface ValuationInput {
  draws: ExpectedDraw[];
  prices: CardPrice[];
  omissions?: Omission[];
  threshold?: number;
  sourceStatus?: DataStatus;
  pricedAt?: string;
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

  for (const draw of input.draws) {
    const card = priceIndex.get(`${draw.set}|${draw.collectorNumber}`);
    if (!card) {
      omissions.push({
        code: "missing-printing",
        message: `${draw.set} ${draw.collectorNumber} is absent from the price source.`,
        expectedCards: draw.copies,
        material: draw.copies >= 0.01,
      });
      continue;
    }
    const finish: Finish = draw.finish ?? (draw.foil ? "foil" : "nonfoil");
    if (isCollectorOutlierFinish(finish)) {
      omissions.push({
        code: "collector-outlier-excluded",
        message: `${card.name} (${finish}) is excluded from decision value because scarcity-defined collectibles do not represent a repeatable pack outcome.`,
        expectedCards: draw.copies,
        material: false,
      });
      continue;
    }
    const price = card.prices?.[finish]
      ?? (finish === "foil" ? card.foil : finish === "nonfoil" ? card.nonfoil : null);
    if (price == null) {
      omissions.push({
        code: finish === "nonfoil" ? "missing-price" : `missing-${finish}-price`,
        message: `${card.name} has no ${finish} price; no proxy was substituted.`,
        expectedCards: draw.copies,
        material: draw.copies >= 0.01,
      });
      continue;
    }
    const existing = byCard.get(card.id) ?? {
      card, copies: 0, sellableCopies: 0, marketValue: 0, sellableValue: 0,
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
    byCard.set(card.id, existing);
  }

  const contributors = [...byCard.values()];
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
  const structuralOmission = omissions.some((item) => item.material && !(
    item.code === "price-source-unavailable" || item.code === "missing-printing" || item.code.includes("price")
  ));
  const priceUnavailable = omissions.some((item) => item.material && item.code === "price-source-unavailable");
  const priceOmission = omissions.some((item) => item.material && (
    item.code === "missing-printing" || item.code.includes("price")
  ));
  const evidence: EvidenceState = input.evidence ?? {
    productIdentity: sourceStatus === "incomplete" && structuralOmission ? "ambiguous" : "aggregate-identified",
    contents: sourceStatus === "incomplete" && structuralOmission ? "unresolved" : "mtgjson-structured",
    collation: sourceStatus === "incomplete" && structuralOmission ? "unresolved" : sourceStatus === "estimated" ? "unvalidated" : "weighted-upstream",
    finish: priceOmission ? "unresolved" : "exact",
    breakRules: "preset",
  };
  return {
    marketEV: slots.reduce((sum, slot) => sum + slot.marketEV, 0),
    sellableEV: slots.reduce((sum, slot) => sum + slot.sellableEV, 0),
    knownEV: slots.reduce((sum, slot) => sum + slot.knownEV, 0),
    threshold,
    status,
    statusReason: status === "verified"
      ? "Product contents, collation, and exact-finish prices resolved."
      : status === "estimated"
        ? "Product contents are known, but at least one collation rule is modeled."
        : priceUnavailable && !structuralOmission
          ? "Product contents are resolved, but exact-printing prices are temporarily unavailable; values are a lower bound."
          : structuralOmission
            ? "Known product contents or collation are unresolved; values are a lower bound."
            : "One or more exact-printing prices are unavailable; values are a lower bound.",
    slots,
    omissions,
    pricedAt: input.pricedAt ?? new Date().toISOString(),
    dataVersion: input.dataVersion ?? "unknown",
    evidence,
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

export type Verdict = "+EV" | "FAIR" | "−EV" | "NO VERDICT";

export function buyerVerdict(slot: SlotValuation, landedCost: number, status: DataStatus): Verdict {
  if (status === "incomplete") return "NO VERDICT";
  const net = slot.sellableEV - landedCost;
  const deadband = Math.max(1, landedCost * 0.08);
  return net > deadband ? "+EV" : net < -deadband ? "−EV" : "FAIR";
}
