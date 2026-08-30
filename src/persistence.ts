import type { AssignmentMode } from "./domain/share-url";
import type { BreakLine, SlotId } from "./domain/types";
import { emptyActualLedger, validateActualLedger, type ActualLedger } from "./domain/actual-ledger";

const VERSION = 1;
export const sessionKey = (mode: "buyer" | "seller") => `colorbreak:${mode}:draft:v${VERSION}`;
export const rememberedKey = "colorbreak:buyer:composition:v1";
export const sellerPlanKey = "colorbreak:seller:plan:v2";
export const buyerDecisionKey = "colorbreak:buyer:decision:v1";
const BUYER_DECISION_VERSION = 1;

/**
 * The operating plan is deliberately private and session-scoped.  Unlike a
 * buyer share projection, it includes seller-entered money and must never be
 * copied to localStorage or a URL.
 */
export interface SellerPlanDraft {
  /** Binds private seller assumptions to one exact composition and data snapshot. */
  owner?: SellerPlanOwner;
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
  targetsApplied: boolean;
  lockedAsks: Partial<Record<SlotId, number>>;
  unsoldSlots: SlotId[];
  /** Legacy ask entries are never treated as receipts after migration. */
  reconciliationNeeded: boolean;
  /** Receipt-backed records only. Invalid records are discarded, never interpreted as money. */
  actualLedger: ActualLedger;
}

export interface SellerPlanOwner {
  fingerprint: string;
  dataVersion: string;
  revision: 2;
  lines: ReturnType<typeof compositionProjection>;
}

export const defaultSellerPlanDraft = (): SellerPlanDraft => ({
  buyerShipping: 5, packing: 2, postage: 0, shipments: 8,
  mailingMethod: "whatnot-label", labor: 0, tax: 0, giveaways: 0,
  refundReserve: 0, overhead: 0, commission: 8, processing: 2.9,
  processingFlat: .3, acceptedEstimateIds: [], minimumAsk: 1,
  targetsApplied: false, lockedAsks: {}, unsoldSlots: [], reconciliationNeeded: false, actualLedger: emptyActualLedger(),
});

/** Deliberately excludes line ids: importing/copying the same break keeps its identity. */
export function sellerCompositionFingerprint(lines: BreakLine[]): string {
  return buyerCompositionFingerprint(lines);
}

export function sellerPlanOwner(lines: BreakLine[], dataVersion: string): SellerPlanOwner {
  return { fingerprint: sellerCompositionFingerprint(lines), dataVersion, revision: 2, lines: compositionProjection(lines) };
}

export function sellerPlanMatches(draft: SellerPlanDraft, owner: SellerPlanOwner): boolean {
  return draft.owner?.revision === 2 && draft.owner.fingerprint === owner.fingerprint && draft.owner.dataVersion === owner.dataVersion;
}

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
    const owner = draft.owner && typeof draft.owner === "object"
      && typeof (draft.owner as SellerPlanOwner).fingerprint === "string"
      && typeof (draft.owner as SellerPlanOwner).dataVersion === "string"
      && (draft.owner as SellerPlanOwner).revision === 2
      && Array.isArray((draft.owner as SellerPlanOwner).lines)
      ? draft.owner as SellerPlanOwner : undefined;
    return {
      ...(owner ? { owner } : {}),
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
      targetsApplied: Boolean(draft.targetsApplied),
      lockedAsks: askMap(draft.lockedAsks),
      unsoldSlots: Array.isArray(draft.unsoldSlots) ? draft.unsoldSlots.filter((slot): slot is SlotId => slots.has(slot as SlotId)) : [],
      // Older versions stored a target-like `actualAsks` map. It has no order,
      // timestamp, or shipment evidence, so preserving it as an actual would
      // silently turn a plan into receipts.
      reconciliationNeeded: Boolean(draft.reconciliationNeeded) || ((draft as { actualAsks?: unknown }).actualAsks != null),
      actualLedger: (() => {
        try { return validateActualLedger(draft.actualLedger ?? emptyActualLedger(), [...slots] as SlotId[]); }
        catch { return emptyActualLedger(); }
      })(),
    };
  } catch { return fallback; }
}

