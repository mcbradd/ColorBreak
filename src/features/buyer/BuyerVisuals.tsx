import { probableRange, chartPosition, CANDLE_EXPLANATION } from "../../domain/outcome-chart";
import { summarizeDistribution } from "../../domain/simulation";
import { AnswerValue, AnswerNote, AnswerGroup } from "../shared/Answer";
import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CardInspector } from "../shared/CardInspector";
export { CardInspector } from "../shared/CardInspector";
import {
  Ban,
  Check,
  ChevronDown,
  ChevronRight,
  ShieldAlert,
  Target,
  X,
} from "lucide-react";
import type { BreakAnalysis } from "../../data/evaluate";
import { toggleSlotTaken } from "../../domain/auction";
import type { AuctionState } from "../../domain/auction";
import { bidCeiling, DEFAULT_BUYER_COSTS } from "../../domain/bid-ceiling";
import type { BuyerCosts } from "../../domain/bid-ceiling";
import type { AssignmentMode } from "../../domain/share-url";
import { cardTreatmentLabel } from "../../domain/card-label";
import { CompactWarning } from "../shared/Feedback";
import { IncompleteDataWarning, useOutcomeSimulation as useSharedOutcomeSimulation } from "../shared/OutcomeFeedback";
import type { DistributionSummary, SimulationResult } from "../../domain/simulation";
import type {
  Contributor,
  SlotId,
  ValuationResult,
} from "../../domain/types";
import { SLOT_IDS, SLOT_NAMES } from "../../domain/types";
import { DisclosureArrow, fmt, fmtCompact, InformationLabel, PanelHeading, Status, Tip, NumericInput, useDialogOwnership, plainEvidence } from "../shared/Primitives";
import { CardMemberList } from "../shared/CardMemberList";
import { InformationButton } from "../shared/InformationLayer";

export function ValueSummary({ result }: { result: ValuationResult }) {
  const ignoredEV = Math.max(0, result.marketEV - result.sellableEV);
  const countedCards = result.slots.reduce(
    (total, slot) => total + slot.contributors.length,
    0,
  );
  return (
    <AnswerGroup><section className="value-summary panel">
      <PanelHeading
        label={result.threshold > 0 ? "BREAK VALUE AFTER IGNORING BULK" : "BREAK VALUE · ALL PRICED CARDS"}
        estimate={<AnswerNote primary detail="Average value using current card prices and your filter. Missing prices can make totals too low." />}
        help={result.threshold > 0
          ? "The average card value left after removing cards below your bulk-filter amount. This is an average across many possible openings, not a guaranteed result."
          : "Bulk filtering is off, so this average includes every priced card. It is an average across many possible openings, not a guaranteed result."}
        title={<AnswerValue value={result.sellableEV} />}
        accessory={<Status result={result} />}
      />
      <div className="metric-row">
        <div>
          <span>{result.threshold > 0 ? "Before ignoring bulk" : "All priced cards"}</span>
          <b><AnswerValue value={result.marketEV} /></b>
        </div>
        <div>
          <span>{result.threshold > 0 ? "Ignored as bulk" : "Filtered out"}</span>
          <b><AnswerValue value={ignoredEV} /></b>
        </div>
        <div>
          <span>Priced cards used</span>
          <b>{countedCards}</b>
        </div>
      </div>
    </section></AnswerGroup>
  );
}

/**
 * The break format decides what every later step means, so it leads the flow
 * and stays visible before any product exists. Standard (8 Slots) is selected
 * because it is the common case. Help icons explain the formats and entry limit.
 */
