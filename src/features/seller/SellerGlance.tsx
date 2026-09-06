import { useEffect, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import type { BreakAnalysis } from "../../data/evaluate";
import { bidCeiling, DEFAULT_BUYER_COSTS } from "../../domain/bid-ceiling";
import { decisionEligibility } from "../../domain/valuation";
import { SLOT_IDS, SLOT_NAMES, type SlotId } from "../../domain/types";
import { IncompleteDataWarning, useOutcomeSimulation } from "../shared/OutcomeFeedback";
import { fmt, InformationLabel, NumberField } from "../shared/Primitives";

const dockValue = (value: number) => value >= 10_000
  ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 1 }).format(value)
  : fmt(value);

/** One simulation serves every color: tapping a slot never starts another run. */
export function SellerGlance({ analysis, current, busy }: { analysis?: BreakAnalysis; current: boolean; busy: boolean }) {
  return <section id="seller-value" className="seller-glance" aria-label="Break value at a glance" tabIndex={-1} data-viewport-navigation>
    {!analysis ? <div className="glance-empty">
      <InformationLabel>2 · READ THE BREAK</InformationLabel>
      <h2>Your answer lives here.</h2>
      <p>{busy ? "Calculating your products… Keep adding while this loads." : "Add a product to see expected value and the range for every color."}</p>
      <div className="glance-empty-range"><span>LOW</span><span>TYPICAL</span><span>HIGH</span><i /></div>
    </div> : <GlanceResult analysis={analysis} current={current} busy={busy} />}
  </section>;
}