export function writeSellerPlanDraft(draft: SellerPlanDraft): boolean {
  try {
    sessionStorage.setItem(sellerPlanKey, JSON.stringify(draft));
    return true;
  } catch {
    return false;
  }
}

/** Only non-financial composition is ever allowed to leave session storage. */
export function compositionProjection(lines: BreakLine[]) {
  return lines.map(({ id, set, productKey, productLabel, quantity, tcgId, packCount }) =>
    ({ id, set, productKey, productLabel, quantity, tcgId, packCount }));
}

export type SessionDraftRead =
  | { kind: "missing"; lines: [] }
  | { kind: "valid"; lines: BreakLine[] }
  | { kind: "invalid"; lines: [] };

function isBreakLine(value: unknown): value is BreakLine {
  if (!value || typeof value !== "object") return false;
  const line = value as Partial<BreakLine>;
  return typeof line.id === "string" && typeof line.set === "string"
    && typeof line.productKey === "string" && typeof line.productLabel === "string"
    && typeof line.quantity === "number" && Number.isFinite(line.quantity) && line.quantity > 0
    && (line.packCount == null || (typeof line.packCount === "number" && Number.isFinite(line.packCount) && line.packCount > 0));
}

/** The sole authority for session draft keys, parsing, and structural validation. */
export function readSessionDraft(mode: "buyer" | "seller"): SessionDraftRead {
  try {
    const raw = sessionStorage.getItem(sessionKey(mode));
    if (raw == null) return { kind: "missing", lines: [] };
    const value: unknown = JSON.parse(raw);
    return Array.isArray(value) && value.every(isBreakLine)
      ? { kind: "valid", lines: value }
      : { kind: "invalid", lines: [] };
  } catch { return { kind: "invalid", lines: [] }; }
}

/** Compatibility convenience API; callers needing recovery messaging use readSessionDraft. */
export function readSessionLines(mode: "buyer" | "seller"): BreakLine[] {
  const draft = readSessionDraft(mode);
  return draft.kind === "valid" ? draft.lines : [];
}

export function writeSessionLines(mode: "buyer" | "seller", lines: BreakLine[]) {
  try { sessionStorage.setItem(sessionKey(mode), JSON.stringify(lines)); } catch { /* optional */ }
}

/**
 * A buyer's money and auction state are one private session snapshot.  They
 * must never be restored piecemeal into a different composition.
 */
export interface BuyerDecisionRecord {
  schemaVersion: typeof BUYER_DECISION_VERSION;
  fingerprint: string;
  dataVersion: string;
  lines: ReturnType<typeof compositionProjection>;
  assignmentMode: AssignmentMode;
  selectedSlot: SlotId;
  remaining: SlotId[];
  bulkEnabled: boolean;
  bulkThreshold: number;
  largeSpots: number;
  bid?: number;
  shipping?: number;
  savedAt: number;
}

export interface BuyerDecisionState {
  lines: BreakLine[];
  dataVersion: string;
  assignmentMode: AssignmentMode;
  selectedSlot: SlotId;
  remaining: SlotId[];
  bulkEnabled: boolean;
  bulkThreshold: number;
  largeSpots: number;
}

const buyerSlots = new Set<SlotId>(["W", "U", "B", "R", "G", "M", "C", "L"]);
const buyerModes = new Set<AssignmentMode>(["pick", "random", "large"]);
const safeNumber = (value: unknown, minimum = 0) =>
  typeof value === "number" && Number.isFinite(value) && value >= minimum ? value : undefined;

/** Canonical, shared-safe identity used to bind a private buyer snapshot. */
export function buyerCompositionFingerprint(lines: BreakLine[]): string {
  return JSON.stringify(compositionProjection(lines)
    .map(({ set, productKey, quantity, tcgId, packCount }) => ({ set, productKey, quantity, tcgId: tcgId ?? null, packCount: packCount ?? null }))
    .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))));
}

export function buyerDecisionFingerprint(state: BuyerDecisionState): string {
  const lines = JSON.parse(buyerCompositionFingerprint(state.lines));
  return JSON.stringify({
    lines,
    dataVersion: state.dataVersion,
    assignmentMode: state.assignmentMode,
    selectedSlot: state.selectedSlot,
    remaining: [...state.remaining],
    bulkEnabled: state.bulkEnabled,
    bulkThreshold: state.bulkThreshold,
    largeSpots: state.largeSpots,
  });
}

