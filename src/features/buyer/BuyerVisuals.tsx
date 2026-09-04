import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import {
  Ban,
  Check,
  ChevronRight,
  PackagePlus,
  RotateCw,
  ShieldAlert,
  X,
} from "lucide-react";
import type { BreakAnalysis } from "../../data/evaluate";
import { toggleSlotTaken } from "../../domain/auction";
import type { AuctionState } from "../../domain/auction";
import type { AssignmentMode } from "../../domain/share-url";
import { cardDisplayName, cardTreatmentLabel } from "../../domain/card-label";
import { deduplicateOmissions } from "../../domain/omissions";
import { simulateOutcomesAsync } from "../../domain/simulation-client";
import type { DistributionSummary, SimulationResult } from "../../domain/simulation";
import type {
  BreakLine,
  Contributor,
  SlotId,
  ValuationResult,
} from "../../domain/types";
import { SLOT_IDS, SLOT_NAMES } from "../../domain/types";
import { DisclosureArrow, fmt, fmtChart, InformationLabel, PanelHeading, Status, Tip, oddsLabel, NumericInput, useDialogOwnership, plainEvidence } from "../shared/Primitives";
import { QuantityControl } from "../shared/ProductBuilder";
import { PublicCardPlaceholder } from "./CardPlaceholder";

export function Composition({
  lines,
  add,
  update,
  remove,
  headingLabel = "BREAK",
  showHelp = true,
}: {
  lines: BreakLine[];
  add: (opener?: HTMLElement) => void;
  update: (id: string, patch: Partial<BreakLine>) => void;
  remove: (id: string) => void;
  headingLabel?: string;
  showHelp?: boolean;
}) {
  const rows = lines.map((line) => (
    <div className="line" key={line.id}>
      <span className="set-glyph">{line.set}</span>
      <span className="line-identity">
        <strong>{line.productLabel}</strong>
        <small>{line.set}</small>
      </span>
      <QuantityControl
        line={line}
        update={(quantity) => update(line.id, { quantity })}
        onEmpty={() => remove(line.id)}
      />
    </div>
  ));
  return (
    <section className="composition" aria-label="What is in the break">
      <div className="step-heading">
        <InformationLabel>{headingLabel}</InformationLabel>
        {showHelp && <Tip label="What products do here" text="The sealed products being opened in this break. Changing any line recalculates card contents, prices, and color value straight away." />}
      </div>
      {rows}
      <button
        type="button"
        className={`add-products ${lines.length ? "quiet" : "primary"}`}
        onClick={(event) => add(event.currentTarget)}
      >
        <PackagePlus /> Add products
      </button>
    </section>
  );
}

export function ValueSummary({ result }: { result: ValuationResult }) {
  const ignoredEV = Math.max(0, result.marketEV - result.sellableEV);
  const countedCards = result.slots.reduce(
    (total, slot) => total + slot.contributors.length,
    0,
  );
  return (
    <section className="value-summary panel">
      <PanelHeading
        label={result.threshold > 0 ? "BREAK VALUE AFTER IGNORING BULK" : "BREAK VALUE · ALL PRICED CARDS"}
        help={result.threshold > 0
          ? "The average card value left after removing cards below your bulk-filter amount. This is an average across many possible openings, not a guaranteed result."
          : "Bulk filtering is off, so this average includes every priced card. It is an average across many possible openings, not a guaranteed result."}
        title={fmt(result.sellableEV)}
        accessory={<Status result={result} />}
      />
      <div className="metric-row">
        <div>
          <span>{result.threshold > 0 ? "Before ignoring bulk" : "All priced cards"}</span>
          <b>{fmt(result.marketEV)}</b>
        </div>
        <div>
          <span>{result.threshold > 0 ? "Ignored as bulk" : "Filtered out"}</span>
          <b>{fmt(ignoredEV)}</b>
        </div>
        <div>
          <span>Priced cards used</span>
          <b>{countedCards}</b>
        </div>
      </div>
      <p className="value-equation">
        <span>{fmt(result.marketEV)} all cards</span>
        <b>−</b>
        <span>{fmt(ignoredEV)} {result.threshold > 0 ? "ignored" : "filtered out"}</span>
        <b>=</b>
        <strong>{fmt(result.sellableEV)} used here</strong>
      </p>
    </section>
  );
}

/**
 * The break format decides what every later step means, so it leads the flow
 * and stays visible before any product exists. Color slots is pre-selected
 * because it is the common case. The difference between the two formats lives
 * behind one help icon rather than in a paragraph nobody reads mid-auction.
 */