function GlanceResult({ analysis, current, busy }: { analysis: BreakAnalysis; current: boolean; busy: boolean }) {
  const [slot, setSlot] = useState<SlotId | "random">("random");
  const [shipping, setShipping] = useState<number>();
  const [now, setNow] = useState(Date.now);
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 30_000); return () => window.clearInterval(timer); }, []);
  const simulation = useOutcomeSimulation(analysis, [...SLOT_IDS], undefined, 180);
  const rangesCurrent = current && simulation.current;
  const distribution = slot === "random" ? simulation.result?.remainingPool : simulation.result?.slotDistributions[slot];
  const eligibility = decisionEligibility(analysis.valuation, now);
  const resolvedOnly = analysis.valuation.status === "incomplete" || analysis.outcomeModel.complete === false;
  const fresh = eligibility.status === "eligible" && !resolvedOnly;
  const evidence = eligibility.status === "stale" ? "Prices over 6 hours old" : resolvedOnly ? "Partial model · values may be low" : eligibility.status === "eligible" ? "Fresh price snapshot" : "Estimated values";
  const ceiling = distribution && rangesCurrent ? bidCeiling(distribution.median, { ...DEFAULT_BUYER_COSTS, shipping: shipping ?? 0 }) : undefined;
  const mean = slot === "random" ? analysis.valuation.sellableEV / SLOT_IDS.length : analysis.valuation.slots.find((row) => row.id === slot)?.sellableEV;
  const max = Math.max(1, ...SLOT_IDS.map((id) => simulation.result?.slotDistributions[id].p90 ?? 0));
  return <>
    <header className="glance-heading"><InformationLabel>2 · READ THE BREAK</InformationLabel><span className={fresh ? "glance-fresh" : "glance-caution"}>{evidence}</span></header>
    {!current && <p className="glance-updating" role="status">{busy ? "Updating this mix… Previous values shown below." : "Previous mix shown. Retry to update these values."}</p>}
    <div className="glance-total"><div><span>Whole break · expected card value</span><strong>{fmt(analysis.valuation.sellableEV)}</strong></div><small>{analysis.valuation.threshold > 0 ? `Cards under ${fmt(analysis.valuation.threshold)} excluded` : "All priced cards included"}</small></div>
    <div className="glance-decision" aria-label="Selected spot value">
      <div className="glance-selected"><h2>{slot === "random" ? "Random color spot" : `${SLOT_NAMES[slot]} spot`}</h2><button type="button" className="quiet" aria-pressed={slot === "random"} onClick={() => setSlot("random")}>Random</button></div>
      <div className="glance-limit"><div><span>{fresh ? "Typical-value bid limit" : "Estimated typical card value"}</span><b>{!rangesCurrent ? "—" : fresh && ceiling ? fmt(ceiling.kind === "ceiling" ? ceiling.hammer : 0) : fmt(distribution?.median)}</b></div><small>{!rangesCurrent ? "Updating range…" : fresh ? `Median basis · ${fmt(shipping ?? 0)} shipping · before tax/fees` : "Analysis only · bid limit needs current, complete data"}</small></div>
      <div className="glance-range" aria-label="Modeled opening range">
        <div><span>LOW · 10th</span><b>{rangesCurrent ? fmt(distribution?.p10) : "—"}</b></div>
        <div><span>TYPICAL</span><b>{rangesCurrent ? fmt(distribution?.median) : "—"}</b></div>
        <div><span>HIGH · 90th</span><b>{rangesCurrent ? fmt(distribution?.p90) : "—"}</b></div>
      </div>
      <p className="glance-average">Average {fmt(mean)} · outcomes can fall outside this range.</p>
      <details className="glance-assumptions"><summary>Buyer shipping &amp; range basis</summary><NumberField label="Buyer shipping for this spot" value={shipping} onChange={setShipping} live /><p>Low and high bound the middle 80% of modeled openings. Typical is the median, not a guaranteed return. A random color is equally likely to receive any of the eight colors. This preview assumes all eight are available; use Bid Check for a changing remaining pool, tax or other buyer fees.</p></details>
    </div>
    <div className="glance-colors-heading"><h3>Compare colors</h3><span>Tap a color · average / range</span></div>
    <div className="glance-colors" role="group" aria-label="Compare color values">
      {SLOT_IDS.map((id) => {
        const range = simulation.result?.slotDistributions[id];
        const value = analysis.valuation.slots.find((row) => row.id === id)?.sellableEV;
        return <button type="button" className="glance-color" key={id} aria-label={`Inspect ${SLOT_NAMES[id]} value`} aria-pressed={slot === id} onClick={() => setSlot(id)}>
          <span className={`glance-color-letter slot-letter-${id}`}>{id}</span><span className="glance-color-name">{SLOT_NAMES[id]}</span><b>{fmt(value)}</b>
          <span className="glance-color-bar" aria-hidden="true"><i style={{ left: `${(range?.p10 ?? 0) / max * 100}%`, width: `${Math.max(1, ((range?.p90 ?? 0) - (range?.p10 ?? 0)) / max * 100)}%` } as CSSProperties} /><em style={{ left: `${(range?.median ?? 0) / max * 100}%` }} /></span>
          <small>{rangesCurrent ? `${fmt(range?.p10)}–${fmt(range?.p90)}` : "Range updating…"}</small>
        </button>;
      })}
    </div>
    {simulation.error && <p role="alert">Ranges unavailable. <button className="quiet" onClick={simulation.retry}>Retry ranges</button></p>}
    <IncompleteDataWarning analysis={analysis} title="Partial estimate — see missing data" />
    {createPortal(<aside className="seller-value-dock" aria-label="Quick break values">
      <div><span>Break EV</span><b>{current ? dockValue(analysis.valuation.sellableEV) : "…"}</b></div>
      <div><span>{slot === "random" ? "Random · typical" : `${slot} · typical`}</span><b>{rangesCurrent && distribution ? dockValue(distribution.median) : "…"}</b></div>
      <button type="button" onClick={() => { document.activeElement instanceof HTMLElement && document.activeElement.blur(); const target = document.getElementById("seller-value"); target?.scrollIntoView({ block: "start" }); target?.focus({ preventScroll: true }); }}>Colors ↓</button>
      <small>{!current || !rangesCurrent ? "Updating your mix" : evidence}</small>
    </aside>, document.body)}
  </>;
}
