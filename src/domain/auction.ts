import { SLOT_IDS, SLOT_NAMES } from "./types";
import type { SlotId } from "./types";

export interface AuctionState {
  remaining: SlotId[];
  assignments: SlotId[];
}

export function createAuction(remaining: readonly SlotId[] = SLOT_IDS): AuctionState {
  return { remaining: [...remaining], assignments: [] };
}

export function assignSlot(state: AuctionState, slot: SlotId): AuctionState {
  if (!state.remaining.includes(slot)) {
    throw new Error(`${SLOT_NAMES[slot]} is no longer available`);
  }
  return {
    remaining: state.remaining.filter((candidate) => candidate !== slot),
    assignments: [...state.assignments, slot],
  };
}

export function undoAssignment(state: AuctionState): AuctionState {
  const slot = state.assignments.at(-1);
  if (!slot) return state;
  const restored = SLOT_IDS.filter((candidate) =>
    state.remaining.includes(candidate) || candidate === slot,
  );
  return {
    remaining: restored,
    assignments: state.assignments.slice(0, -1),
  };
}

export function toggleSlotTaken(state: AuctionState, slot: SlotId): AuctionState {
  if (state.remaining.includes(slot)) {
    if (state.remaining.length === 1) return state;
    return assignSlot(state, slot);
  }
  return {
    remaining: SLOT_IDS.filter((candidate) =>
      state.remaining.includes(candidate) || candidate === slot,
    ),
    assignments: state.assignments.filter((candidate) => candidate !== slot),
  };
}

/**
 * Marks every given slot taken as one atomic transition — the model for a
 * seller combining several slots into a single purchasable lot (colorless
 * and lands are commonly sold together). Slots already taken are ignored;
 * duplicates collapse. Refuses the whole batch, unchanged, rather than
 * leave zero slots remaining.
 */
export function markSlotsTaken(state: AuctionState, slots: readonly SlotId[]): AuctionState {
  const toTake = SLOT_IDS.filter((slot) => slots.includes(slot) && state.remaining.includes(slot));
  if (toTake.length === 0) return state;
  if (toTake.length >= state.remaining.length) return state;
  return {
    remaining: state.remaining.filter((slot) => !toTake.includes(slot)),
    assignments: [...state.assignments, ...toTake],
  };
}
