import { useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { ShieldAlert } from "lucide-react";
import type { BreakAnalysis } from "../../data/evaluate";
import type { AssignmentMode } from "../../domain/share-url";
import { recommendBid, solveFinancialCap } from "../../domain/buyer-treatment";
import type { ValueRule } from "../../domain/buyer-treatment";
import { decisionEligibility, resolvedOnlyLimit } from "../../domain/valuation";
import type { AuctionState } from "../../domain/auction";
import { cardDisplayName } from "../../domain/card-label";
import { deduplicateOmissions } from "../../domain/omissions";
import type {
  BreakLine,
  Contributor,
  DecisionEligibility,
  SlotId,
  SlotValuation,
  ValuationResult,
} from "../../domain/types";
import { SLOT_NAMES } from "../../domain/types";
import { chaseMapLayout } from "../../constellation-layout";
import { buyerDecisionPresentation } from "../../release-context";
import { createLargeBreakPlan, sortNamedCards, summarizeAssignmentValues } from "../../domain/large-break";
import type { TopCardSort } from "../../domain/large-break";
import { DisclosureArrow, fmt, InformationLabel, NumberField, PanelHeading, Status, Tip, countedPriceLabel, oddsLabel, NumericInput } from "../shared/Primitives";
import { cardPreviewSubtitle, CardInspector, CompactWarning, IncompleteDataWarning, OutcomeRange, EvidenceDialog, EvidenceLens, BreakBalance, useOutcomeSimulation, ValueSummary } from "./BuyerVisuals";
import { PublicCardPlaceholder } from "./CardPlaceholder";

export function ChaseConstellation({
  slot,
  onInspect,
}: {
  slot: SlotValuation;
  onInspect: (row: Contributor) => void;
}) {
  const rows = slot.contributors.slice(0, 12);
  const datum = (row: Contributor) => ({
    price: row.marketPrice ?? row.marketValue / Math.max(row.copies, .0001),
    probability: row.sellablePullProbability,
  });
  const maxContribution = Math.max(1, ...rows.map((row) => row.sellableValue));
  const diameters = rows.map((row) => 26 + Math.sqrt(row.sellableValue / maxContribution) * 12);
  const scale = chaseMapLayout(rows.map((row, index) => ({
    ...datum(row),
    diameter: diameters[index],
  })));
  const contributorId = (row: Contributor) => `${row.card.id}|${row.finish ?? "nonfoil"}`;
  return (
    <details className="rollout supporting-view">
      <summary className="disclosure-summary"><span><b>Chase Map</b><small>Card price vs. chance of pulling it</small></span><span className="summary-actions"><span className="summary-help"><span>{SLOT_NAMES[slot.id]}</span><Tip text="Each numbered point maps directly to the same number in the card key. Position shows price and pull chance; size shows how much the card adds to average value. Tap either place for full details." /></span><DisclosureArrow /></span></summary>
      {!rows.length ? <p className="supporting-empty">No cards meet the current bulk boundary.</p> : (
        <div className="chase-map" aria-label={`${SLOT_NAMES[slot.id]} card price and pull chance map`}>
          <div className="constellation">
            <div className="chase-plot" aria-hidden="true">
              <span className="plot-price plot-price-high">{fmt(scale.maxPrice)}</span>
              <span className="plot-price plot-price-mid">{fmt(scale.maxPrice / 2)}</span>
              <span className="plot-price plot-price-low">$0</span>
              <span className="plot-odds plot-odds-low">0%</span>
              <span className="plot-odds plot-odds-mid">{oddsLabel(scale.maxProbability / 2)}</span>
              <span className="plot-odds plot-odds-high">{oddsLabel(scale.maxProbability)}</span>
            </div>
            {rows.map((row, index) => {
              const point = scale.points[index];
              const diameter = diameters[index];
              const displayName = cardDisplayName(row.card, row.finish);
              return (
                <button
                  className="chase-point"
                  key={contributorId(row)}
                  style={{
                    left: `${point.x}%`,
                    top: `${point.y}%`,
                    width: `${diameter}px`,
                    height: `${diameter}px`,
                  }}
                  onClick={() => onInspect(row)}
                  aria-label={`${displayName}: ${oddsLabel(row.sellablePullProbability)} pull chance, ${fmt(datum(row).price)} market price, adds ${fmt(row.sellableValue)} to the average`}
                  title={displayName}
                >
                  {index + 1}
                </button>
              );
            })}
          </div>
          <div className="chase-card-key">
            {rows.map((row, index) => (
              <button key={contributorId(row)} type="button" onClick={() => onInspect(row)}>
                <b>{index + 1}</b>
                <CardThumbnail row={row} />
                <span><strong>{row.card.name}</strong><small>{cardPreviewSubtitle(row, datum(row).price)}</small></span>
                <em>{fmt(row.sellableValue)}</em>
              </button>
            ))}
          </div>
        </div>
      )}
      {rows.length > 0 && <div className="chase-chart-key" aria-label="Chase Map chart key">
        <span><b>X</b> Chance to pull</span>
        <span><b>Y</b> Market price</span>
        <span className="chase-size-legend"><i />Larger dot adds more to average value</span>
      </div>}
      <p className="supporting-note">Top-right cards combine the highest price with the best pull chance. Tap any card image to inspect its price, odds, and printing.</p>
    </details>
  );
}

export function BulkFilterControl({
  enabled,
  threshold,
  result,
  onToggle,
  onThreshold,
  compact = false,
}: {
  enabled: boolean;
  threshold: number;
  result?: ValuationResult;
  onToggle: (enabled: boolean) => void;
  onThreshold: (threshold: number) => void;
  compact?: boolean;
}) {
  const ignored = result ? Math.max(0, result.marketEV - result.sellableEV) : 0;
  const retained = result && result.marketEV > 0 ? result.sellableEV / result.marketEV : 1;
  const explanation = enabled
    ? `Cards worth less than ${fmt(threshold)} each are ignored everywhere in ColorBreak. Cards worth exactly ${fmt(threshold)} are still counted.`
    : `Bulk filtering is off. Every priced card is counted. Turn it on to ignore cards worth less than ${fmt(threshold)} each.`;
  return (
    <section className={`bulk-filter-control ${enabled ? "enabled" : "disabled"}`}>
      <div className="bulk-filter-main">
        <button type="button" className="bulk-toggle" role="switch" aria-checked={enabled} onClick={() => onToggle(!enabled)}>
          <span aria-hidden="true"><i /></span><b>Bulk filter</b><small>{enabled ? "On" : "Off"}</small>
        </button>
        <label className="bulk-value-field">
          <span>Ignore cards under</span>
          <div><b>$</b><NumericInput value={threshold} onCommit={(value) => onThreshold(value ?? 0)} ariaLabel="Bulk filter dollar amount" /></div>
        </label>
        {!compact && <Tip className="bulk-filter-help" text={explanation} label="Explain the current bulk filter setting" />}
      </div>
      {!compact && <details className="bulk-filter-details">
        <summary className="disclosure-summary"><span>See what the filter changes</span><DisclosureArrow /></summary>
        {!result ? <p>Product values are still loading.</p> : (
          <div className="bulk-filter-rollout">
            <div><span>All priced card value</span><b>{fmt(result.marketEV)}</b></div>
            <div><span>{enabled ? "Ignored as bulk" : "Ignored while filter is off"}</span><b>{fmt(ignored)}</b></div>
            <div><span>Value used by ColorBreak</span><b>{fmt(result.sellableEV)}</b></div>
            <div className="boundary-track" aria-label={`${Math.round(retained * 100)} percent of all card value is counted`}><span style={{ width: `${retained * 100}%` }} /></div>
            <p>{enabled
              ? `${fmt(result.marketEV)} in all priced cards − ${fmt(ignored)} under ${fmt(threshold)} = ${fmt(result.sellableEV)} used throughout the tool.`
              : `No priced cards are being removed. Turn the filter on when you do not want low-value bulk included in card value.`}</p>
          </div>
        )}
      </details>}
    </section>
  );
}

function slotProfile(slot: SlotValuation) {
  if (!slot.contributors.length) return "NO PRICED CARDS";
  if (slot.chaseShare >= 0.5) return "CHASE-HEAVY";
  if (slot.chaseShare >= 0.3) return "MIXED";
  return "DIVERSIFIED";
}

function CardThumbnail({ row }: { row: Contributor }) {
  return <PublicCardPlaceholder name={row.card.name} className="card-thumbnail" />;
}

export function ContributorRows({
  slot,
  onInspect,
  limit = 8,
}: {
  slot: SlotValuation;
  onInspect: (row: Contributor) => void;
  limit?: number;
}) {
  if (!slot.contributors.length) {
    return <p className="no-contributors">No cards in this color are above the current bulk limit.</p>;
  }
  return (
    <>
      <div className="contributor-columns">
        <span>Card and exact printing</span>
        <span>Pull odds</span>
        <span>Adds to average</span>
      </div>
      {slot.contributors.slice(0, limit).map((row) => (
        <button
          type="button"
          className="card-row contributor-card"
          key={`${row.card.id}|${row.finish ?? "nonfoil"}`}
          onClick={() => onInspect(row)}
          aria-label={`Open ${cardDisplayName(row.card, row.finish)}: ${oddsLabel(row.sellablePullProbability)} pull odds, ${countedPriceLabel(row)}, adds ${fmt(row.sellableValue)} to the average`}
        >
          <CardThumbnail row={row} />
          <span className="card-summary">
            <strong>{row.card.name}</strong>
            <small>{cardPreviewSubtitle(row)}</small>
          </span>
          <span className="pull-odds">
            <b>{oddsLabel(row.sellablePullProbability)}</b>
          </span>
          <span className="ev-contribution">
            <b>{fmt(row.sellableValue)}</b>
          </span>
        </button>
      ))}
    </>
  );
}

export function SlotValueDetails({
  slot,
  threshold,
  onInspect,
  className = "",
}: {
  slot: SlotValuation;
  threshold: number;
  onInspect: (row: Contributor) => void;
  className?: string;
}) {
  const profileLabel = slotProfile(slot);
  const profileTip = (
    <Tip
      className={`risk-label risk-${profileLabel.toLowerCase().replace(/[^a-z]+/g, "-")}`}
      text={profileLabel === "DIVERSIFIED"
        ? "The biggest card supplies less than 30% of this color's average value. More cards share the load, but this does not guarantee a minimum return."
        : profileLabel === "MIXED"
          ? "The biggest card supplies 30% to 49% of this color's average value. One chase matters, but other cards still add meaningful value."
          : profileLabel === "CHASE-HEAVY"
            ? "One card supplies at least half of this color's average value. The average depends heavily on pulling that card."
            : `No ${slot.name.toLowerCase()} card is worth at least ${fmt(threshold)}.`}
      label={`Explain ${profileLabel.toLowerCase()} value spread`}
    >
      <span>{profileLabel}</span>
    </Tip>
  );
  return (
    <section className={`panel slot-detail ${className}`.trim()}>
      <PanelHeading
        label={`${slot.name.toUpperCase()} VALUE DETAILS`}
        help="Shows which cards create this color's average value and how much that value depends on one expensive chase card."
        title={<>What makes up {fmt(slot.sellableEV)}?</>}
        accessory={profileTip}
        description={<p className="risk-explainer">
            {slot.name} cards worth {fmt(threshold)} or more. Cheaper cards are ignored as bulk.
          </p>}
      />
      <div className="concentration">
        <div className="concentration-labels">
          <span>Value spread across cards</span>
          <span>Value depends on one chase</span>
        </div>
        <div className="risk-bar" aria-label={`${Math.round(slot.chaseShare * 100)}% of this color's average value comes from its biggest card`}>
          <span style={{ width: `${Math.min(100, slot.chaseShare * 100)}%` }} />
        </div>
      </div>
      <div className="metric-row risk-metrics">
        <div><span>Biggest card's share</span><b>{Math.round(slot.chaseShare * 100)}%</b></div>
        <div><span>Value without it</span><b>{fmt(slot.withoutChase)}</b></div>
        <div><span>Priced cards used</span><b>{slot.contributors.length}</b></div>
      </div>
      <details open className="contributors">
        <summary className="disclosure-summary">
          <span>
            Cards adding the most value
            <small>Largest effect on the average first</small>
          </span>
          <DisclosureArrow />
        </summary>
        <ContributorRows slot={slot} onInspect={onInspect} />
      </details>
    </section>
  );
}

function LargeBreakSlotCards({
  rows,
  onInspect,
}: {
  rows: Contributor[];
  onInspect: (row: Contributor) => void;
}) {
  const sortedRows = [...rows].sort((left, right) =>
    (right.marketPrice ?? right.card.foil ?? right.card.nonfoil ?? 0)
      - (left.marketPrice ?? left.card.foil ?? left.card.nonfoil ?? 0)
      || left.card.name.localeCompare(right.card.name),
  );
  return (
    <div className="large-break-slot-cards">
      <div className="contributor-columns">
        <span>Card and exact printing</span>
        <span>Pull odds</span>
        <span>Adds to average</span>
      </div>
      {sortedRows.length ? sortedRows.map((row) => (
        <button
          type="button"
          className="card-row contributor-card"
          key={`${row.card.id}|${row.finish ?? "nonfoil"}`}
          onClick={() => onInspect(row)}
          aria-label={`Open ${cardDisplayName(row.card, row.finish)} card details`}
        >
          <CardThumbnail row={row} />
          <span className="card-summary"><strong>{row.card.name}</strong><small>{cardPreviewSubtitle(row)}</small></span>
          <span className="pull-odds"><b>{oddsLabel(row.sellablePullProbability)}</b></span>
          <span className="ev-contribution"><b>{fmt(row.sellableValue)}</b></span>
        </button>
      )) : <p className="no-contributors">No priced cards are assigned to this slot.</p>}
    </div>
  );
}

export function LargeBreakView({
  analysis,
  lines,
  spots,
  bid,
  setBid,
  shipping,
  setShipping,
}: {
  analysis: BreakAnalysis;
  lines: BreakLine[];
  spots: number;
  bid: number | undefined;
  setBid: (value: number | undefined) => void;
  shipping: number | undefined;
  setShipping: (value: number | undefined) => void;
}) {
  const result = analysis.valuation;
  const [inspectedCard, setInspectedCard] = useState<Contributor | null>(null);
  const [excludedCard, setExcludedCard] = useState<Contributor | null>(null);
  const [topCardSort, setTopCardSort] = useState<TopCardSort>("expected-value");
  const [openSlot, setOpenSlot] = useState<string | null>(null);
  const [tax, setTax] = useState<number | undefined>(0);
  const [haircut, setHaircut] = useState(0);
  const [namedLimit, setNamedLimit] = useState(10);
  const [categoryLimit, setCategoryLimit] = useState(5);
  const [blockersOpen, setBlockersOpen] = useState(false);
  const plan = useMemo(() => createLargeBreakPlan(result, spots), [result, spots]);
  const assignment = useMemo(() => summarizeAssignmentValues(plan), [plan]);
  const rankedNamedCards = useMemo(() => sortNamedCards(plan.namedCards, topCardSort), [plan.namedCards, topCardSort]);
  const completeSealedValue = lines.every((line) => line.marketCost != null);
  const sealedMarketValue = completeSealedValue
    ? lines.reduce((sum, line) => sum + line.quantity * line.marketCost!, 0)
    : undefined;
  const namedEV = plan.namedCards.reduce((sum, card) => sum + card.pullEV, 0);
  const categoryEV = plan.categories.reduce((sum, category) => sum + category.pullEV, 0);
  const totalOpenings = lines.reduce((sum, line) => sum + line.quantity * Math.max(1, line.packCount ?? 1), 0);
  const allIn = bid == null ? undefined : bid + (shipping ?? 0) + (tax ?? 0);
  const liquidFactor = Math.max(0, 1 - haircut / 100);
  const liquidMean = assignment.mean * liquidFactor;
  const belowCost = allIn == null ? undefined : assignment.values.filter((value) => value * liquidFactor < allIn).length;
  const materialOmissions = deduplicateOmissions([...result.omissions, ...analysis.outcomeOmissions].filter((item) => item.material));
  const coverageReady = result.status === "verified" && analysis.outcomeModel.complete && materialOmissions.length === 0;
  const comparison = !coverageReady
    ? "CANNOT CLASSIFY PRICE"
    : allIn == null
      ? "ENTER ONE-SPOT BID"
      : allIn < liquidMean * .95
        ? "BELOW MODELED MEAN"
        : allIn > liquidMean * 1.05
          ? "ABOVE MODELED MEAN"
          : "NEAR MODELED MEAN";
  const maxAssignment = Math.max(1, ...assignment.values);
  return (
    <section className="large-break-results" aria-label="Large break spot value">
      <header className="large-break-result-head">
        <div><InformationLabel>LARGE RANDOM BREAK</InformationLabel><h2>{plan.spotCount} spots</h2></div>
        <Status result={result} />
      </header>
      <section className={`large-break-decision ${coverageReady ? "is-ready" : "is-blocked"}`} aria-label="One-spot price check">
        <div className="large-break-decision-copy">
          <InformationLabel>ONE-SPOT EV CHECK</InformationLabel>
          <h2>{comparison}</h2>
          {!coverageReady ? <><p>The model is incomplete, so ColorBreak will not turn this partial estimate into a price judgment.</p><button type="button" className="review-blockers" onClick={() => { setBlockersOpen(true); requestAnimationFrame(() => document.getElementById("large-break-blockers")?.scrollIntoView({ behavior: "smooth", block: "start" })); }}>Review all {materialOmissions.length} model blockers ↓</button></> : allIn == null ? <p>Enter the current bid for one random spot. This compares cost with modeled average value; it is not a guaranteed return.</p> : <p><b>{fmt(allIn)}</b> all-in is <b>{fmt(Math.abs(liquidMean - allIn))}</b> {allIn <= liquidMean ? "below" : "above"} the {fmt(liquidMean)} modeled mean.</p>}
        </div>
        <div className="large-break-cost-fields">
          <NumberField id="large-break-bid" label="Bid for one spot" value={bid} onChange={setBid} />
          <NumberField id="large-break-shipping" label="Allocated shipping" value={shipping} onChange={setShipping} />
          <NumberField id="large-break-tax" label="Estimated tax" value={tax} onChange={setTax} />
          <label className="large-break-haircut"><span>Listed card value you expect to recover</span><div><input aria-label="Percent of listed card value you expect to recover" type="number" inputMode="numeric" min="0" max="100" value={100 - haircut} onChange={(event) => setHaircut(Math.max(0, 100 - Math.min(100, Number(event.target.value) || 0)))} /><b>%</b></div><small>After selling fees and typical discounts</small></label>
        </div>
        <div className="large-break-cost-equation">
          <span>One-spot bid {fmt(bid)}</span><b>+</b><span>shipping {fmt(shipping ?? 0)}</span><b>+</b><span>tax {fmt(tax ?? 0)}</span><b>=</b><strong>{fmt(allIn)} total paid</strong>
        </div>
      </section>
      <section id="buyer-large-assignments" className="assignment-overview" aria-label="Modeled value across the assigned spots">
        <div className="assignment-overview-heading">
          <div><InformationLabel>100-ASSIGNMENT VALUE SHAPE</InformationLabel><h3>Average value is not the typical assignment</h3></div>
          {belowCost != null && <strong>{belowCost} of {assignment.values.length} assignments have modeled average value below your cost</strong>}
        </div>
        <p className="assignment-rules"><b>How assignments work:</b> each card belongs to one assignment only. The 83 named assignments collect every eligible printing of that card or character; the 17 category assignments collect the remaining cards by color and type. A spot can receive multiple cards when they are opened—or none when its cards are not opened.</p>
        <div className="assignment-value-strip" aria-hidden="true">
          {assignment.values.map((value, index) => <i key={`${value}-${index}`} style={{ "--assignment-height": `${Math.max(3, value / maxAssignment * 100)}%` } as CSSProperties} />)}
        </div>
        <div className="assignment-landmarks">
          <div><span>Lower tenth</span><b>{fmt(assignment.p10 * liquidFactor)}</b><small>10 of 100 assignments are at or below this modeled average</small></div>
          <div><span>Middle assignment</span><b>{fmt(assignment.median * liquidFactor)}</b><small>Half are lower and half are higher</small></div>
          <div><span>Mean</span><b>{fmt(liquidMean)}</b><small>Total modeled value ÷ {assignment.values.length}</small></div>
          <div><span>Upper tenth</span><b>{fmt(assignment.p90 * liquidFactor)}</b><small>10 of 100 assignments are at or above this modeled average</small></div>
        </div>
        <p className="assignment-limitation"><ShieldAlert />These figures compare the modeled average value of the {assignment.values.length} assigned spots. Realized opening ranges remain unavailable until every product has a complete pull model; ColorBreak does not invent a chance of profit.</p>
        <div className="assignment-cohorts">
          <div><span>{plan.namedCards.length} named assignments</span><b>{fmt(assignment.namedAverage * liquidFactor)} average</b><small>{Math.round(assignment.namedShare * 100)}% of modeled value</small></div>
          <div><span>{plan.categories.length} category assignments</span><b>{fmt(assignment.categoryAverage * liquidFactor)} average</b><small>{Math.round(assignment.categoryShare * 100)}% of modeled value</small></div>
          <div><span>Concentration</span><b>Top 10 hold {Math.round(assignment.topTenShare * 100)}%</b><small>Top assignment holds {Math.round(assignment.topOneShare * 100)}%</small></div>
        </div>
      </section>
      <section className="data-readiness" aria-label="Data readiness">
        <div><span>Pack contents</span><b>{analysis.outcomeModel.complete ? `${totalOpenings}/${totalOpenings} modeled` : "Partial"}</b><small>{analysis.outcomeModel.complete ? "Outcome model complete" : "One or more products lack a complete outcome model"}</small></div>
        <div><span>Pull rates</span><b>{materialOmissions.length ? `${materialOmissions.length} blockers` : "Ready"}</b><small>{materialOmissions[0]?.message ?? "Included EV uses verified pull-rate evidence"}</small></div>
        <div><span>Card prices</span><b>{analysis.priceAvailability.status}</b><small>{analysis.priceAvailability.observedAt ? `Observed ${new Date(analysis.priceAvailability.observedAt).toLocaleDateString()}` : analysis.priceAvailability.message}</small></div>
        <div><span>Sealed prices</span><b>{completeSealedValue ? `${lines.length}/${lines.length} products` : `${lines.filter((line) => line.marketCost != null).length}/${lines.length} products`}</b><small>{completeSealedValue ? "All references available" : "Missing references do not silently become $0"}</small></div>
      </section>
      <div className="large-break-metrics">
        <div><span>Sealed market value / spot</span><strong>{sealedMarketValue == null ? "—" : fmt(sealedMarketValue / plan.spotCount)}</strong><small>{sealedMarketValue == null ? "A sealed-market price is unavailable; pull EV is still shown" : `${fmt(sealedMarketValue)} total sealed value`}</small></div>
        <div><span>Modeled mean / assignment</span><strong>{fmt(plan.totalPullEV / plan.spotCount)}</strong><small>{result.threshold > 0 ? `Only model-approved cards at or above ${fmt(result.threshold)} included · ${materialOmissions.length} blockers excluded` : `Only cards with usable prices and model-approved pull inputs included · ${materialOmissions.length} blockers excluded`}</small></div>
      </div>
      <div className="large-break-allocation">
        <div><span>Named assignments</span><b>{plan.namedCards.length}</b><small>{fmt(namedEV)} modeled EV</small></div>
        <div><span>Category spots</span><b>{plan.categories.length}</b><small>{fmt(categoryEV)} pull EV</small></div>
        <div><span>Total modeled EV</span><b>{fmt(plan.totalPullEV)}</b><small>Across {totalOpenings} openings</small></div>
      </div>
      <IncompleteDataWarning analysis={analysis} title="Some spot values may be low" id="large-break-blockers" open={blockersOpen} onOpenChange={setBlockersOpen} />
      <section className="large-break-pool-section">
        <div className="large-break-section-heading large-break-top-heading">
          <div><InformationLabel>NAMED POOL</InformationLabel><h3>Top cards & characters</h3></div>
          <div className="top-card-sort" role="group" aria-label="Rank top spots by">
            <span>Rank by</span>
            <div>
              <button type="button" aria-pressed={topCardSort === "price"} onClick={() => setTopCardSort("price")}>Price</button>
              <button type="button" aria-pressed={topCardSort === "expected-value"} onClick={() => setTopCardSort("expected-value")}>Expected value</button>
            </div>
          </div>
        </div>
        <div className="large-break-card-list">
          {rankedNamedCards.slice(0, namedLimit).map((card, index) => {
            const slotKey = `named:${card.key}`;
            const isOpen = openSlot === slotKey;
            return <div className={`large-break-card large-break-slot ${isOpen ? "open" : ""}`} key={card.key}>
            <button type="button" className="large-break-card-main" onClick={() => setOpenSlot(isOpen ? null : slotKey)} aria-expanded={isOpen} aria-label={`${isOpen ? "Hide" : "Show"} cards in ${card.name} slot`}>
              <span className="large-break-rank">{String(index + 1).padStart(2, "0")}</span>
              <PublicCardPlaceholder name={card.name} />
              <span className="large-break-card-copy"><strong>{card.name}</strong><small>{card.cards.length} card{card.cards.length === 1 ? "" : "s"} · {cardPreviewSubtitle(card.row, card.marketPrice)}</small></span>
            </button>
            <div className="large-break-card-value"><span>Pull EV</span>{card.pullRateVerified
              ? <b>{fmt(card.pullEV)}</b>
              : <button type="button" className="excluded-ev" onClick={() => setExcludedCard(card.row)} aria-label={`Explain why ${card.name} is excluded from Pull EV`}>Excluded</button>}
            </div>
            {isOpen && <LargeBreakSlotCards rows={card.cards} onInspect={setInspectedCard} />}
          </div>})}
        </div>
        {rankedNamedCards.length > namedLimit && <button type="button" className="show-more-assignments" onClick={() => setNamedLimit(rankedNamedCards.length)}>Show {rankedNamedCards.length - namedLimit} more named assignments</button>}
        {namedLimit > 10 && <button type="button" className="show-more-assignments" onClick={() => setNamedLimit(10)}>Show top 10 only</button>}
      </section>
      <section className="large-break-pool-section">
        <div className="large-break-section-heading"><div><InformationLabel>RESIDUAL POOL</InformationLabel><h3>Creature colors & card types</h3></div><span>Top-value named spots excluded</span></div>
        <div className="large-break-category-head"><span>Slot</span><span>Slot EV</span></div>
        {plan.categories.slice(0, categoryLimit).map((category) => {
          const slotKey = `category:${category.key}`;
          const isOpen = openSlot === slotKey;
          return <div className={`large-break-category large-break-slot ${isOpen ? "open" : ""}`} key={category.key}>
          <button type="button" className="large-break-category-main" onClick={() => setOpenSlot(isOpen ? null : slotKey)} aria-expanded={isOpen} aria-label={`${isOpen ? "Hide" : "Show"} cards in ${category.label} slot`}>
            <strong>{category.label}</strong><small>{category.cardCount} remaining card{category.cardCount === 1 ? "" : "s"}</small>
          </button>
          <b>{fmt(category.pullEV)}</b>
          {isOpen && <LargeBreakSlotCards rows={category.cards} onInspect={setInspectedCard} />}
        </div>})}
        {plan.categories.length > categoryLimit && <button type="button" className="show-more-assignments" onClick={() => setCategoryLimit(plan.categories.length)}>Show all {plan.categories.length} category assignments</button>}
        {categoryLimit > 5 && <button type="button" className="show-more-assignments" onClick={() => setCategoryLimit(5)}>Show first 5 categories</button>}
      </section>
      <CardInspector row={inspectedCard} status={result.status} threshold={result.threshold} onClose={() => setInspectedCard(null)} />
      <EvidenceDialog item={excludedCard ? {
        title: "Excluded from Pull EV",
        status: cardDisplayName(excludedCard.card, excludedCard.finish),
        meaning: "An exact pull chance for this printing is not published or independently verifiable.",
        matters: "Pull EV multiplies price by pull chance. Using an uncertain chance could make this card add an unrealistic amount of value.",
        action: "Its current price remains in Rank by Price. It will return to Rank by EV when an exact pull rate can be verified.",
      } : null} onClose={() => setExcludedCard(null)} />
    </section>
  );
}

export function BuyerView({
  analysis,
  eligibility: assessedEligibility,
  auction,
  assignmentMode,
  selected,
  breakLabel,
  bid,
  setBid,
  shipping,
  setShipping,
  onChooseReady,
  onUseManualCap,
}: {
  analysis: BreakAnalysis;
  eligibility?: DecisionEligibility;
  auction: AuctionState;
  assignmentMode: AssignmentMode;
  selected: SlotId;
  breakLabel?: string;
  bid: number | undefined;
  setBid: (value: number | undefined) => void;
  shipping: number | undefined;
  setShipping: (value: number | undefined) => void;
  onChooseReady?: () => void;
  onUseManualCap?: () => void;
}) {
  const result = analysis.valuation;
  const eligibility = assessedEligibility ?? decisionEligibility(result);
  const releasePresentation = buyerDecisionPresentation(eligibility.status);
  const [inspectedCard, setInspectedCard] = useState<Contributor | null>(null);
  const [valueRule, setValueRule] = useState<ValueRule>({ kind: "median" });
  const [resolvedOnlyRequested] = useState(false);
  const [reconfirmedAt, setReconfirmedAt] = useState<number>();
  const [reconfirmedInput, setReconfirmedInput] = useState<string>();
  const slot = result.slots.find((row) => row.id === selected)!;
  const landed = (bid ?? 0) + (shipping ?? 0);
  const simulation = useOutcomeSimulation(analysis, auction.remaining, bid == null ? undefined : landed);
  const distribution = assignmentMode === "random"
    ? simulation.result?.remainingPool
    : simulation.result?.slotDistributions[selected];
  const fallbackMean = assignmentMode === "random"
    ? result.slots.filter((row) => auction.remaining.includes(row.id)).reduce((sum, row) => sum + row.sellableEV, 0) / Math.max(1, auction.remaining.length)
    : slot.sellableEV;
  const valueTarget = distribution == null
    ? undefined
    : valueRule.kind === "median"
      ? distribution.median
      : valueRule.kind === "coverage"
        ? distribution.p25
        : distribution.mean;
  const decisionInput = `${selected}|${assignmentMode}|${auction.remaining.join("")}|${bid ?? ""}|${shipping ?? ""}|${valueRule.kind}|${valueRule.kind === "coverage" ? valueRule.coverage : ""}|${eligibility.affectedGroups.map((group) => group.id).join("|")}`;
  const reconfirmed = reconfirmedInput === decisionInput && reconfirmedAt != null && Date.now() - reconfirmedAt <= 60_000;
  const addedShipping = shipping ?? 0;
  const scoped = valueTarget == null ? undefined : resolvedOnlyLimit(valueTarget, addedShipping, eligibility);
  const cap = (eligibility.status !== "eligible" && eligibility.status !== "stale") || valueTarget == null
    ? { kind: "unknown-cost" as const }
    : solveFinancialCap({
        valueTarget,
        acceptedAmounts: valueTarget > addedShipping
          ? [Math.floor((valueTarget - addedShipping) * 100) / 100]
          : [],
        addedCost: () => addedShipping,
      });
  const activeCap = releasePresentation.canShowDecision && eligibility.status === "material-incomplete" && resolvedOnlyRequested && scoped && reconfirmed
    ? { kind: "cap" as const, amount: scoped.amount, allInAtCap: scoped.allIn }
    : cap;
  const recommendation = recommendBid(bid, activeCap);
  const decision = !releasePresentation.canShowDecision
    ? releasePresentation.heading!
    : eligibility.status !== "eligible" && eligibility.status !== "stale"
    ? eligibility.status === "material-incomplete" && resolvedOnlyRequested && scoped && reconfirmed
      ? bid == null ? "ENTER BID" : recommendation.action === "bid" ? "BID" : recommendation.action === "stop" ? "STOP HERE" : recommendation.action === "pass" ? "PASS" : "NO CAP"
      : eligibility.status === "material-incomplete" ? `LIMIT UNAVAILABLE — ${eligibility.blockerCount} MATERIAL OMISSIONS` : "LIMIT UNAVAILABLE"
    : eligibility.status === "stale" && bid == null
    ? "ESTIMATED MAX BID"
    : eligibility.status === "stale"
    ? recommendation.action === "pass" ? "ABOVE ESTIMATE" : recommendation.action === "stop" ? "AT ESTIMATE" : "UNDER ESTIMATE"
    : bid == null
    ? "BID UP TO"
    : shipping == null
      ? "ADD SHIPPING"
      : recommendation.action === "bid"
        ? "BID"
        : recommendation.action === "stop"
          ? "STOP HERE"
          : recommendation.action === "pass"
            ? "PASS"
            : "NO CAP";
  const ruleLabel = valueRule.kind === "median"
    ? "Typical outcome"
    : valueRule.kind === "coverage"
      ? "75% coverage"
      : "Average outcome";
  const decisionKicker = `${breakLabel ? `${breakLabel} · ` : ""}Manual auction check · ${assignmentMode === "random" ? `${auction.remaining.length} random colors` : `${SLOT_NAMES[selected]} slot`}`;
  const immediateCap = activeCap.kind === "cap" ? activeCap : undefined;
  const immediateRecommendation = releasePresentation.canShowDecision
    && (eligibility.status === "eligible" || eligibility.status === "stale")
    && immediateCap
    && bid != null
    ? recommendBid(bid, immediateCap)
    : undefined;
  return (
    <>
      <section
        className={`bid-live-decision decision-${recommendation.tone} verdict-${decision.replace(/[^A-Z]/g, "").toLowerCase()}`}
        aria-label="Live bid decision"
      >
        <div className="decision-kicker">
          <span title={decisionKicker}>{decisionKicker}</span>
          <span className={`decision-evidence evidence-${result.status}`}>{eligibility.status === "eligible" ? "Fresh estimate" : eligibility.status === "stale" ? "Prices are older than 6 hours" : result.status}</span>
        </div>
        <div className="verdict-head">
          <div className="verdict-decision">
            <InformationLabel>Recommendation</InformationLabel>
            <h2 aria-live="polite">{decision}</h2>
            {!releasePresentation.canShowDecision && <div className="decision-reason buyer-recovery-choice"><p><strong>{eligibility.status === "stale" ? "Price evidence is stale." : eligibility.status === "material-incomplete" ? "Contents or exact prices are incomplete." : "Required evidence is unavailable."}</strong> {eligibility.status === "material-incomplete" && eligibility.affectedGroups.length ? eligibility.affectedGroups.map((item) => item.label).join(" ") : ""} Observed {eligibility.observedAt ? new Date(eligibility.observedAt).toLocaleString() : "unknown"} from {eligibility.observedSource ?? "the price snapshot"}. The modeled ceiling is withheld.</p><div className="buyer-recovery-actions"><button type="button" className="quiet" onClick={onChooseReady}>Choose a ready product</button><button type="button" className="quiet" onClick={onUseManualCap}>Use manual budget cap</button></div></div>}
            {releasePresentation.canShowDecision && (eligibility.status === "eligible" || (eligibility.status === "material-incomplete" && resolvedOnlyRequested && scoped)) && !reconfirmed && <p className="decision-reason"><button type="button" className="quiet" onClick={() => { setReconfirmedInput(decisionInput); setReconfirmedAt(Date.now()); }}>Reconfirm current bid</button> Reconfirm after changing bid, shipping, slot, or risk stance. Confirmation expires after one minute.</p>}
            {releasePresentation.canShowDecision && bid == null && <p className="decision-reason"><a href="#buyer-current-bid">Enter the current all-in bid</a> to compare it with this estimate.</p>}
            {(eligibility.status === "eligible" || eligibility.status === "stale") && recommendation.action === "bid" && (
              <p className="decision-reason">Current hammer is {fmt(recommendation.room)} below your modeled ceiling.</p>
            )}
            {(eligibility.status === "eligible" || eligibility.status === "stale") && recommendation.action === "stop" && (
              <p className="decision-reason">The current hammer has reached your modeled ceiling.</p>
            )}
            {(eligibility.status === "eligible" || eligibility.status === "stale") && recommendation.action === "pass" && (
              <p className="decision-reason">Current hammer is {fmt(Math.abs(recommendation.room))} beyond your modeled ceiling.</p>
            )}
          </div>
          <div className="ev-orb">
            <small><span>{releasePresentation.canShowDecision ? eligibility.status === "stale" ? "Estimated max bid" : "Bid up to" : "Estimate unavailable"}</span></small>
            <strong className="max-hammer" aria-label="Maximum bid" aria-live="polite">{releasePresentation.canShowDecision && activeCap.kind === "cap" ? fmt(activeCap.amount) : "Checking…"}</strong>
            <span>{releasePresentation.canShowDecision ? `${ruleLabel} value` : "Choose another product"}</span>
            <strong aria-label="Typical card value" aria-live="polite">{simulation.busy && !distribution ? "Checking…" : fmt(distribution?.median ?? fallbackMean)}</strong>
            {distribution?.median === 0 && <em>Usually no card above the bulk filter</em>}
            <span>Average {fmt(distribution?.mean ?? fallbackMean)}</span>
          </div>
        </div>
        {(eligibility.status === "eligible" || eligibility.status === "stale") && <div className="value-rule" role="group" aria-label="Risk stance">
          <button aria-pressed={valueRule.kind === "coverage"} onClick={() => setValueRule({ kind: "coverage", coverage: .75 })}>Protect downside</button>
          <button aria-pressed={valueRule.kind === "median"} onClick={() => setValueRule({ kind: "median" })}>Balanced</button>
          <button aria-pressed={valueRule.kind === "average"} onClick={() => setValueRule({ kind: "average" })}>Chase upside</button>
        </div>}
        <div className="bid-inputs">
          <NumberField id="buyer-current-bid" label="Current all-in bid" value={bid} onChange={setBid} live />
          <NumberField
            id="buyer-added-shipping"
            label={eligibility.status === "eligible" ? "Your added shipping" : "Optional: added shipping"}
            value={shipping}
            onChange={setShipping}
            hint="Only shipping added by this purchase—not your whole order."
            live
          />
        </div>
        {immediateRecommendation && immediateCap && (
          <div
            className={`bid-recommendation bid-recommendation-${immediateRecommendation.tone}`}
            aria-live="polite"
            aria-label="Bid recommendation"
          >
            <div>
              <small>Bid recommendation</small>
              <strong>{immediateRecommendation.action === "bid" ? "ROOM TO BID" : immediateRecommendation.action === "stop" ? "AT YOUR LIMIT — STOP HERE" : "OVER YOUR LIMIT — PASS"}</strong>
            </div>
            <p>
              {immediateRecommendation.action === "bid"
                ? <>Your current bid is <b>{fmt(immediateRecommendation.room)}</b> under the {eligibility.status === "stale" ? "estimated" : "modeled"} max bid of <b>{fmt(immediateCap.amount)}</b>. Bid only up to {fmt(immediateCap.amount)}.</>
                : immediateRecommendation.action === "stop"
                  ? <>Your current bid matches the {eligibility.status === "stale" ? "estimated" : "modeled"} max bid of <b>{fmt(immediateCap.amount)}</b>. Do not bid higher.</>
                  : <>Your current bid is <b>{fmt(Math.abs(immediateRecommendation.room))}</b> over the {eligibility.status === "stale" ? "estimated" : "modeled"} max bid of <b>{fmt(immediateCap.amount)}</b>. Pass on this bid.</>}
              {eligibility.status === "stale" && " Prices are older than 6 hours, so recheck before bidding."}
            </p>
          </div>
        )}
        {bid != null && (
          <div className="delta">
            <span>
              Landed cost <b>{fmt(landed)}</b>
            </span>
            <span>
              Average gap <b>{fmt((distribution?.mean ?? fallbackMean) - landed)}</b>
            </span>
          </div>
        )}
        <OutcomeRange summary={distribution} landed={bid == null ? undefined : landed} compact />
        {simulation.busy && <p className="simulation-state" role="status" aria-live="polite">Checking more possible openings…</p>}
        {simulation.error && <CompactWarning title="Pull ranges unavailable" summary="The non-simulation value remains visible." className="inline-warning"><p role="alert">{simulation.error}</p><button type="button" className="quiet" onClick={simulation.retry}>Retry pull ranges</button></CompactWarning>}
        <IncompleteDataWarning analysis={analysis} title="Some estimates may be low" />
      </section>
      <section className="bid-explorer">
        <header className="disclosure-summary">
          <span>
            <strong>Break evidence</strong>
            <small>Break value, pull range, data quality, and ranked cards</small>
          </span>
        </header>
        <div className="bid-explorer-body">
          <ValueSummary result={result} />
          <BreakBalance result={result} remaining={auction.remaining} simulation={simulation.result} />
          <EvidenceLens analysis={analysis} />
          <SlotValueDetails
            slot={slot}
            threshold={result.threshold}
            onInspect={setInspectedCard}
          />
        </div>
      </section>
      <CardInspector
        row={inspectedCard}
        status={result.status}
        threshold={result.threshold}
        onClose={() => setInspectedCard(null)}
      />
    </>
  );
}