export function BreakFormatChoice({
  assignmentMode,
  setAssignmentMode,
  targetSlots = [],
  largeSpots,
  setLargeSpots,
  takenSlots = [],
}: {
  assignmentMode: AssignmentMode;
  setAssignmentMode: (mode: AssignmentMode) => void;
  targetSlots?: SlotId[];
  largeSpots: number;
  setLargeSpots: (spots: number) => void;
  takenSlots?: SlotId[];
}) {
  const isLarge = assignmentMode === "large";
  return (
    <section className="break-format-choice" aria-label="Break format">
      <div className="step-heading">
        <Tip
          label="How break formats work"
          text="Standard (8 Slots): one slot for each color. Custom: choose 1–500 entries, matching Whatnot's limit of 500 products in a Surprise Set. Choose the format used by the listing."
        />
      </div>
      <div className="break-format-options" role="group" aria-label="Break format">
        <button
          type="button"
          aria-pressed={!isLarge}
          className={`break-format-option ${isLarge ? "" : "active"}`}
          onClick={() => setAssignmentMode("random")}
        >
          <Check className="break-format-tick" aria-hidden="true" />
          Standard (8 Slots)
        </button>
        <button
          type="button"
          aria-pressed={isLarge}
          className={`break-format-option ${isLarge ? "active" : ""}`}
          onClick={() => setAssignmentMode("large")}
        >
          <Check className="break-format-tick" aria-hidden="true" />
          Custom
        </button>
      </div>
      {isLarge && <>
        <div className="large-break-spot-input">
          <div className="large-break-spot-label"><span className="large-break-spot-label-text">Entries (1–500)</span><Tip label="About custom entries" text="Choose how many custom entries the listing has. The supported range is 1–500, matching Whatnot's maximum of 500 products in a Surprise Set." /></div>
          <NumericInput value={largeSpots} min={1} max={500} integer onCommit={(value) => setLargeSpots(Math.max(1, Math.min(500, Math.round(value ?? 1))))} ariaLabel="Custom entry count" live />
        </div>
        <FormatCarryOverNotice targetSlots={targetSlots} takenSlots={takenSlots} />
      </>}
    </section>
  );
}

/**
 * Switching to a large break keeps every color-slot choice in state, but a
 * large break cannot use them. Naming what is set aside — and saying plainly
 * that nothing was deleted — keeps the change visible instead of silent.
 */
export function FormatCarryOverNotice({
  targetSlots,
  takenSlots,
}: {
  targetSlots: SlotId[];
  takenSlots: SlotId[];
}) {
  const names = (ids: SlotId[]) => ids.map((id) => SLOT_NAMES[id]).join(", ");
  const parts = [
    takenSlots.length ? `the ${names(takenSlots)} slot${takenSlots.length === 1 ? "" : "s"} you marked taken` : "",
    targetSlots.length ? `the ${names(targetSlots)} slot${targetSlots.length === 1 ? "" : "s"} selected for bid preview` : "",
  ].filter(Boolean);
  if (!parts.length) return null;
  return (
    <aside className="format-carryover-notice" role="status" aria-label="Color-slot choices a large break does not use">
      <ShieldAlert aria-hidden="true" />
      <div>
        <b>Kept, but not used by a large break</b>
        <p>A large break sells random spots drawn from the whole break, so it ignores {parts.join(" and ")}. Nothing was deleted — switch back to Standard (8 Slots) and the choices are still there.</p>
      </div>
    </aside>
  );
}

/**
 * One shared horizontal scale for every slot, so two candles can be compared
 * by eye. The wick is the practical 1st-to-99th percentile range, the body is the
 * middle half, and the marker is the pull-rate average.
 */
export function SlotCandle({
  distribution,
  expectedValue,
  scaleMax,
  label,
}: {
  distribution?: DistributionSummary;
  expectedValue: number;
  scaleMax: number;
  label: string;
}) {
  const position = (value: number) => chartPosition(value, scaleMax);
  const { low, high, bodyLow, bodyHigh } = probableRange(distribution, expectedValue);
  const maximum = distribution?.max ?? expectedValue;
  return (
    <InformationButton className="slot-candle" title={`${label} value range`} label={`${label}: expected ${fmt(expectedValue)}, MAX ${fmt(maximum)}; probable low ${fmt(low)}, probable high ${fmt(high)}`} preview={`${label}: average ${fmt(expectedValue)}, maximum ${fmt(maximum)}. ${CANDLE_EXPLANATION}`} content={<>
      <p>Expected <AnswerValue label={`${label} expected value`} value={expectedValue} /> · Maximum <AnswerValue label={`${label} maximum`} value={maximum} /></p>
      <p>{CANDLE_EXPLANATION}</p><p>MAX is a possible upper limit using the available pack rules and prices. Missing prices or estimated odds can change it.</p>
    </>}>
      <div className="slot-candle-track" aria-hidden="true">
        <span className="slot-candle-wick" style={{ left: `${position(low)}%`, width: `${Math.max(0, position(high) - position(low))}%` }} />
        <span className="slot-candle-body" style={{ left: `${position(bodyLow)}%`, width: `${Math.max(1, position(bodyHigh) - position(bodyLow))}%` }} />
        <span className="slot-candle-ev" style={{ left: `${position(expectedValue)}%` }} />
      </div>

      <div className="slot-candle-values" aria-hidden="true">
        <b><small>EV</small>{fmtCompact(expectedValue)}</b>
        <span><small>MAX</small>{fmtCompact(maximum)}</span>
      </div>
    </InformationButton>
  );
}

