import type {
  BreakLine,
  SlotId,
  ValuationResult,
} from "../../domain/types";
import type { AuctionState } from "../../domain/auction";
import type { AssignmentMode } from "../../domain/share-url";
import type { DistributionSummary } from "../../domain/simulation";
import { SLOT_IDS } from "../../domain/types";
import { BreakFormatChoice, SlotRail } from "./BuyerVisuals";
import { QuickBreakComposer } from "../shared/QuickBreakComposer";

export function BuyerSetup({
  lines,
  onChange,
  onImport,
  result,
  auction,
  setAuction,
  assignmentMode,
  setAssignmentMode,
  selectedSlots,
  setSelectedSlots,
  distributions,
  largeSpots,
  setLargeSpots,
}: {
  lines: BreakLine[];
  onChange: (lines: BreakLine[]) => void;
  onImport: (opener?: HTMLElement) => void;
  result?: ValuationResult;
  auction: AuctionState;
  setAuction: (state: AuctionState) => void;
  assignmentMode: AssignmentMode;
  setAssignmentMode: (mode: AssignmentMode) => void;
  selectedSlots: SlotId[];
  setSelectedSlots: (ids: SlotId[]) => void;
  distributions?: Record<SlotId, DistributionSummary>;
  largeSpots: number;
  setLargeSpots: (spots: number) => void;
}) {
  const isLarge = assignmentMode === "large";
  // Owned slots are out of the pool too, so "taken" means taken by someone
  // else — otherwise the carry-over notice reports the buyer's own slots twice.
  const takenSlots = SLOT_IDS.filter((id) => !auction.remaining.includes(id) && !selectedSlots.includes(id));
  return (
    <section id="buyer-break-setup" className="buyer-setup" aria-label="Bid setup">
      <div id="buyer-products" className="buyer-entry-panel" data-command-panel="products" tabIndex={-1}>
      <BreakFormatChoice
        assignmentMode={assignmentMode}
        setAssignmentMode={setAssignmentMode}
        selectedSlots={selectedSlots}
        largeSpots={largeSpots}
        setLargeSpots={setLargeSpots}
        takenSlots={takenSlots}
      />
      <QuickBreakComposer
        lines={lines}
        onChange={onChange}
        onImport={onImport}
      />

      </div>
      {lines.length > 0 && !isLarge && <div id="buyer-teams" className="buyer-team-panel" data-command-panel="products" tabIndex={-1}><SlotRail
        result={result}
        auction={auction}
        setAuction={setAuction}
        selectedSlots={selectedSlots}
        setSelectedSlots={setSelectedSlots}
        distributions={distributions}
      /></div>}
    </section>
  );
}
