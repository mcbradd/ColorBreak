import { useBuyerCosts } from "../shared/useBuyerCosts";
import { ShippingField } from "../shared/ShippingField";
import { probableRange, chartPosition } from "../../domain/outcome-chart";
import { answerFactors } from "../../domain/answer-quality";
import { AnswerValue, AnswerNote, AnswerGraphic, AnswerProvider, AnswerGroup } from "../shared/Answer";
import { useEffect, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import type { BreakAnalysis } from "../../data/evaluate";
import { bidCeiling } from "../../domain/bid-ceiling";
import { decisionEligibility } from "../../domain/valuation";
import { SLOT_IDS, SLOT_NAMES, type SlotId, type BreakLine } from "../../domain/types";
import { IncompleteDataWarning, useOutcomeSimulation } from "../shared/OutcomeFeedback";
import { fmt, fmtCompact, InformationLabel, NumberField, Tip } from "../shared/Primitives";

const dockValue = (value: number) => value >= 10_000
  ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 1 }).format(value)
  : fmt(value);

/** One simulation serves every color: tapping a slot never starts another run. */
export function SellerGlance({ analysis, current, busy, lines = [] }: { analysis?: BreakAnalysis; current: boolean; busy: boolean; lines?: BreakLine[] }) {
  return <section id="seller-value" className="seller-glance" aria-label="Break value at a glance" tabIndex={-1} data-viewport-navigation>
    {!analysis ? <div className="glance-empty">
      <InformationLabel>2 · READ THE BREAK</InformationLabel>
      <h2>Your answer lives here.</h2>
      <p>{busy ? "Calculating your products… Keep adding while this loads." : "Add a product to see expected value and the range for every color."}</p>
      <div className="glance-empty-range"><span>MIN</span><span>TYPICAL</span><span>MAX</span><i /></div>
    </div> : <GlanceResult analysis={analysis} current={current} busy={busy} lines={lines} />}
  </section>;
}