const SLOT_HELP = "Mark a slot taken when another buyer wins it; it immediately leaves the remaining EV calculation. Select one or more available slots to preview their bid ceilings. With no selection, the overall recommendation uses the average EV across every remaining slot. Each slot shows its cost-adjusted bid ceiling.";

/**
 * The slot rail shows each color's EV and bid ceiling alongside availability
 * and preview selection.
 */
export function SlotRail({
  result,
  auction,
  setAuction,
  targetSlots = [],
  setTargetSlots = () => {},
  costs = DEFAULT_BUYER_COSTS,
  distributions,
  stepLabel = "Slot EV and bid ceilings",
}: {
  result?: ValuationResult;
  auction: AuctionState;
  setAuction: (state: AuctionState) => void;
  targetSlots?: SlotId[];
  setTargetSlots?: (ids: SlotId[]) => void;
  costs?: BuyerCosts;
  distributions?: Record<SlotId, DistributionSummary>;
  stepLabel?: string;
}) {
  const [expandedSlot, setExpandedSlot] = useState<SlotId | null>(null);
  const [inspectedCard, setInspectedCard] = useState<Contributor | null>(null);
  const scaleMax = Math.max(
    1,
    ...SLOT_IDS.map((id) => probableRange(distributions?.[id], result?.slots.find((slot) => slot.id === id)?.sellableEV ?? 0).high),
  );
  return (
    <section className="buyer-slot-control" aria-label="Slot EV and bid ceilings">
      <div className="step-heading">
        <InformationLabel>{stepLabel}</InformationLabel>
        <span className="section-help"><Tip label="What the slot controls do" text={SLOT_HELP} /><AnswerNote primary label="What affects the slot charts" detail={CANDLE_EXPLANATION} /></span>
      </div>
      <div className="buyer-slot-list" role="group" aria-label="Color slots">
        {SLOT_IDS.map((id) => {
          const slot = result?.slots.find((row) => row.id === id);
          const available = auction.remaining.includes(id);
          const taken = !available;
          const bidTarget = targetSlots.includes(id);
          const expectedValue = slot?.sellableEV ?? 0;
          const ceiling = bidCeiling(expectedValue, costs);
          const ceilingText = !available ? "Taken" : ceiling.kind === "ceiling" ? fmt(ceiling.hammer) : "No bid";
          return (
            <div className={`buyer-slot-row ${taken ? "taken" : ""} ${bidTarget ? "bid-target" : ""}`} key={id}>
              <div className="buyer-slot-top">
                <button type="button" className="buyer-slot-name buyer-slot-open" aria-label={`${expandedSlot === id ? "Hide" : "Show"} cards in ${SLOT_NAMES[id]} team`} aria-expanded={expandedSlot === id} onClick={() => setExpandedSlot((current) => current === id ? null : id)}>
                  <i className={`buyer-slot-swatch slot-${id}`} aria-hidden="true" />
                  {SLOT_NAMES[id]}
                  {taken && <b className="buyer-slot-tag buyer-slot-taken-tag">Taken</b>}
                  {bidTarget && <b className="buyer-slot-tag buyer-slot-bid-tag">Preview</b>}
                  <span className="buyer-slot-member-count">{slot?.contributors.length ?? 0} cards</span>
                  <ChevronDown className={expandedSlot === id ? "expanded" : ""} aria-hidden="true" />
                </button>
                <div className="buyer-slot-actions">
                  <button
                    type="button"
                    className="slot-target-btn"
                    aria-pressed={bidTarget}
                    disabled={!available}
                    aria-label={bidTarget ? `Remove ${SLOT_NAMES[id]} from bid preview` : `Select ${SLOT_NAMES[id]} for bid preview`}
                    title={bidTarget ? "Remove from bid preview" : "Preview bid ceiling"}
                    onClick={() => setTargetSlots(bidTarget ? targetSlots.filter((slot) => slot !== id) : [...targetSlots, id])}
                  >
                    <Target aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className="slot-disable-btn"
                    aria-pressed={taken}
                    disabled={available && auction.remaining.length === 1}
                    aria-label={taken ? `Restore ${SLOT_NAMES[id]}` : `Mark ${SLOT_NAMES[id]} taken by another buyer`}
                    onClick={() => {
                      const next = toggleSlotTaken(auction, id);
                      if (next !== auction) {
                        setAuction(next);
                        setTargetSlots(targetSlots.filter((slot) => next.remaining.includes(slot)));
                      }
                    }}
                  >
                    <Ban aria-hidden="true" />
                  </button>
                </div>
              </div>
              <SlotCandle
                distribution={distributions?.[id]}
                expectedValue={expectedValue}
                scaleMax={scaleMax}
                label={SLOT_NAMES[id]}
              />
              <div className="slot-bid-math" aria-label={`${SLOT_NAMES[id]} bid calculation`}>
                <span>Bid ceiling <b>{ceilingText}</b></span>
              </div>
              {expandedSlot === id && <div className="buyer-slot-members">
                <CardMemberList
                  rows={slot?.contributors ?? []}
                  onInspect={setInspectedCard}
                  groupName={`${SLOT_NAMES[id]} team`}
                  emptyMessage={`No ${SLOT_NAMES[id].toLowerCase()} cards are above the current bulk limit.`}
                />
              </div>}
            </div>
          );
        })}
      </div>
      <CardInspector row={inspectedCard} status={result?.status ?? "incomplete"} threshold={result?.threshold ?? 0} onClose={() => setInspectedCard(null)} />
    </section>
  );
}