export function BreakFormatChoice({
  assignmentMode,
  setAssignmentMode,
  selectedSlots,
  largeSpots,
  setLargeSpots,
  takenSlots = [],
  stepLabel = "1 · TYPE OF BREAK",
}: {
  assignmentMode: AssignmentMode;
  setAssignmentMode: (mode: AssignmentMode) => void;
  selectedSlots: SlotId[];
  largeSpots: number;
  setLargeSpots: (spots: number) => void;
  takenSlots?: SlotId[];
  stepLabel?: string;
}) {
  const isLarge = assignmentMode === "large";
  return (
    <section className="break-format-choice" aria-label="Type of break">
      <div className="step-heading">
        <InformationLabel>{stepLabel}</InformationLabel>
        <Tip
          label="What the two break types mean"
          text="Color slots: one slot per color, the standard prize wheel. Large break: many random spots, usually 100–200. Sellers change this between auctions, so match the listing."
        />
      </div>
      <div className="break-format-options" role="group" aria-label="Type of break">
        <button
          type="button"
          aria-pressed={!isLarge}
          className={`break-format-option ${isLarge ? "" : "active"}`}
          onClick={() => setAssignmentMode("random")}
        >
          <Check className="break-format-tick" aria-hidden="true" />
          Color slots
        </button>
        <button
          type="button"
          aria-pressed={isLarge}
          className={`break-format-option ${isLarge ? "active" : ""}`}
          onClick={() => setAssignmentMode("large")}
        >
          <Check className="break-format-tick" aria-hidden="true" />
          Large break
        </button>
      </div>
      {isLarge && <>
        <div className="large-break-spot-input">
          <div className="large-break-spot-label"><span>Random spots</span><Tip label="What the spot count means" text="How many random spots the seller is selling. Usually 100–200. 17 are catch-all spots; the rest use top-value cards, with characters grouped by name." /></div>
          <NumericInput value={largeSpots} onCommit={(value) => setLargeSpots(Math.max(1, Math.min(500, Math.round(value ?? 1))))} ariaLabel="Large break spot count" live />
        </div>
        <FormatCarryOverNotice selectedSlots={selectedSlots} takenSlots={takenSlots} />
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
  selectedSlots,
  takenSlots,
}: {
  selectedSlots: SlotId[];
  takenSlots: SlotId[];
}) {
  const names = (ids: SlotId[]) => ids.map((id) => SLOT_NAMES[id]).join(", ");
  const parts = [
    selectedSlots.length ? `the ${names(selectedSlots)} slot${selectedSlots.length === 1 ? "" : "s"} you marked as yours` : "",
    takenSlots.length ? `the ${names(takenSlots)} slot${takenSlots.length === 1 ? "" : "s"} you marked taken` : "",
  ].filter(Boolean);
  if (!parts.length) return null;
  return (
    <aside className="format-carryover-notice" role="status" aria-label="Color-slot choices a large break does not use">
      <ShieldAlert aria-hidden="true" />
      <div>
        <b>Kept, but not used by a large break</b>
        <p>A large break sells random spots drawn from the whole break, so it ignores {parts.join(" and ")}. Nothing was deleted — switch back to Color slots and every choice is still there.</p>
      </div>
    </aside>
  );
}

/**
 * One shared horizontal scale for every slot, so two candles can be compared
 * by eye. The wick is the practical 1st-to-99th percentile, the body is the
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
  const position = (value: number) => Math.min(100, Math.max(0, value / Math.max(scaleMax, 0.01) * 100));
  const low = distribution?.p01 ?? expectedValue;
  const high = distribution?.p99 ?? expectedValue;
  const bodyLow = Math.min(high, Math.max(low, distribution?.p25 ?? expectedValue));
  const bodyHigh = Math.max(bodyLow, Math.min(high, distribution?.p75 ?? expectedValue));
  return (
    <div className="slot-candle" aria-label={`${label}: low ${fmt(low)}, expected ${fmt(expectedValue)}, high ${fmt(high)}`}>
      <div className="slot-candle-track" aria-hidden="true">
        <span className="slot-candle-wick" style={{ left: `${position(low)}%`, width: `${Math.max(0, position(high) - position(low))}%` }} />
        <span className="slot-candle-body" style={{ left: `${position(bodyLow)}%`, width: `${Math.max(1, position(bodyHigh) - position(bodyLow))}%` }} />
        <span className="slot-candle-ev" style={{ left: `${position(expectedValue)}%` }} />
      </div>
      <div className="slot-candle-values" aria-hidden="true">
        <span><small>LOW</small>{fmtChart(low)}</span>
        <b><small>EV</small>{fmtChart(expectedValue)}</b>
        <span><small>HIGH</small>{fmtChart(high)}</span>
      </div>
    </div>
  );
}

const SLOT_HELP = "Tap the check on every slot you have already bought. Tap the cancel mark on every slot another buyer has taken. What is left is the pool your next bid draws from. LOW and HIGH are the 1st and 99th percentile of modeled openings, so the most extreme results are left out; EV is the average.";

/**
 * The slot rail is the buyer's whole picture of the break: what each colour is
 * worth, what they already own, and what is still in the pool. Meaning never
 * rests on colour alone — every state carries an icon and a word.
 */
export function SlotRail({
  result,
  auction,
  setAuction,
  selectedSlots,
  setSelectedSlots,
  distributions,
  stepLabel = "3 · MY SLOTS",
}: {
  result?: ValuationResult;
  auction: AuctionState;
  setAuction: (state: AuctionState) => void;
  selectedSlots: SlotId[];
  setSelectedSlots: (ids: SlotId[]) => void;
  distributions?: Record<SlotId, DistributionSummary>;
  stepLabel?: string;
}) {
  const scaleMax = Math.max(
    1,
    ...SLOT_IDS.map((id) => distributions?.[id]?.p99 ?? 0),
    ...(result?.slots.map((slot) => slot.sellableEV) ?? []),
  );
  const setOwned = (id: SlotId, owned: boolean) => {
    setSelectedSlots(owned ? [...selectedSlots, id] : selectedSlots.filter((slot) => slot !== id));
    const next = toggleSlotTaken(auction, id);
    if (next !== auction) setAuction(next);
  };
  return (
    <section className="buyer-slot-control" aria-label="My slots">
      <div className="step-heading">
        <InformationLabel>{stepLabel}</InformationLabel>
        <Tip label="What the slot controls do" text={SLOT_HELP} />
      </div>
      <div className="buyer-slot-list" role="group" aria-label="Color slots">
        {SLOT_IDS.map((id) => {
          const slot = result?.slots.find((row) => row.id === id);
          const mine = selectedSlots.includes(id);
          const available = auction.remaining.includes(id);
          const taken = !available && !mine;
          return (
            <div className={`buyer-slot-row ${mine ? "mine" : ""} ${taken ? "taken" : ""}`} key={id}>
              <div className="buyer-slot-top">
                <span className="buyer-slot-name">
                  <i className={`buyer-slot-swatch slot-${id}`} aria-hidden="true" />
                  {SLOT_NAMES[id]}
                  {mine && <b className="buyer-slot-tag buyer-slot-mine-tag">Mine</b>}
                  {taken && <b className="buyer-slot-tag buyer-slot-taken-tag">Taken</b>}
                </span>
                <div className="buyer-slot-actions">
                  <button
                    type="button"
                    className="slot-check-btn"
                    aria-pressed={mine}
                    disabled={taken}
                    aria-label={mine ? `${SLOT_NAMES[id]} is mine — undo` : `Mark ${SLOT_NAMES[id]} as mine`}
                    onClick={() => setOwned(id, !mine)}
                  >
                    <Check aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className="slot-disable-btn"
                    aria-pressed={taken}
                    disabled={mine || (available && auction.remaining.length === 1)}
                    aria-label={taken ? `Restore ${SLOT_NAMES[id]}` : `Mark ${SLOT_NAMES[id]} taken by another buyer`}
                    onClick={() => {
                      const next = toggleSlotTaken(auction, id);
                      if (next !== auction) setAuction(next);
                    }}
                  >
                    <Ban aria-hidden="true" />
                  </button>
                </div>
              </div>
              <SlotCandle
                distribution={distributions?.[id]}
                expectedValue={slot?.sellableEV ?? 0}
                scaleMax={scaleMax}
                label={SLOT_NAMES[id]}
              />
            </div>
          );
        })}
      </div>
    </section>
  );
}

function cardPreviewSubtitle(row: Contributor, priceOverride?: number): string {
  const finish = row.finish ?? (row.sellableFoilCopies > 0 ? "foil" : "nonfoil");
  const price = priceOverride ?? row.marketPrice ?? (finish === "foil" ? row.card.foil : row.card.nonfoil) ?? undefined;
  return `${fmt(price)} · ${cardTreatmentLabel(row.card, finish)} · ${row.card.set}`;
}

function CompactWarning({
  title,
  summary,
  children,
  className = "",
}: {
  title: ReactNode;
  summary: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <details className={`compact-warning ${className}`.trim()}>
      <summary className="disclosure-summary">
        <ShieldAlert />
        <span><b>{title}</b><small>{summary}</small></span>
        <DisclosureArrow />
      </summary>
      <div className="compact-warning-details">{children}</div>
    </details>
  );
}

function IncompleteDataWarning({ analysis, title = "Some values may be low", id, open, onOpenChange }: { analysis: BreakAnalysis; title?: string; id?: string; open?: boolean; onOpenChange?: (open: boolean) => void }) {
  const omissions = deduplicateOmissions([...analysis.valuation.omissions, ...analysis.outcomeOmissions]
    .filter((item) => item.material));
  if (analysis.valuation.status !== "incomplete" && analysis.outcomeModel.complete !== false) return null;
  const hasPriceGap = omissions.some((item) => /price|printing/.test(item.code));
  const hasPullRateGap = omissions.some((item) => /pull-rate/.test(item.code));
  const hasPackGap = omissions.some((item) => !/price|printing|pull-rate/.test(item.code));
  const effects = [
    "The estimate still uses all verified information.",
    hasPriceGap ? "Cards without a price count as $0." : "",
    hasPullRateGap ? "Cards with unknown pull chances stay in Rank by Price but are left out of EV." : "",
    hasPackGap ? "Unverified pack contents are not included." : "",
    "The real value may be higher.",
  ].filter(Boolean).join(" ");
  const technicalMessage = (message: string) => message
    .replace(/ Its price remains visible, but it is excluded from expected value and Rank by EV until the rate can be verified\.$/, "")
    .replace(/ Its price stays visible, but it adds \$0 to expected value and is omitted from Rank by EV because the exact chance of opening it is unknown\.$/, "");
  return (
    <details id={id} className="incomplete-data-warning" open={open} onToggle={(event) => onOpenChange?.(event.currentTarget.open)}>
      <summary className="disclosure-summary">
        <ShieldAlert />
        <span><b>{title}</b><small>Some prices, pull chances, or pack contents could not be verified.</small></span>
        <DisclosureArrow />
      </summary>
      <div className="incomplete-data-details">
        <p>{effects}</p>
        {omissions.length > 0 && <details className="incomplete-data-technical" open={open}>
          <summary className="disclosure-summary">
            <span><b>Technical details</b><small>{omissions.length} {omissions.length === 1 ? "issue" : "issues"}</small></span>
            <DisclosureArrow />
          </summary>
          <ul>{omissions.map((omission, index) => <li key={`${omission.code}-${index}`}>
            <span>{technicalMessage(omission.message)}</span>
            {omission.source && <a href={omission.source} target="_blank" rel="noreferrer">Source</a>}
          </li>)}</ul>
        </details>}
      </div>
    </details>
  );
}

export function CardInspector({
  row,
  status,
  threshold,
  onClose,
}: {
  row: Contributor | null;
  status: ValuationResult["status"];
  threshold: number;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const [faceIndex, setFaceIndex] = useState(0);

  useEffect(() => setFaceIndex(0), [row?.card.id, row?.finish]);

  useDialogOwnership(Boolean(row), onClose, dialogRef, closeRef);

  const affiliateTemplate = import.meta.env.VITE_TCGPLAYER_AFFILIATE_URL as
    | string
    | undefined;
  const affiliateUrl = row
    ? affiliateTemplate?.replace("{card}", encodeURIComponent(row.card.name))
    : undefined;
  const odds = row?.sellablePullProbability ?? 0;
  const selectedFinish = row?.finish ?? (row && row.sellableFoilCopies > 0 ? "foil" : "nonfoil");
  const selectedPrice = row
    ? row.marketPrice ?? (selectedFinish === "foil" ? row.card.foil : row.card.nonfoil) ?? undefined
    : undefined;
  const selectedPriceSource = row?.priceBasis === "listed-tcg"
    ? "Exact-printing listed TCG price"
    : row?.priceBasis === "same-printing-foil-market"
      ? "Same-printing foil market price"
      : "Exact-printing market price";
  const baseSelectedPrice = row
    ? selectedFinish === "foil" ? row.card.foil : selectedFinish === "nonfoil" ? row.card.nonfoil : undefined
    : undefined;
  const showSelectedFinishPrice = Boolean(row && (
    selectedFinish !== "nonfoil"
    || selectedPrice !== (baseSelectedPrice ?? undefined)
  ));
  const faces = row?.card.faces ?? [];
  const activeFace = faces[faceIndex];
  const activeOracleText = activeFace?.oracleText ?? row?.card.oracleText;
  return createPortal(
    <AnimatePresence>
      {row && (
        <motion.div
          className="scrim card-scrim"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onPointerDown={onClose}
        >
          <motion.section
            ref={dialogRef}
            className="card-inspector"
            role="dialog"
            aria-modal="true"
            aria-labelledby="card-inspector-title"
            initial={{ opacity: 0, y: 32, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.98 }}
            transition={{ type: "spring", damping: 28, stiffness: 340 }}
            onPointerDown={(event) => event.stopPropagation()}
          >
            <header>
              <div>
                <InformationLabel>CARD DETAILS</InformationLabel>
                <h2 id="card-inspector-title">{cardDisplayName(row.card, row.finish)}</h2>
              </div>
              <button
                ref={closeRef}
                className="icon-button"
                onClick={onClose}
                aria-label="Close card details"
              >
                <X />
              </button>
            </header>
            <div className="card-inspector-body">
              <div className="card-art">
                <PublicCardPlaceholder name={activeFace?.name ?? row.card.name} image={activeFace?.image ?? row.card.image} />
                {faces.length > 1 && (
                  <button
                    type="button"
                    className="flip-card"
                    onClick={() => setFaceIndex((current) => (current + 1) % faces.length)}
                    aria-label={`Flip to ${faces[(faceIndex + 1) % faces.length]?.name ?? (faceIndex === 0 ? "back face" : "front face")}`}
                  >
                    <RotateCw aria-hidden="true" /> Flip <small>{faceIndex + 1} / {faces.length}</small>
                  </button>
                )}
              </div>
              <div className="card-info">
                <div className="card-stat primary-stat">
                  <span>Chance to pull<Tip label="What the pull chance means" text="How often opening this whole break turns up at least one copy of this exact card version. It answers “will I see one at all”, not “how many”." /></span>
                  <strong>{oddsLabel(odds)}</strong>
                  <small>
                    {odds > 0 && odds < 1
                      ? `About 1 in ${(1 / odds).toFixed(odds < 0.1 ? 1 : 0)} breaks`
                      : odds >= 1
                        ? "Guaranteed by known contents"
                        : "No known pull path"}
                  </small>
                </div>
                <div className="card-price-grid">
                  <div className="card-stat">
                    <span>Nonfoil market</span>
                    <strong>{fmt(row.card.nonfoil ?? undefined)}</strong>
                  </div>
                  <div className="card-stat">
                    <span>Foil market</span>
                    <strong>{fmt(row.card.foil ?? undefined)}</strong>
                  </div>
                </div>
                {showSelectedFinishPrice && <div className="card-stat selected-finish-price">
                  <span>Selected finish price</span>
                  <strong>{fmt(selectedPrice)}</strong>
                  <small>{row ? `${cardTreatmentLabel(row.card, selectedFinish)} · ${selectedPriceSource}` : selectedPriceSource}</small>
                </div>}
                <div className="card-stat">
                  <span>Copies per break<Tip label="Why copies can differ from the pull chance" text="The average number of copies this break produces, counting every copy. It can be higher than the pull chance because some openings produce two or more copies while others produce none — the chance only counts whether you saw at least one." /></span>
                  <strong>
                    {row.sellableCopies.toFixed(3).replace(/0+$/, "").replace(/\.$/, "")}
                  </strong>
                  {threshold > 0 && <Tip
                    className="card-stat-flag"
                    label="A value filter is active"
                    text={`Card versions worth less than ${fmt(threshold)} are left out of this number. Turn the value filter off in Adjust assumptions to include them.`}
                  />}
                  {status !== "verified" && <small>Some product details are missing, so this could change.</small>}
                </div>
                {activeOracleText && (
                  <p className="oracle-text">{activeOracleText}</p>
                )}
                {affiliateUrl && (
                  <div className="affiliate-action">
                    <a href={affiliateUrl} rel="sponsored noreferrer" target="_blank">
                      Find this card on TCGplayer
                    </a>
                    <small>
                      Affiliate link. ColorBreak may earn a commission; it never
                      changes prices, odds, rankings, or analysis.
                    </small>
                  </div>
                )}
              </div>
            </div>
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
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
  const [state, setState] = useState<{ result?: SimulationResult; error?: string; busy: boolean }>({ busy: false });
  const [generation, setGeneration] = useState(0);
  const modelKey = analysis ? analysis.outcomeModel.cacheKey ?? JSON.stringify(analysis.outcomeModel) : "none";
  const key = analysis
    ? `${analysis.valuation.dataVersion}|${analysis.valuation.status}|${modelKey}|${analysis.valuation.threshold}|${remaining.join("")}|${landedCost ?? "none"}`
    : "none";
  useEffect(() => {
    if (!analysis) { setState({ busy: false }); return; }
    let current = true;
    let refinementId: number | undefined;
    setState((previous) => ({ ...previous, busy: true, error: undefined }));
    const options = {
      seed: key,
      sampleCount: 10_000,
      remaining,
      landedCost,
    };
    const model = analysis.outcomeModel;
    simulateOutcomesAsync(model, options).then((result) => {
      if (!current) return;
      setState({ result, busy: false });
      const refine = () => simulateOutcomesAsync(model, { ...options, sampleCount: 50_000 })
        .then((refined) => { if (current) setState({ result: refined, busy: false }); })
        .catch(() => { /* keep the valid interactive result */ });
      const idleWindow = window as Window & {
        requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
        cancelIdleCallback?: (id: number) => void;
      };
      if (idleWindow.requestIdleCallback) {
        refinementId = idleWindow.requestIdleCallback(refine, { timeout: 4000 });
      } else {
        refinementId = setTimeout(refine, 750);
      }
    }).catch((error) => {
      if (current) setState({ busy: false, error: error instanceof Error ? error.message : String(error) });
    });
    return () => {
      current = false;
      if (refinementId != null) {
        const idleWindow = window as Window & { cancelIdleCallback?: (id: number) => void };
        if (idleWindow.cancelIdleCallback) idleWindow.cancelIdleCallback(refinementId);
        else clearTimeout(refinementId);
      }
    };
  // `remaining` is often assembled inline by chart callers. The request key
  // captures its values; depending on the array identity creates a render loop.
  }, [key, generation]);
  return { ...state, retry: () => setGeneration((value) => value + 1) };
}

function OutcomeRange({ summary, landed, compact = false }: { summary?: DistributionSummary; landed?: number; compact?: boolean }) {
  if (!summary) return <div className="distribution-empty">Calculating the outcome range from the information currently available…</div>;
  const chanceToClear = landed == null
    ? undefined
    : summary.chanceToClearCost ?? summary.fingerprint.filter((value) => value >= landed).length / summary.fingerprint.length;
  return (
    <div className={`outcome-range ${compact ? "outcome-range-compact" : ""}`} aria-label="Possible opening values">
      <div className="outcome-range-heading">
        <span>{compact ? "Outcome range" : "Possible opening values"}</span>
        {!compact && <Tip text="Shows a lower result, a middle result, and a higher result across many simulated openings. These are examples of the range you could see, not a prediction of the next opening." />}
      </div>
      <div className="outcome-landmarks">
        <div>
          <span>{compact ? "Downside" : "Lower result"}</span>
          <b>{fmt(summary.p10)}</b>
          {!compact && <small>About 1 in 10 openings are worth this or less</small>}
        </div>
        <div className="typical">
          <span>{compact ? "Typical" : "Typical result"}</span>
          <b>{fmt(summary.median)}</b>
          {!compact && <small>About half are worth less and half are worth more</small>}
        </div>
        <div>
          <span>{compact ? "Upside" : "Higher result"}</span>
          <b>{fmt(summary.p90)}</b>
          {!compact && <small>About 1 in 10 openings are worth this or more</small>}
        </div>
      </div>
      {chanceToClear != null && landed != null && (
        <div className="clear-chance">
          <div><span>Chance card value covers your {fmt(landed)} cost</span><b>{Math.round(chanceToClear * 100)}%</b></div>
          <div className="clear-chance-track" aria-label={`${Math.round(chanceToClear * 100)}% chance card value covers your cost`}>
            <span style={{ width: `${chanceToClear * 100}%` }} />
          </div>
        </div>
      )}
      {summary.median === 0 && (
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
      matters: "These chances power the pull odds, typical outcome, and high and low ranges. Bad pack chances can make a correct price produce a wrong answer.",
      action: "When this is uncertain, use the shown range as a partial estimate. Missing pack chances can move the low, typical, and high outcomes in either direction.",
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