function GlanceResult({ analysis, current, busy, lines }: { analysis: BreakAnalysis; current: boolean; busy: boolean; lines: BreakLine[] }) {
  const [slot, setSlot] = useState<SlotId | "random">("random");
  const costs = useBuyerCosts(lines, analysis.valuation);
  const shipping = costs.costs.shipping;
  const [now, setNow] = useState(Date.now);
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 30_000); return () => window.clearInterval(timer); }, []);
  const simulation = useOutcomeSimulation(analysis, [...SLOT_IDS], undefined, 180);
  const rangesCurrent = simulation.current;
  const distribution = slot === "random" ? simulation.result?.remainingPool : simulation.result?.slotDistributions[slot];
  const eligibility = decisionEligibility(analysis.valuation, now);
  const resolvedOnly = analysis.valuation.status === "incomplete" || analysis.outcomeModel.complete === false;
  const fresh = eligibility.status === "eligible" && !resolvedOnly;
  const evidence = eligibility.status === "stale" ? "Prices over 6 hours old" : resolvedOnly ? "Partial model · values may be low" : eligibility.status === "eligible" ? "Fresh price snapshot" : "Estimated values";
  const ceiling = distribution ? bidCeiling(distribution.median, costs.costs) : undefined;
  const mean = slot === "random" ? analysis.valuation.sellableEV / SLOT_IDS.length : analysis.valuation.slots.find((row) => row.id === slot)?.sellableEV;
  const max = Math.max(1, ...SLOT_IDS.map((id) => probableRange(simulation.result?.slotDistributions[id], 0, "80").high));
  return <AnswerProvider value={answerFactors(analysis.valuation, analysis.outcomeModel.complete, busy, analysis.outcomeOmissions)}><AnswerGroup>
    <header className="glance-heading"><InformationLabel>2 · READ THE BREAK</InformationLabel><span className="section-help"><Tip label="How to read these values" text="EV is the average; typical is the median. Bars show the middle 80% of openings. MIN and MAX are separate possible limits." /><AnswerNote primary label="What affects these break values" detail="Bars show the middle 80% of openings; MIN and MAX are separate limits. Bid limits subtract estimated buyer shipping and tax. Missing prices or uncertain pack odds can change these values." /></span><span className={fresh ? "glance-fresh" : "glance-caution"}>{evidence}</span></header>
    {!current && <p className="glance-updating" role="status">{busy ? "Updating this mix… Best available values shown below." : "Best available estimate. Retry to improve it."}</p>}
    <div className="glance-total"><div><span>Whole break · expected card value</span><strong><AnswerValue value={analysis.valuation.sellableEV} /></strong></div><small>{analysis.valuation.threshold > 0 ? `Cards under ${fmt(analysis.valuation.threshold)} excluded` : "All priced cards included"}</small></div>
    <div className="glance-decision" aria-label="Selected spot value">
      <div className="glance-selected"><h2>{slot === "random" ? "Random color spot" : `${SLOT_NAMES[slot]} spot`}</h2><button type="button" className="quiet" aria-pressed={slot === "random"} onClick={() => setSlot("random")}>Random</button></div>
      <div className="glance-limit"><div><span>Estimated bid limit</span><b><AnswerValue value={ceiling?.kind === "ceiling" ? ceiling.hammer : 0} detail={`Uses typical card value after estimated buyer shipping and tax. ${costs.shippingNote} ${costs.taxNote}`} /></b></div><small>{`${fmt(shipping)} shipping · ${costs.costs.taxPercent}% tax`}</small></div>
      <AnswerGraphic detail={simulation.result?.sampleCount === 0 ? "MIN and MAX use the available pack rules. Typical is still being refined. Missing prices or pack details can change the limits." : "Minimum and maximum possible values for the selected spot under the current pack rules and prices, including rare outcomes. Missing data can change the limits."}><div className="glance-range" aria-label="Modeled opening range">
        <div><span>MIN</span><b><AnswerValue value={distribution?.min ?? 0} compact /></b></div>
        <div><span>TYPICAL</span><b><AnswerValue value={distribution?.median ?? 0} compact /></b></div>
        <div><span>MAX</span><b><AnswerValue value={distribution?.max ?? 0} compact /></b></div>
      </div>
      </AnswerGraphic><p className="glance-average">Average <AnswerValue value={mean} /> · MIN–MAX includes rare modeled outcomes.</p>
      <details className="glance-assumptions"><summary>Buyer shipping &amp; range basis</summary><ShippingField label="Buyer shipping for this spot" value={costs.amount} mode={costs.mode} onValue={(shipping) => costs.update({ shipping })} onMode={(shippingMode) => costs.update({ shippingMode })} hint={costs.shippingNote} /><NumberField label="Buyer tax estimate" prefix="" suffix="%" value={costs.costs.taxPercent} onChange={(value) => costs.update({ taxPercent: value ?? 0 })} hint={costs.taxNote} max={100} inline live /><p>MIN and MAX are the minimum and maximum possible values under the current pack rules and prices. Typical is the median, not a guaranteed return. A random color is equally likely to receive any of the eight colors. This preview assumes all eight are available; use Bid Check for a changing remaining pool, a different buyer’s shipping or tax.</p></details>
    </div>
    <div className="glance-colors-heading"><h3>Compare colors</h3><span>Tap a color · average / range</span></div>
    <div className="glance-colors" role="group" aria-label="Compare color values">
      {SLOT_IDS.map((id) => {
        const range = simulation.result?.slotDistributions[id];
        const value = analysis.valuation.slots.find((row) => row.id === id)?.sellableEV;
        const { low, high } = probableRange(range, 0, "80");
        return <button type="button" className="glance-color" key={id} aria-label={`Inspect ${SLOT_NAMES[id]} value`} aria-pressed={slot === id} onClick={() => setSlot(id)}>
          <span className={`glance-color-letter slot-letter-${id}`}>{id}</span><span className="glance-color-name">{SLOT_NAMES[id]}</span><b><AnswerValue value={value} /></b>
          <span className="glance-color-bar" aria-hidden="true"><i style={{ left: `${chartPosition(low, max)}%`, width: `${Math.max(1, chartPosition(high, max) - chartPosition(low, max))}%` } as CSSProperties} /><em style={{ left: `${chartPosition(range?.median ?? 0, max)}%` }} /></span>
          <small>{`MIN ${fmtCompact(range?.min ?? 0)} · MAX ${fmtCompact(range?.max ?? 0)}`}<AnswerNote detail={`The bar shows the middle 80% of modeled openings, excluding the most extreme 10% at each end. The marker shows the median. MIN and MAX are numerical limits only; they do not set the bar scale.${simulation.result?.sampleCount === 0 ? " This is a provisional range while sampling finishes." : ""}`} /></small>
        </button>;
      })}
    </div>
    {simulation.error && <p role="alert">Quick estimates shown. <button className="quiet" onClick={simulation.retry}>Retry ranges</button></p>}
    <IncompleteDataWarning analysis={analysis} title="Partial estimate — see missing data" />
    {createPortal(<aside className="seller-value-dock" aria-label="Quick break values">
      <div><span>Break EV</span><b>{dockValue(analysis.valuation.sellableEV)}<AnswerNote /></b></div>
      <div><span>{slot === "random" ? "Random · typical" : `${slot} · typical`}</span><b>{dockValue(distribution?.median ?? 0)}<AnswerNote /></b></div>
      <button type="button" onClick={() => { document.activeElement instanceof HTMLElement && document.activeElement.blur(); const target = document.getElementById("seller-value"); target?.scrollIntoView({ block: "start" }); target?.focus({ preventScroll: true }); }}>Colors ↓</button>
      <small>{!current || !rangesCurrent ? "Updating your mix" : evidence}</small>
    </aside>, document.body)}
  </AnswerGroup></AnswerProvider>;
}
