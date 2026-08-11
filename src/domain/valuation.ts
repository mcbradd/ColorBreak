import { SLOT_IDS, SLOT_NAMES } from "./types";
import type {
  CardPrice, Contributor, DataStatus, ExpectedDraw, Omission, SlotId, SlotValuation, ValuationResult,
} from "./types";

export interface ValuationInput {
  draws: ExpectedDraw[];
  prices: CardPrice[];
  omissions?: Omission[];
  threshold?: number;
  sourceStatus?: DataStatus;
  pricedAt?: string;
  dataVersion?: string;
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
    const price = draw.foil ? card.foil : card.nonfoil;
    if (price == null) {
      omissions.push({
        code: draw.foil ? "missing-foil-price" : "missing-price",
        message: `${card.name} has no ${draw.foil ? "foil" : "nonfoil"} price; no proxy was substituted.`,
        expectedCards: draw.copies,
        material: draw.copies >= 0.01,
      });
      continue;
    }
    const existing = byCard.get(card.id) ?? {
      card, copies: 0, marketValue: 0, sellableValue: 0, foilCopies: 0,
    };
    existing.copies += draw.copies;
    existing.marketValue += draw.copies * price;
    if (price >= threshold) existing.sellableValue += draw.copies * price;
    if (draw.foil) existing.foilCopies += draw.copies;
    byCard.set(card.id, existing);
  }

  const contributors = [...byCard.values()].sort((a, b) => b.marketValue - a.marketValue);
  const slots: SlotValuation[] = SLOT_IDS.map((id) => {
    const rows = contributors.filter((row) => row.card.slot === id);
    const marketEV = rows.reduce((sum, row) => sum + row.marketValue, 0);
    const sellableEV = rows.reduce((sum, row) => sum + row.sellableValue, 0);
    const chase = rows[0]?.marketValue ?? 0;
    return {
      id,
      name: SLOT_NAMES[id],
      marketEV,
      sellableEV,
      knownEV: marketEV,
      contributors: rows,
      chaseShare: marketEV > 0 ? chase / marketEV : 0,
      withoutChase: Math.max(0, marketEV - chase),
    };
  });
  const materialOmission = omissions.some((item) => item.material);
  const sourceStatus = input.sourceStatus ?? "verified";
  const status = worstStatus(sourceStatus, materialOmission ? "incomplete" : "verified");
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
        : "Known contents or exact-finish prices are unresolved; values are a lower bound.",
    slots,
    omissions,
    pricedAt: input.pricedAt ?? new Date().toISOString(),
    dataVersion: input.dataVersion ?? "unknown",
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
