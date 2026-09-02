import type {
  BreakLine,
  SlotId,
  ValuationResult,
} from "../../domain/types";
import type { AuctionState } from "../../domain/auction";
import type { AssignmentMode } from "../../domain/share-url";
import { SLOT_IDS } from "../../domain/types";
import { InformationLabel } from "../shared/Primitives";
import { BreakFormatChoice, Composition, SlotRail } from "./BuyerVisuals";
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
  selectedSlots,
  setSelectedSlots,
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
  selectedSlots: SlotId[];
  setSelectedSlots: (ids: SlotId[]) => void;
  bulkEnabled: boolean;
  bulkThreshold: number;
  setBulkEnabled: (enabled: boolean) => void;
  setBulkThreshold: (threshold: number) => void;
  largeSpots: number;
  setLargeSpots: (spots: number) => void;
}) {
  const isLarge = assignmentMode === "large";
  // A large break has no per-color slot step, so the value filter moves up a
  // number rather than leaving a gap the buyer has to explain to themselves.
  const valueFilterStep = isLarge ? "3 · VALUE FILTER" : "4 · VALUE FILTER";
  const takenSlots = SLOT_IDS.filter((id) => !auction.remaining.includes(id));
  return (
    <section id="buyer-break-setup" className="buyer-setup" aria-label="Bid setup">
      <BreakFormatChoice
        assignmentMode={assignmentMode}
        setAssignmentMode={setAssignmentMode}
        selectedSlots={selectedSlots}
        largeSpots={largeSpots}
        setLargeSpots={setLargeSpots}
        takenSlots={takenSlots}
      />
      <Composition
        lines={lines}
        add={add}
        update={update}
        remove={remove}
        headingLabel="2 · WHAT’S IN THE BREAK?"
        showHelp={false}
      />
      {lines.length > 0 && !isLarge && <SlotRail
        result={result}
        auction={auction}
        setAuction={setAuction}
        assignmentMode={assignmentMode}
        setAssignmentMode={setAssignmentMode}
        selectedSlots={selectedSlots}
        setSelectedSlots={setSelectedSlots}
      />}
      {lines.length > 0 && <details className="buyer-assumptions">
      <summary>Adjust assumptions</summary>
      <div className="buyer-options-heading">
        <InformationLabel>{valueFilterStep}</InformationLabel>
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
      </details>}
    </section>
  );
}