function cardPreviewSubtitle(row: Contributor, priceOverride?: number): string {
  const finish = row.finish ?? (row.sellableFoilCopies > 0 ? "foil" : "nonfoil");
  const price = priceOverride ?? row.marketPrice ?? (finish === "foil" ? row.card.foil : row.card.nonfoil) ?? undefined;
  return `${fmt(price)} · ${cardTreatmentLabel(row.card, finish)} · ${row.card.set}`;
}


export type OutcomeSimulation = {
  result?: SimulationResult;
  error?: string;
  busy: boolean;
  retry: () => void;
};

export function useOutcomeSimulation(
  analysis: BreakAnalysis | undefined,
  remaining: SlotId[],
  landedCost: number | undefined,
): OutcomeSimulation {
  return useSharedOutcomeSimulation(analysis, remaining, landedCost, 0, true);
}

function OutcomeRange({ summary, landed, compact = false }: { summary?: DistributionSummary; landed?: number; compact?: boolean }) {
  summary ??= { ...summarizeDistribution([0]), preview: true };
  const chanceToClear = landed == null
    ? undefined
    : summary.chanceToClearCost ?? summary.fingerprint.filter((value) => value >= landed).length / summary.fingerprint.length;
  return (
    <div className={`outcome-range ${compact ? "outcome-range-compact" : ""}`} aria-label="Possible opening values">
      <div className="outcome-range-heading">
        <span>{summary.preview ? "Quick value range" : compact ? "Outcome range" : "Possible opening values"}<AnswerNote detail={summary.preview ? "MIN and MAX use available pack rules now. The median outcome is a preview while sampling finishes; missing data may change the limits. Bid ceilings use average EV, shown separately." : "MIN and MAX are possible values under the current pack rules and prices. The median outcome is shown below; bid ceilings use average EV per slot. Missing data and price changes can move these values."} /></span>
        {!compact && <Tip text="MIN and MAX include the rarest outcomes permitted by the pack model. The median is the middle simulated outcome. Bid ceilings use average EV per slot, which can differ from the median." />}
      </div>
      <div className="outcome-landmarks">
        <div>
          <span>MIN</span>
          <b><AnswerValue value={summary.min} compact /></b>
          {!compact && <small>Minimum possible modeled value</small>}
        </div>
        <div className="typical">
          <span>{compact ? "Median" : "Median outcome"}</span>
          <b><AnswerValue value={summary.median} compact /></b>
          {!compact && <small>About half are worth less and half are worth more</small>}
        </div>
        <div>
          <span>MAX</span>
          <b><AnswerValue value={summary.max} compact /></b>
          {!compact && <small>Maximum possible modeled value</small>}
        </div>
      </div>
      {chanceToClear != null && landed != null && (
        <div className="clear-chance">
          <div><span>Chance card value covers your <AnswerValue value={landed} /> cost</span><b>{Math.round(chanceToClear * 100)}%<AnswerNote detail={summary.preview ? "Preview compares known color averages with cost. It is not yet a simulated chance of recovering your cost." : "Share of modeled openings whose listed card values cover the entered cost. Selling fees, missing prices and real opening variation can change the result."} /></b></div>
          <div className="clear-chance-track" aria-label={`${Math.round(chanceToClear * 100)}% chance card value covers your cost`}>
            <span style={{ width: `${chanceToClear * 100}%` }} />
          </div>
        </div>
      )}
      {summary.median === 0 && !summary.preview && (
        <p className="outcome-range-zero-note">Usually no card above the bulk filter — most openings land at $0.</p>
      )}
      {!compact && <p>Possible results from simulations—not a prediction of the next opening.</p>}
    </div>
  );
}

