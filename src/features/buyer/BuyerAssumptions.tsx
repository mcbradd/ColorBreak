import { Filter, SlidersHorizontal } from "lucide-react";
import type { ValuationResult } from "../../domain/types";
import type { useBuyerCosts } from "../shared/useBuyerCosts";
import { AnswerGroup, AnswerNote } from "../shared/Answer";
import { InformationButton } from "../shared/InformationLayer";
import { InformationLabel, NumberField, Tip } from "../shared/Primitives";
import { ShippingField } from "../shared/ShippingField";
import { BulkFilterControl } from "./BuyerDetails";

export function BuyerAssumptions({ costs, bulkEnabled, bulkThreshold, setBulkEnabled, setBulkThreshold, result, open, onOpenChange, opener, onOpen }: {
  costs: ReturnType<typeof useBuyerCosts>; bulkEnabled: boolean; bulkThreshold: number;
  setBulkEnabled: (enabled: boolean) => void; setBulkThreshold: (threshold: number) => void;
  result?: ValuationResult; open: boolean; onOpenChange: (open: boolean) => void; opener: HTMLElement | null; onOpen: () => void;
}) {
  return <div className="buyer-header-actions">
    <InformationButton title="Assumptions" label="Adjust assumptions" className="buyer-assumptions-button" open={open} onOpenChange={onOpenChange} invokingElement={opener} onOpen={onOpen}
      preview="Adjust shipping, tax and the bulk-value threshold." content={<AnswerGroup><div className="buyer-assumptions-body">
        <div className="step-heading"><InformationLabel>MY COSTS</InformationLabel><span className="section-help">
          <Tip label="What these costs do" text="Shipping and tax come off the bid limit. Flat fee charges once per combined shipment; per item charges every purchased spot." />
          <AnswerNote primary label="What affects the cost assumptions" detail="Shipping uses a weight-based US label estimate. Tax is a regional guess from your device time zone. Your typed amounts replace these guesses." />
        </span></div>
        <div id="buyer-costs" className="buyer-cost-fields">
          <ShippingField value={costs.amount} mode={costs.mode} onValue={shipping => costs.update({ shipping })} onMode={shippingMode => costs.update({ shippingMode })} hint={costs.shippingNote} />
          <NumberField label="Tax" prefix="" suffix="%" value={costs.costs.taxPercent} onChange={value => costs.update({ taxPercent: value ?? 0 })} max={100} hint={costs.taxNote} live inline />
        </div>
        <div className="step-heading"><InformationLabel>VALUE FILTER</InformationLabel><Tip label="What the value filter does" text="Cards worth less than this each are left out of every number. Cards worth exactly this amount are still counted." /></div>
        <BulkFilterControl enabled={bulkEnabled} threshold={bulkThreshold} result={result} onToggle={setBulkEnabled} onThreshold={setBulkThreshold} compact />
      </div></AnswerGroup>}><SlidersHorizontal aria-hidden="true" /><span className="sr-only">Adjust assumptions</span></InformationButton>
    <button type="button" className="buyer-header-bulk" role="switch" aria-label="Bulk filter" aria-checked={bulkEnabled} title={`Bulk filtering ${bulkEnabled ? "on" : "off"}`} onClick={() => setBulkEnabled(!bulkEnabled)}><Filter aria-hidden="true" /><span>Bulk</span></button>
  </div>;
}
