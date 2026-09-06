import { useEffect, useState } from "react";
import { AnswerNote } from "./Answer";
import { answerFactors } from "../../domain/answer-quality";
import { quickOutcomes } from "../../domain/quick-outcomes";
import type { BreakAnalysis } from "../../data/evaluate";

import { simulateOutcomesAsync } from "../../domain/simulation-client";
import type { SimulationResult } from "../../domain/simulation";
import type { SlotId } from "../../domain/types";


/** Shared because readiness evidence is role-neutral, not a buyer decision. */
export function IncompleteDataWarning({ analysis, title = "Estimate details", id }: { analysis: BreakAnalysis; title?: string; id?: string; open?: boolean; onOpenChange?: (open: boolean) => void }) {
  if (analysis.valuation.status === "verified" && analysis.outcomeModel.complete !== false) return null;
  return <span id={id} className="estimate-basis"><span>{title}</span><AnswerNote detail={[...answerFactors(analysis.valuation, analysis.outcomeModel.complete).slice(0, 3), analysis.valuation.omissions.find((item) => item.material && item.message.length <= 140 && !/uuid|sheet|weight|MTGJSON|collation/i.test(item.message))?.message].filter(Boolean).join(" ")} /></span>;
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
      }).catch((error) => { if (current) setState((previous) => ({ key: revision, result: previous.key?.split("|retry:")[0] === key ? previous.result : undefined, busy: false, error: error instanceof Error ? error.message : String(error) })); });
    };
    // Rapid quantity taps can settle before enqueueing expensive worker runs.
    // Analytic values and the pending state still update immediately.
    const timer = settleMs > 0 ? setTimeout(start, settleMs) : undefined;
    if (timer === undefined) start();
    return () => { current = false; if (timer !== undefined) clearTimeout(timer); cancelRefinement?.(); };
  }, [key, generation, settleMs, refine]);
  return {
    result: state.key?.split("|retry:")[0] === key && state.result ? state.result : analysis ? quickOutcomes(analysis.valuation, remaining, landedCost) : undefined,
    error: state.key === revision ? state.error : undefined,
    busy: Boolean(analysis) && (state.busy || state.key !== revision),
    current: Boolean(state.result && state.key === revision && !state.busy),
    retry: () => setGeneration((value) => value + 1),
  };
}