function validBuyerRecord(value: unknown): BuyerDecisionRecord | undefined {
  if (!value || typeof value !== "object") return undefined;
  const record = value as Partial<BuyerDecisionRecord>;
  if (record.schemaVersion !== BUYER_DECISION_VERSION || typeof record.fingerprint !== "string" || typeof record.dataVersion !== "string" || !Array.isArray(record.lines)
    || !buyerModes.has(record.assignmentMode as AssignmentMode) || !buyerSlots.has(record.selectedSlot as SlotId)
    || !Array.isArray(record.remaining) || record.remaining.length === 0 || !record.remaining.every((slot) => buyerSlots.has(slot as SlotId))
    || new Set(record.remaining).size !== record.remaining.length || typeof record.bulkEnabled !== "boolean"
    || safeNumber(record.bulkThreshold) == null || safeNumber(record.largeSpots, 1) == null || safeNumber(record.savedAt, 1) == null) return undefined;
  const lines = record.lines as ReturnType<typeof compositionProjection>;
  if (!lines.every((line) => line && typeof line === "object" && typeof line.set === "string" && typeof line.productKey === "string"
    && typeof line.productLabel === "string" && Number.isInteger(line.quantity) && line.quantity > 0)) return undefined;
  if (record.bid != null && safeNumber(record.bid) == null) return undefined;
  if (record.shipping != null && safeNumber(record.shipping) == null) return undefined;
  const self = buyerDecisionFingerprint({
    lines: lines as BreakLine[], dataVersion: record.dataVersion, assignmentMode: record.assignmentMode as AssignmentMode,
    selectedSlot: record.selectedSlot as SlotId, remaining: record.remaining as SlotId[], bulkEnabled: record.bulkEnabled,
    bulkThreshold: record.bulkThreshold!, largeSpots: record.largeSpots!,
  });
  return self === record.fingerprint ? record as BuyerDecisionRecord : undefined;
}

export function readBuyerDecisionRecord(expected?: BuyerDecisionState): BuyerDecisionRecord | undefined {
  try {
    const record = validBuyerRecord(JSON.parse(sessionStorage.getItem(buyerDecisionKey) ?? "null"));
    if (!record || (expected && record.fingerprint !== buyerDecisionFingerprint(expected))) {
      sessionStorage.removeItem(buyerDecisionKey);
      return undefined;
    }
    return record;
  } catch {
    try { sessionStorage.removeItem(buyerDecisionKey); } catch { /* optional */ }
    return undefined;
  }
}

export function writeBuyerDecisionRecord(state: BuyerDecisionState, money: { bid?: number; shipping?: number }) {
  const record: BuyerDecisionRecord = {
    schemaVersion: BUYER_DECISION_VERSION,
    fingerprint: buyerDecisionFingerprint(state),
    dataVersion: state.dataVersion,
    lines: compositionProjection(state.lines),
    assignmentMode: state.assignmentMode,
    selectedSlot: state.selectedSlot,
    remaining: [...state.remaining],
    bulkEnabled: state.bulkEnabled,
    bulkThreshold: state.bulkThreshold,
    largeSpots: state.largeSpots,
    ...(money.bid == null ? {} : { bid: money.bid }),
    ...(money.shipping == null ? {} : { shipping: money.shipping }),
    savedAt: Date.now(),
  };
  try { sessionStorage.setItem(buyerDecisionKey, JSON.stringify(record)); } catch { /* optional */ }
}

/** Remove the former durable drafts, especially seller cost records, before any new write. */
export function cleanupLegacyStorage(): boolean {
  let removed = false;
  try {
    for (const mode of ["buyer", "seller"] as const) {
      const key = `colorbreak:${mode}:lines`;
      if (localStorage.getItem(key) != null) { localStorage.removeItem(key); removed = true; }
    }
    for (const key of ["colorbreak:buyer:auction", "colorbreak:buyer:large-spots", "colorbreak:buyer:bid", "colorbreak:buyer:shipping"]) {
      if (localStorage.getItem(key) != null) { localStorage.removeItem(key); removed = true; }
      if (sessionStorage.getItem(key) != null) { sessionStorage.removeItem(key); removed = true; }
    }
  } catch { /* storage is optional */ }
  return removed;
}
