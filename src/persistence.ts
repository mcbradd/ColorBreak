import type { BreakLine, SlotId } from "./domain/types";

const VERSION = 1;
export const sessionKey = (mode: "buyer" | "seller") => `colorbreak:${mode}:draft:v${VERSION}`;
export const rememberedKey = "colorbreak:buyer:composition:v1";
export const sellerPlanKey = "colorbreak:seller:plan:v1";

/**
 * The operating plan is deliberately private and session-scoped.  Unlike a
 * buyer share projection, it includes seller-entered money and must never be
 * copied to localStorage or a URL.
 */
export interface SellerPlanDraft {
  buyerShipping: number;
  packing: number;
  postage: number;
  shipments: number;
  mailingMethod: string;
  labor: number;
  tax: number;
  giveaways: number;
  refundReserve: number;
  overhead: number;
  commission: number;
  processing: number;
  processingFlat: number;
  plannedBidOverride?: number;
  acceptedEstimateIds: string[];
  minimumAsk: number;
  lockedAsks: Partial<Record<SlotId, number>>;
  actualAsks: Partial<Record<SlotId, number>>;
  unsoldSlots: SlotId[];
}

export const defaultSellerPlanDraft = (): SellerPlanDraft => ({
  buyerShipping: 5, packing: 2, postage: 0, shipments: 8,
  mailingMethod: "whatnot-label", labor: 0, tax: 0, giveaways: 0,
  refundReserve: 0, overhead: 0, commission: 8, processing: 2.9,
  processingFlat: .3, acceptedEstimateIds: [], minimumAsk: 1,
  lockedAsks: {}, actualAsks: {}, unsoldSlots: [],
});

const finite = (value: unknown, fallback: number) =>
  typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : fallback;
const slots = new Set<SlotId>(["W", "U", "B", "R", "G", "M", "C", "L"]);
const askMap = (value: unknown): Partial<Record<SlotId, number>> => {
  if (!value || typeof value !== "object") return {};
  return Object.fromEntries(Object.entries(value).filter(([key, amount]) =>
    slots.has(key as SlotId) && typeof amount === "number" && Number.isFinite(amount) && amount >= 0,
  )) as Partial<Record<SlotId, number>>;
};

export function readSellerPlanDraft(): SellerPlanDraft {
  const fallback = defaultSellerPlanDraft();
  try {
    const value: unknown = JSON.parse(sessionStorage.getItem(sellerPlanKey) ?? "null");
    if (!value || typeof value !== "object") return fallback;
    const draft = value as Partial<SellerPlanDraft>;
    return {
      buyerShipping: finite(draft.buyerShipping, fallback.buyerShipping),
      packing: finite(draft.packing, fallback.packing),
      postage: finite(draft.postage, fallback.postage),
      shipments: finite(draft.shipments, fallback.shipments),
      mailingMethod: typeof draft.mailingMethod === "string" ? draft.mailingMethod : fallback.mailingMethod,
      labor: finite(draft.labor, 0), tax: finite(draft.tax, 0), giveaways: finite(draft.giveaways, 0),
      refundReserve: finite(draft.refundReserve, 0), overhead: finite(draft.overhead, 0),
      commission: finite(draft.commission, fallback.commission), processing: finite(draft.processing, fallback.processing),
      processingFlat: finite(draft.processingFlat, fallback.processingFlat),
      ...(typeof draft.plannedBidOverride === "number" && Number.isFinite(draft.plannedBidOverride) && draft.plannedBidOverride >= 0 ? { plannedBidOverride: draft.plannedBidOverride } : {}),
      acceptedEstimateIds: Array.isArray(draft.acceptedEstimateIds) ? draft.acceptedEstimateIds.filter((id): id is string => typeof id === "string") : [],
      minimumAsk: finite(draft.minimumAsk, fallback.minimumAsk),
      lockedAsks: askMap(draft.lockedAsks), actualAsks: askMap(draft.actualAsks),
      unsoldSlots: Array.isArray(draft.unsoldSlots) ? draft.unsoldSlots.filter((slot): slot is SlotId => slots.has(slot as SlotId)) : [],
    };
  } catch { return fallback; }
}

export function writeSellerPlanDraft(draft: SellerPlanDraft) {
  try { sessionStorage.setItem(sellerPlanKey, JSON.stringify(draft)); } catch { /* optional */ }
}

/** Only non-financial composition is ever allowed to leave session storage. */
export function compositionProjection(lines: BreakLine[]) {
  return lines.map(({ id, set, productKey, productLabel, quantity, tcgId, packCount }) =>
    ({ id, set, productKey, productLabel, quantity, tcgId, packCount }));
}

export function readSessionLines(mode: "buyer" | "seller"): BreakLine[] {
  try { return JSON.parse(sessionStorage.getItem(sessionKey(mode)) ?? "[]") as BreakLine[]; } catch { return []; }
}

export function writeSessionLines(mode: "buyer" | "seller", lines: BreakLine[]) {
  try { sessionStorage.setItem(sessionKey(mode), JSON.stringify(lines)); } catch { /* optional */ }
}

/** Remove the former durable drafts, especially seller cost records, before any new write. */
export function cleanupLegacyStorage(): boolean {
  let removed = false;
  try {
    for (const mode of ["buyer", "seller"] as const) {
      const key = `colorbreak:${mode}:lines`;
      if (localStorage.getItem(key) != null) { localStorage.removeItem(key); removed = true; }
    }
    for (const key of ["colorbreak:buyer:auction", "colorbreak:buyer:large-spots"]) {
      if (localStorage.getItem(key) != null) { localStorage.removeItem(key); removed = true; }
    }
  } catch { /* storage is optional */ }
  return removed;
}
