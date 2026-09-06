import { useEffect, useState } from "react";
import { ShieldAlert } from "lucide-react";
import type { BreakAnalysis } from "../../data/evaluate";
import { deduplicateOmissions } from "../../domain/omissions";
import { simulateOutcomesAsync } from "../../domain/simulation-client";
import type { SimulationResult } from "../../domain/simulation";
import type { SlotId } from "../../domain/types";
import { DisclosureArrow } from "./Primitives";

/** Shared because readiness evidence is role-neutral, not a buyer decision. */
export function IncompleteDataWarning({ analysis, title = "Some values may be low", id, open, onOpenChange }: { analysis: BreakAnalysis; title?: string; id?: string; open?: boolean; onOpenChange?: (open: boolean) => void }) {
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


export function useOutcomeSimulation(analysis: BreakAnalysis | undefined, remaining: SlotId[], landedCost: number | undefined, settleMs = 0, refine = false): { result?: SimulationResult; error?: string; busy: boolean; current: boolean; retry: () => void } {
  const [state, setState] = useState<{ key?: string; result?: SimulationResult; error?: string; busy: boolean }>({ busy: false });
  const [generation, setGeneration] = useState(0);
  const key = analysis ? `${analysis.valuation.dataVersion}|${analysis.valuation.status}|${analysis.valuation.threshold}|${analysis.outcomeModel.cacheKey ?? JSON.stringify(analysis.outcomeModel)}|${remaining.join("")}|${landedCost ?? "none"}` : "none";
  const revision = `${key}|retry:${generation}`;
  useEffect(() => {
    if (!analysis) { setState({ key: revision, busy: false }); return; }
    let current = true;
    let cancelRefinement: (() => void) | undefined;
    setState((previous) => ({ ...previous, busy: true, error: undefined }));
    const start = () => {
      const options = { seed: key, sampleCount: 10_000, remaining, landedCost };
      simulateOutcomesAsync(analysis.outcomeModel, options).then((result) => {
        if (!current) return;
        setState({ key: revision, result, busy: false });
        if (refine) {
          const runRefinement = () => {
            if (!current) return;
            void simulateOutcomesAsync(analysis.outcomeModel, { ...options, sampleCount: 50_000 })
              .then((result) => { if (current) setState({ key: revision, result, busy: false }); })
              .catch(() => { /* Keep the valid interactive result. */ });
          };
          if (window.requestIdleCallback) {
            const id = window.requestIdleCallback(runRefinement, { timeout: 4000 });
            cancelRefinement = () => window.cancelIdleCallback(id);
          } else {
            const id = setTimeout(runRefinement, 750);
            cancelRefinement = () => clearTimeout(id);
          }
        }
      }).catch((error) => { if (current) setState({ key: revision, busy: false, error: error instanceof Error ? error.message : String(error) }); });
    };
    // Rapid quantity taps can settle before enqueueing expensive worker runs.
    // Analytic values and the pending state still update immediately.
    const timer = settleMs > 0 ? setTimeout(start, settleMs) : undefined;
    if (timer === undefined) start();
    return () => { current = false; if (timer !== undefined) clearTimeout(timer); cancelRefinement?.(); };
  }, [key, generation, settleMs, refine]);
  return {
    result: state.result,
    error: state.key === revision ? state.error : undefined,
    busy: Boolean(analysis) && (state.busy || state.key !== revision),
    current: Boolean(state.result && state.key === revision && !state.busy),
    retry: () => setGeneration((value) => value + 1),
  };
}
