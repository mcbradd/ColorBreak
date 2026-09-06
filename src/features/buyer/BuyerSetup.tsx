import type {
  BreakLine,
  SlotId,
  ValuationResult,
} from "../../domain/types";
import type { AuctionState } from "../../domain/auction";
import type { AssignmentMode } from "../../domain/share-url";
import type { DistributionSummary } from "../../domain/simulation";
import type { useBuyerCosts } from "../shared/useBuyerCosts";
import { ShippingField } from "../shared/ShippingField";
import { SLOT_IDS } from "../../domain/types";
import { DisclosureArrow, InformationLabel, NumberField, Tip } from "../shared/Primitives";
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
  distributions,
  bulkEnabled,
  bulkThreshold,
  setBulkEnabled,
  setBulkThreshold,
  costs,
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
  distributions?: Record<SlotId, DistributionSummary>;
  bulkEnabled: boolean;
  bulkThreshold: number;
  setBulkEnabled: (enabled: boolean) => void;
  setBulkThreshold: (threshold: number) => void;
  costs: ReturnType<typeof useBuyerCosts>;
  largeSpots: number;
  setLargeSpots: (spots: number) => void;
}) {
  const isLarge = assignmentMode === "large";
  // Owned slots are out of the pool too, so "taken" means taken by someone
  // else — otherwise the carry-over notice reports the buyer's own slots twice.
  const takenSlots = SLOT_IDS.filter((id) => !auction.remaining.includes(id) && !selectedSlots.includes(id));
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
        headingLabel="2 · WHAT’S IN IT"
        showHelp={false}
      />
      {lines.length > 0 && !isLarge && <SlotRail
        result={result}
        auction={auction}
        setAuction={setAuction}
        selectedSlots={selectedSlots}
        setSelectedSlots={setSelectedSlots}
        distributions={distributions}
      />}
      {lines.length > 0 && <details className="buyer-assumptions">
        <summary className="disclosure-summary">
          <span>Adjust assumptions</span>
          <DisclosureArrow />
        </summary>
        <div className="buyer-assumptions-body">
          <div className="step-heading">
            <InformationLabel>{isLarge ? "3 · MY COSTS" : "4 · MY COSTS"}</InformationLabel>
            <Tip
              label="What these costs do"
              text="Everything you pay on top of the hammer price. They come off the modeled value, so the bid limit is what you can actually pay. Set them once — they stay until you change them."
            />
          </div>
          <div className="buyer-cost-fields">
            <ShippingField value={costs.amount} mode={costs.mode} onValue={(shipping) => costs.update({ shipping })} onMode={(shippingMode) => costs.update({ shippingMode })} hint={costs.shippingNote} />
            <NumberField label="Tax" prefix="" suffix="%" value={costs.costs.taxPercent} onChange={(value) => costs.update({ taxPercent: value ?? 0 })} max={100} hint={costs.taxNote} live inline />
          </div>
          <div className="step-heading">
            <InformationLabel>VALUE FILTER</InformationLabel>
            <Tip
              label="What the value filter does"
              text="Cards worth less than this each are left out of every number in ColorBreak. Cards worth exactly this amount are still counted. It is a value cut-off, not a claim about what will sell."
            />
          </div>
          <BulkFilterControl
            enabled={bulkEnabled}
            threshold={bulkThreshold}
            result={result}
            onToggle={setBulkEnabled}
            onThreshold={setBulkThreshold}
            compact
          />
        </div>
      </details>}
    </section>
  );
}
