import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import {
  ChevronRight,
  PackagePlus,
  RotateCw,
  ShieldAlert,
  Trash2,
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
  const [expanded, setExpanded] = useState(lines.length <= 4);
  useEffect(() => {
    if (lines.length <= 4) setExpanded(true);
  }, [lines.length]);
  const totalOpenings = lines.reduce((total, line) => total + line.quantity * Math.max(1, line.packCount ?? 1), 0);
  const rows = lines.map((line) => (
    <div className="line" key={line.id}>
      <span className="set-glyph">{line.set}</span>
      <span className="line-identity">
        <strong>{line.productLabel}</strong>
        <small>{line.set} · {line.packCount && line.packCount > 1 ? `${line.packCount} openings each` : "1 opening each"}</small>
      </span>
      <div className="line-controls">
        <QuantityControl line={line} update={(quantity) => update(line.id, { quantity })} />
        <button
          className="remove-line"
          aria-label={`Remove ${line.productLabel} from break`}
          title="Remove from break"
          onClick={() => remove(line.id)}
        >
          <Trash2 />
        </button>
      </div>
    </div>
  ));
  return (
    <section className="composition panel">
      <PanelHeading
        label={headingLabel}
        help={showHelp ? "The sealed products and quantities being opened in this break. Changing any line immediately recalculates card contents, prices, color value, and possible opening values." : undefined}
        title={<>{lines.length} line{lines.length === 1 ? "" : "s"} · {totalOpenings} opening{totalOpenings === 1 ? "" : "s"}</>}
        accessory={<button className={lines.length ? "quiet" : "primary composition-add-primary"} onClick={(event) => add(event.currentTarget)}>
          <PackagePlus /> Add products
        </button>}
      />
      {lines.length > 4 ? <details className="composition-roster" open={expanded} onToggle={(event) => setExpanded(event.currentTarget.open)}>
        <summary className="disclosure-summary"><span>{expanded ? "Hide product editor" : `Review ${lines.length} product lines`}</span><b>{totalOpenings} openings</b><DisclosureArrow /></summary>
        <div>{rows}</div>
      </details> : rows}
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

export function SlotRail({
  result,
  auction,
  setAuction,
  assignmentMode,
  setAssignmentMode,
  selected,
  setSelected,
  largeSpots,
  setLargeSpots,
}: {
  result?: ValuationResult;
  auction: AuctionState;
  setAuction: (state: AuctionState) => void;
  assignmentMode: AssignmentMode;
  setAssignmentMode: (mode: AssignmentMode) => void;
  selected: SlotId;
  setSelected: (id: SlotId) => void;
  largeSpots: number;
  setLargeSpots: (spots: number) => void;
}) {
  const [editingAvailability, setEditingAvailability] = useState(false);
  const [modeSwitchUndo, setModeSwitchUndo] = useState<{ mode: AssignmentMode; selected: SlotId } | null>(null);
  return (
    <section className="buyer-slot-control" aria-labelledby="buyer-color-heading">
      <div className="buyer-slot-heading">
        <div>
          <InformationLabel>1 · BREAK FORMAT</InformationLabel>
          <h2 id="buyer-color-heading">{assignmentMode === "pick" ? "Choose your color" : assignmentMode === "random" ? "Mark colors already taken" : "Set the random spot count"}</h2>
          <p>{assignmentMode === "large" ? "For top-value cards and the 17 catch-all spots." : editingAvailability ? "Availability editing is separate from color selection." : "Tap a color to select it."}</p>
        </div>
      </div>
      <div className="assignment-toggle buyer-assignment-toggle" role="group" aria-label="Break assignment mode">
        <button aria-pressed={assignmentMode === "pick"} className={assignmentMode === "pick" ? "active" : ""} onClick={() => {
          const nextSelected = auction.remaining.includes(selected) ? selected : auction.remaining[0];
          if (nextSelected) setSelected(nextSelected);
          setAssignmentMode("pick");
          setModeSwitchUndo(null);
        }}>Pick a color</button>
        <button aria-pressed={assignmentMode === "random"} className={assignmentMode === "random" ? "active" : ""} onClick={() => { setAssignmentMode("random"); setModeSwitchUndo(null); }}>Random remaining</button>
        <button aria-pressed={assignmentMode === "large"} className={assignmentMode === "large" ? "active" : ""} onClick={() => { setAssignmentMode("large"); setModeSwitchUndo(null); }}>Large break</button>
      </div>
      {modeSwitchUndo && <aside className="import-undo mode-switch-undo" role="status" aria-live="polite">
        <span><b>Switched to Pick a color</b><small>Tapping a color chip while marking colors taken switches modes. Random remaining is now off.</small></span>
        <button type="button" className="quiet" onClick={() => {
          setAssignmentMode(modeSwitchUndo.mode);
          setSelected(modeSwitchUndo.selected);
          setModeSwitchUndo(null);
        }}>Undo</button>
      </aside>}
      {assignmentMode === "large" ? (
        <div className="large-break-spot-input">
          <div className="large-break-spot-label"><span>Random spots</span><small>Usually 100–200</small></div>
          <NumericInput value={largeSpots} onCommit={(value) => setLargeSpots(Math.max(1, Math.min(500, Math.round(value ?? 1))))} ariaLabel="Large break spot count" live />
          <p><b>17</b> catch-all spots · remaining spots use top-value cards, with characters grouped by name</p>
        </div>
      ) : <><div className="buyer-slot-rail" role="group" aria-label="Color slots">
        {SLOT_IDS.map((id) => {
          const slot = result?.slots.find((row) => row.id === id);
          const taken = !auction.remaining.includes(id);
          return (
            <div className={`buyer-slot-tile slot-${id} ${selected === id && assignmentMode === "pick" ? "active" : ""} ${taken ? "taken" : ""}`} key={id}>
              <button
                type="button"
                aria-pressed={selected === id && assignmentMode === "pick"}
                aria-label={`${SLOT_NAMES[id]} slot`}
                disabled={taken}
                className="buyer-slot-select"
                onClick={() => {
                  if (assignmentMode === "random") setModeSwitchUndo({ mode: assignmentMode, selected });
                  setSelected(id);
                  setAssignmentMode("pick");
                }}
              >
                <span>{id}</span>
                <b>{slot ? fmt(slot.sellableEV) : "—"}</b>
                <small>{taken ? "Taken" : SLOT_NAMES[id]}</small>
              </button>
            </div>
          );
        })}
      </div>
      <div className="availability-editor">
        <button type="button" className="quiet" aria-expanded={editingAvailability} onClick={() => setEditingAvailability((value) => !value)}>{editingAvailability ? "Done editing availability" : "Edit availability"}</button>
        {editingAvailability && <div className="availability-actions" role="group" aria-label="Color availability">
          {SLOT_IDS.map((id) => {
            const taken = !auction.remaining.includes(id);
            const finalAvailable = !taken && auction.remaining.length === 1;
            return <button type="button" key={id} aria-label={taken ? `Restore ${SLOT_NAMES[id]} slot` : `Mark ${SLOT_NAMES[id]} taken`} aria-pressed={taken} disabled={finalAvailable} onClick={() => {
              const next = toggleSlotTaken(auction, id);
              if (next === auction) return;
              setAuction(next);
              setAssignmentMode("random");
              if (!next.remaining.includes(selected)) setSelected(next.remaining[0]);
            }}>{taken ? `Restore ${id}` : `Mark ${id} taken`}</button>;
          })}
        </div>}
      </div>
      <p className="remaining-summary">{assignmentMode === "random" ? `${auction.remaining.length} colors remain in the random pool` : `${SLOT_NAMES[selected]} selected`}</p></>}
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
                <PublicCardPlaceholder name={activeFace?.name ?? row.card.name} />
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
                  <span>Pull odds in this break</span>
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
                  <span>Average copies per break</span>
                  <strong>
                    {row.sellableCopies.toFixed(3).replace(/0+$/, "").replace(/\.$/, "")}
                  </strong>
                  <small>
                    {status === "verified"
                      ? `Card versions worth ${fmt(threshold)} or more are included.`
                      : "This uses the product information currently available. Missing details could change it."}
                  </small>
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

export function useOutcomeSimulation(
  analysis: BreakAnalysis,
  remaining: SlotId[],
  landedCost: number | undefined,
): { result?: SimulationResult; error?: string; busy: boolean; retry: () => void } {
  const [state, setState] = useState<{ result?: SimulationResult; error?: string; busy: boolean }>({ busy: false });
  const [generation, setGeneration] = useState(0);
  const modelKey = analysis.outcomeModel.cacheKey ?? JSON.stringify(analysis.outcomeModel);
  const key = `${analysis.valuation.dataVersion}|${analysis.valuation.status}|${modelKey}|${analysis.valuation.threshold}|${remaining.join("")}|${landedCost ?? "none"}`;
  useEffect(() => {
    let current = true;
    let refinementId: number | undefined;
    setState((previous) => ({ ...previous, busy: true, error: undefined }));
    const options = {
      seed: key,
      sampleCount: 10_000,
      remaining,
      landedCost,
    };
    simulateOutcomesAsync(analysis.outcomeModel, options).then((result) => {
      if (!current) return;
      setState({ result, busy: false });
      const refine = () => simulateOutcomesAsync(analysis.outcomeModel, { ...options, sampleCount: 50_000 })
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
      {summary.p10 === 0 && summary.median === 0 && summary.p90 === 0 && (
        <p className="outcome-range-note">Usually no card above the bulk filter — most openings land at $0. {(summary.p99 > 0 || summary.mean > 0) ? "Rare high-value pulls keep the average above $0." : "No simulated opening cleared the bulk filter."}</p>
      )}
      {chanceToClear != null && landed != null && (
        <div className="clear-chance">
          <div><span>Chance card value covers your {fmt(landed)} cost</span><b>{Math.round(chanceToClear * 100)}%</b></div>
          <div className="clear-chance-track" aria-label={`${Math.round(chanceToClear * 100)}% chance card value covers your cost`}>
            <span style={{ width: `${chanceToClear * 100}%` }} />
          </div>
        </div>
      )}
      {!compact && <p>Possible results from simulations—not a prediction of the next opening.</p>}
    </div>
  );
}

export function BreakBalance({
  result, remaining, simulation,
}: {
  result: ValuationResult;
  remaining: SlotId[];
  simulation?: SimulationResult;
}) {
  const rows = result.slots.filter((slot) => remaining.includes(slot.id));
  const distributions = simulation?.slotDistributions;
  const weakest = Math.min(...rows.map((slot) => slot.sellableEV));
  const strongest = Math.max(...rows.map((slot) => slot.sellableEV), 0);
  const balanceTip = (
    <Tip
      className="balance-score"
      text={strongest
        ? `The weakest remaining slot has ${Math.round(weakest / strongest * 100)}% as much average card value after the bulk filter as the strongest remaining slot. 100% would mean equal slot values; a lower percentage means a more uneven break.`
        : "There is not enough counted value to compare the weakest and strongest remaining slots."}
      label="Explain the Break Balance percentage"
    >
      <b>{strongest ? `${Math.round(weakest / strongest * 100)}%` : "—"}</b>
      <span>weakest vs strongest</span>
    </Tip>
  );
  if (!distributions) return (
    <section className="panel balance-panel">
      <PanelHeading
        label="BREAK BALANCE"
        help="ColorBreak is checking thousands of pack openings using the published pull weights and pack-collation rules."
        title="Building realistic pull ranges"
        accessory={balanceTip}
      />
      <div className="distribution-unavailable" role="status"><b>Calculating ranges</b><span>The rest of the page remains available while this finishes.</span></div>
    </section>
  );
  const scaleMax = Math.max(...SLOT_IDS.flatMap((id) => [
    distributions[id].p99,
    result.slots.find((slot) => slot.id === id)?.sellableEV ?? 0,
  ]), 1);
  const positionOnScale = (value: number) => Math.min(100, Math.max(0, value / scaleMax * 100));
  const axisTicks = [0, .25, .5, .75, 1].map((fraction) => ({
    fraction,
    value: scaleMax * fraction,
  }));
  return (
    <section className="panel balance-panel">
      <PanelHeading
        label="BREAK BALANCE"
        help="Each wick shows the middle 98% of modeled openings, trimming the most extreme 1% at both ends. The white body contains the middle half. The EV marker is the pull-rate average after serialized and one-of-one collector outliers are removed."
        title="Equal chance, unequal pools"
        accessory={balanceTip}
      />
      <p className="balance-note">Each remaining slot is equally likely. The card value assigned to each slot is not equal.</p>
      <p className="balance-scale-note">Shared linear scale · practical 1-in-100 maximum excludes the most extreme opening results</p>
      <div className="balance-chart" aria-label="Practical modeled card-value range and pull-rate expected value by color">
        <div className="balance-axis" aria-hidden="true">
          <span />
          <div className="balance-axis-track">
            {axisTicks.map((tick) => <span key={tick.fraction} style={{ left: `${tick.fraction * 100}%` }}>{fmtChart(tick.value)}</span>)}
          </div>
        </div>
        {rows.map((slot) => {
          const distribution = distributions[slot.id];
          const rangeLow = distribution.p01;
          const rangeHigh = distribution.p99;
          const expectedValue = slot.sellableEV;
          const bodyLow = Math.min(rangeHigh, Math.max(rangeLow, distribution.p25));
          const bodyHigh = Math.max(bodyLow, Math.min(rangeHigh, Math.max(rangeLow, distribution.p75)));
          const lowPosition = positionOnScale(rangeLow);
          const highPosition = positionOnScale(rangeHigh);
          const evPosition = positionOnScale(expectedValue);
          const bodyLowPosition = positionOnScale(bodyLow);
          const bodyHighPosition = positionOnScale(bodyHigh);
          return (
            <div className={`balance-column slot-${slot.id}`} key={slot.id} aria-label={`${slot.name}: practical range ${fmt(rangeLow)} to ${fmt(rangeHigh)}, pull-rate expected value ${fmt(expectedValue)}, middle half ${fmt(bodyLow)} to ${fmt(bodyHigh)}`}>
              <strong className="balance-slot"><span>{slot.id}</span><small>{slot.name}</small></strong>
              <div className="balance-track">
                <span className="balance-whisker" style={{ left: `${lowPosition}%`, width: `${Math.max(0, highPosition - lowPosition)}%` }} />
                <span className="balance-cap balance-cap-high" style={{ left: `${highPosition}%` }} />
                <span className="balance-cap balance-cap-low" style={{ left: `${lowPosition}%` }} />
                <span className="balance-body" style={{ left: `${bodyLowPosition}%`, width: `${Math.max(0, bodyHighPosition - bodyLowPosition)}%` }} />
                <span className="balance-ev-marker" style={{ left: `${evPosition}%` }} />
                <div className="balance-values">
                  <div className="balance-worst"><small>LOW</small>{fmtChart(rangeLow)}</div>
                  <div className="balance-ev"><small>EV</small>{fmtChart(expectedValue)}</div>
                  <div className="balance-best"><small>HIGH</small>{fmtChart(rangeHigh)}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <p className="balance-caption"><b>Low / high</b> practical 1st-to-99th percentile · <strong>outlined bar</strong> middle half of modeled openings · <span>EV marker</span> pull-rate average. Every slot uses the same linear scale from $0 to {fmtChart(scaleMax)}. Serialized and one-of-one collector outliers are excluded.</p>
    </section>
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

