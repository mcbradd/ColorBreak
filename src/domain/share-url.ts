import { decodeComposition, encodeComposition } from "./legacy";
import type { BreakLine, SlotId } from "./types";

export type AssignmentMode = "random" | "pick" | "large";

export interface BreakShareState {
  lines: BreakLine[];
  assignmentMode: AssignmentMode;
  selectedSlot: SlotId;
  remaining: SlotId[];
  bulkEnabled: boolean;
  bulkThreshold: number;
  largeSpots: number;
}

export interface SharedBuyerOptions {
  lines: BreakLine[];
  assignmentMode: AssignmentMode;
  selectedSlot?: SlotId;
  remaining?: SlotId[];
  bulkEnabled?: boolean;
  bulkThreshold?: number;
  largeSpots?: number;
}

const SLOT_IDS: SlotId[] = ["W", "U", "B", "R", "G", "M", "C", "L"];

export function createBreakShareUrl(href: string, state: BreakShareState): string {
  const url = new URL(href);
  const composition = encodeComposition(state.lines);
  if (composition) url.searchParams.set("b", composition);
  else url.searchParams.delete("b");
  url.searchParams.set("m", state.assignmentMode);
  url.searchParams.set("s", state.selectedSlot);
  url.searchParams.set("r", state.remaining.join(""));
  url.searchParams.set("f", state.bulkEnabled ? "1" : "0");
  url.searchParams.set("t", String(state.bulkThreshold));
  if (state.assignmentMode === "large") url.searchParams.set("n", String(state.largeSpots));
  else url.searchParams.delete("n");
  return url.toString();
}

export function decodeBuyerShare(search: string): SharedBuyerOptions {
  const params = new URLSearchParams(search);
  const rawMode = params.get("m");
  const assignmentMode: AssignmentMode = rawMode === "large" || rawMode === "random" ? rawMode : "pick";
  const rawSlot = params.get("s") as SlotId | null;
  const remaining = params.get("r")?.split("").filter((slot): slot is SlotId => SLOT_IDS.includes(slot as SlotId));
  const rawThreshold = params.get("t");
  const threshold = rawThreshold == null ? undefined : Number(rawThreshold);
  const rawSpots = params.get("n");
  const spots = rawSpots == null ? undefined : Number(rawSpots);
  return {
    lines: decodeComposition(params.get("b") ?? ""),
    assignmentMode,
    selectedSlot: rawSlot && SLOT_IDS.includes(rawSlot) ? rawSlot : undefined,
    remaining: remaining?.length ? remaining : undefined,
    bulkEnabled: params.has("f") ? params.get("f") !== "0" : undefined,
    bulkThreshold: threshold != null && Number.isFinite(threshold) && threshold >= 0 ? threshold : undefined,
    largeSpots: spots != null && Number.isFinite(spots) && spots > 0 ? Math.min(500, Math.round(spots)) : undefined,
  };
}