interface EvidenceExplanation {
  title: string;
  status: string;
  meaning: string;
  matters: string;
  action: string;
}

function EvidenceDialog({ item, onClose }: { item: EvidenceExplanation | null; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  useDialogOwnership(Boolean(item), onClose, dialogRef, closeRef);
  if (!item) return null;
  return createPortal(
    <div className="scrim evidence-scrim" onPointerDown={onClose}>
      <section ref={dialogRef} className="evidence-dialog" role="dialog" aria-modal="true" aria-labelledby="evidence-dialog-title" onPointerDown={(event) => event.stopPropagation()}>
        <header>
          <div><InformationLabel>WHY THIS MATTERS</InformationLabel><h2 id="evidence-dialog-title">{item.title}</h2></div>
          <button ref={closeRef} className="icon-button" onClick={onClose} aria-label="Close explanation"><X /></button>
        </header>
        <div className="evidence-explanation">
          <p className="evidence-current"><span>Current check</span><strong>{item.status}</strong></p>
          <section><h3>What is it?</h3><p>{item.meaning}</p></section>
          <section><h3>Why should I care?</h3><p>{item.matters}</p></section>
          <section><h3>What should I do?</h3><p>{item.action}</p></section>
        </div>
      </section>
    </div>,
    document.body,
  );
}

export { cardPreviewSubtitle, CompactWarning, IncompleteDataWarning, OutcomeRange, EvidenceDialog, EvidenceLens };

function EvidenceLens({ analysis }: { analysis: BreakAnalysis }) {
  const [selected, setSelected] = useState<EvidenceExplanation | null>(null);
  const { valuation } = analysis;
  const priceAvailability = analysis.priceAvailability ?? {
    status: "unavailable" as const,
    source: "none" as const,
    message: "Price-source availability was not reported for this analysis.",
  };
  const priced = Date.parse(valuation.pricedAt);
  const ageHours = Number.isFinite(priced) ? Math.max(0, (Date.now() - priced) / 36e5) : undefined;
  const labels: EvidenceExplanation[] = [
    {
      title: "Exact product",
      status: plainEvidence(valuation.evidence.productIdentity),
      meaning: "This checks that ColorBreak is using the exact box, bundle, or pack in the auction—not a similarly named product.",
      matters: "Two products from the same set can contain different packs, promos, and card chances. Choosing the wrong one can change every number on this page.",
      action: "Match the product name and contents to the seller's listing. If this check is uncertain, do not rely on the bid guidance.",
    },
    {
      title: "Items inside",
      status: plainEvidence(valuation.evidence.contents),
      meaning: "This checks which packs, promos, box toppers, decks, and fixed cards are actually inside the sealed product.",
      matters: "An uncounted promo or topper can hide real value. A pack counted by mistake can make the break look better than it is.",
      action: "Use the result normally when this is ready. If a warning appears, open it for a short explanation or the exact technical details.",
    },
    {
      title: "Pack chances",
      status: plainEvidence(valuation.evidence.collation),
      meaning: "A pack is not filled by picking every card equally. This check describes how often each kind of card can appear.",
      matters: "These chances power the pull odds, typical outcome, and MIN and MAX limits. Bad pack chances can make a correct price produce a wrong answer.",
      action: "When this is uncertain, use the shown range as a partial estimate. Missing pack chances can move the MIN, typical, and MAX values in either direction.",
    },
    {
      title: "Card versions",
      status: plainEvidence(valuation.evidence.finish),
      meaning: "The same card can be nonfoil, foil, etched, textured, or another special version, and each version can have a different price.",
      matters: "Using a premium version's price for an ordinary copy can badly overstate value. Missing a guaranteed premium version can understate it.",
      action: "Check the seller's exact product version when this is uncertain. ColorBreak will not silently swap one card version's price for another.",
    },
    {
      title: "Card prices",
      status: priceAvailability.status === "available" ? "Ready" : plainEvidence(priceAvailability.status),
      meaning: `These are saved market-price observations${ageHours == null ? "" : ` from about ${ageHours < 1 ? "less than one" : Math.round(ageHours)} hours ago`}—not guaranteed sale prices.`,
      matters: "Prices move, and a listed market price does not promise that you can sell the card for that amount. Older prices make the bid comparison less dependable.",
      action: "Give yourself more room below the shown value when prices are old or missing, especially when one expensive card drives most of a color's value.",
    },
    {
      title: "Color assignment rules",
      status: plainEvidence(valuation.evidence.breakRules),
      meaning: "This says where multicolor cards, colorless cards, lands, double-faced cards, promos, and toppers go in the break.",
      matters: "The total break value may stay the same while the value of the color you can win changes a lot. Seller rules can differ from ColorBreak's preset.",
      action: "Confirm the seller's rules before bidding. If they differ, update the rules or avoid using the per-color guidance.",
    },
  ];
  return (
    <details className="rollout evidence-lens">
      <summary className="disclosure-summary">
        <span><ShieldAlert /><b>Data confidence</b><small>{analysis.outcomeModel.complete === false ? "Resolved-only result · exact missing items listed below" : "All key information is ready"}</small></span>
        <span className="summary-actions"><span className="summary-help"><span>{ageHours == null ? "Price time unknown" : `Prices ${ageHours < 1 ? "<1" : Math.round(ageHours)}h old`}</span><Tip text="Shows which product details were checked, what is missing, and how those gaps may affect the values and outcome ranges shown." /></span><DisclosureArrow /></span>
      </summary>
      <div className="evidence-grid">
        {labels.map((item) => (
          <button key={item.title} type="button" onClick={() => setSelected(item)} aria-label={`Explain ${item.title}: ${item.status}`}>
            <span>{item.title}</span><b>{item.status}</b><ChevronRight />
          </button>
        ))}
      </div>
      <p className="evidence-price-note">Price source: {priceAvailability.source === "snapshot" ? "saved Scryfall prices" : plainEvidence(priceAvailability.source)}.</p>
      {analysis.outcomeOmissions.length > 0 && (
        <ul>{analysis.outcomeOmissions.slice(0, 8).map((omission, index) => <li key={`${omission.code}-${index}`}>{omission.message}</li>)}</ul>
      )}
      <EvidenceDialog item={selected} onClose={() => setSelected(null)} />
    </details>
  );
}
