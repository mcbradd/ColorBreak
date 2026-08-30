import type {
  BreakLine,
  SlotId,
  ValuationResult,
} from "../../domain/types";
import type { AuctionState } from "../../domain/auction";
import type { AssignmentMode } from "../../domain/share-url";
import { InformationLabel } from "../shared/Primitives";
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
  bulkEnabled: boolean;
  bulkThreshold: number;
  setBulkEnabled: (enabled: boolean) => void;
  setBulkThreshold: (threshold: number) => void;
  largeSpots: number;
  setLargeSpots: (spots: number) => void;
}) {
  return (
    <section id="buyer-break-setup" className="buyer-setup" aria-label="Bid setup">
      <SlotRail
        result={result}
        auction={auction}
        setAuction={setAuction}
        assignmentMode={assignmentMode}
        setAssignmentMode={setAssignmentMode}
        selected={selected}
        setSelected={setSelected}
        largeSpots={largeSpots}
        setLargeSpots={setLargeSpots}
      />
      <Composition
        lines={lines}
        add={add}
        update={update}
        remove={remove}
        headingLabel="2 · BREAK CONTENTS"
        showHelp={false}
      />
      <div className="buyer-options-heading">
        <InformationLabel>3 · VALUE FILTER</InformationLabel>
        <h2>Set what counts as value</h2>
      </div>
      <BulkFilterControl
        enabled={bulkEnabled}
        threshold={bulkThreshold}
        result={result}
        onToggle={setBulkEnabled}
        onThreshold={setBulkThreshold}
        compact
      />
    </section>
  );
}

