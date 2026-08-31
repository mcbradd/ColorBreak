import type {
  BreakLine,
  SlotId,
  ValuationResult,
} from "../../domain/types";
import type { AuctionState } from "../../domain/auction";
import type { AssignmentMode } from "../../domain/share-url";
import { Composition, SlotRail } from "./BuyerVisuals";
import { BulkFilterControl } from "./BuyerDetails";

export function BuyerSetup({
  lines,
  add,
  update,
  remove,
  result,
  auction,
  setAuction,
  assignmentMode,
  setAssignmentMode,
  selected,
  setSelected,
  slotChosen,
  onSlotChosen,
  bulkEnabled,
  bulkThreshold,
  setBulkEnabled,
  setBulkThreshold,
  largeSpots,
  setLargeSpots,
}: {
  lines: BreakLine[];
  add: (opener?: HTMLElement) => void;
  update: (id: string, patch: Partial<BreakLine>) => void;
  remove: (id: string) => void;
  result?: ValuationResult;
  auction: AuctionState;
  setAuction: (state: AuctionState) => void;
  assignmentMode: AssignmentMode;
  setAssignmentMode: (mode: AssignmentMode) => void;
  selected: SlotId;
  setSelected: (slot: SlotId) => void;
  slotChosen: boolean;
  onSlotChosen: () => void;
  bulkEnabled: boolean;
  bulkThreshold: number;
  setBulkEnabled: (enabled: boolean) => void;
  setBulkThreshold: (threshold: number) => void;
  largeSpots: number;
  setLargeSpots: (spots: number) => void;
}) {
  return (
    <section id="buyer-break-setup" className="buyer-setup" aria-label="Bid setup">
      <Composition
        lines={lines} add={add} update={update} remove={remove}
        headingLabel="1 · WHAT'S IN THE BREAK?" showHelp={false}
      />
      {lines.length > 0 && <SlotRail
        result={result}
        auction={auction}
        setAuction={setAuction}
        assignmentMode={assignmentMode}
        setAssignmentMode={setAssignmentMode}
        selected={selected}
        setSelected={setSelected}
        slotChosen={slotChosen}
        onSlotChosen={onSlotChosen}
        largeSpots={largeSpots}
        setLargeSpots={setLargeSpots}
      />}
      {lines.length > 0 && <details className="buyer-advanced"><summary>Adjust assumptions</summary><BulkFilterControl
        enabled={bulkEnabled}
        threshold={bulkThreshold}
        result={result}
        onToggle={setBulkEnabled}
        onThreshold={setBulkThreshold}
        compact
      /></details>}
    </section>
  );
}

