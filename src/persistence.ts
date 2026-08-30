import type { BreakLine, SlotId } from "./domain/types";

const VERSION = 1;
export const sessionKey = (mode: "buyer" | "seller") => `colorbreak:${mode}:draft:v${VERSION}`;
export const rememberedKey = "colorbreak:buyer:composition:v1";
/** Legacy global key. It is deleted rather than guessed against a new break. */
export const sellerPlanKey = "colorbreak:seller:plan:v1";
const SELLER_PLAN_SCHEMA = 2;

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

function normalizedSellerDraft(value: unknown): SellerPlanDraft {
  const fallback = defaultSellerPlanDraft();
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
}

export function sellerCompositionFingerprint(lines: BreakLine[], valuationVersion = "unknown"): string {
  const composition = lines.map((line) => ({
    set: line.set.toUpperCase(), productKey: line.productKey,
    quantity: line.quantity, packCount: line.packCount ?? 1,
  })).sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
  return encodeURIComponent(JSON.stringify({ v: 2, valuationVersion, composition }));
}

export const sellerPlanKeyFor = (fingerprint: string) => `colorbreak:seller:plan:v2:${fingerprint}`;

export function readSellerPlanDraft(fingerprint: string): SellerPlanDraft {
  const fallback = defaultSellerPlanDraft();
  try {
    // Financial facts from v1 cannot be safely associated with a composition.
    sessionStorage.removeItem(sellerPlanKey);
    const value: unknown = JSON.parse(sessionStorage.getItem(sellerPlanKeyFor(fingerprint)) ?? "null");
    if (!value || typeof value !== "object") return fallback;
    const wrapper = value as { schemaVersion?: unknown; compositionFingerprint?: unknown; draft?: unknown };
    if (wrapper.schemaVersion !== SELLER_PLAN_SCHEMA || wrapper.compositionFingerprint !== fingerprint) return fallback;
    return normalizedSellerDraft(wrapper.draft);
  } catch { return fallback; }
}

export function writeSellerPlanDraft(fingerprint: string, draft: SellerPlanDraft) {
  try {
    sessionStorage.setItem(sellerPlanKeyFor(fingerprint), JSON.stringify({
      schemaVersion: SELLER_PLAN_SCHEMA, compositionFingerprint: fingerprint, draft,
    }));
  } catch { /* optional */ }
}

export function discardSellerPlanDraft(fingerprint: string) {
  try { sessionStorage.removeItem(sellerPlanKeyFor(fingerprint)); } catch { /* optional */ }
}

/** Deliberately excludes all transaction facts from explicit assumption reuse. */
export function copySellerOperatingAssumptions(source: SellerPlanDraft): SellerPlanDraft {
  const fallback = defaultSellerPlanDraft();
  const keys: Array<keyof SellerPlanDraft> = ["buyerShipping", "packing", "postage", "shipments", "mailingMethod", "labor", "tax", "giveaways", "refundReserve", "overhead", "commission", "processing", "processingFlat", "minimumAsk"];
  return Object.assign(fallback, Object.fromEntries(keys.map((key) => [key, source[key]])));
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
