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
  const omissions = deduplicateOmissions([...analysis.valuation.omissions, ...analysis.outcomeOmissions].filter((item) => item.material));
  if (analysis.valuation.status !== "incomplete" && analysis.outcomeModel.complete !== false) return null;
  return <details id={id} className="incomplete-data-warning" open={open} onToggle={(event) => onOpenChange?.(event.currentTarget.open)}>
    <summary className="disclosure-summary"><ShieldAlert /><span><b>{title}</b><small>Some prices, pull chances, or pack contents could not be verified.</small></span><DisclosureArrow /></summary>
    <div className="incomplete-data-details"><p>The estimate still uses all verified information. The real value may be higher.</p>
      {omissions.length > 0 && <ul>{omissions.map((omission, index) => <li key={`${omission.code}-${index}`}>{omission.message}</li>)}</ul>}
    </div>
  </details>;
}

export function useOutcomeSimulation(analysis: BreakAnalysis, remaining: SlotId[], landedCost: number | undefined): { result?: SimulationResult; error?: string; busy: boolean; retry: () => void } {
  const [state, setState] = useState<{ result?: SimulationResult; error?: string; busy: boolean }>({ busy: false });
  const [generation, setGeneration] = useState(0);
  const key = `${analysis.valuation.dataVersion}|${analysis.valuation.status}|${analysis.outcomeModel.cacheKey ?? JSON.stringify(analysis.outcomeModel)}|${remaining.join("")}|${landedCost ?? "none"}`;
  useEffect(() => {
    let current = true;
    setState((previous) => ({ ...previous, busy: true, error: undefined }));
    const options = { seed: key, sampleCount: 10_000, remaining, landedCost };
    simulateOutcomesAsync(analysis.outcomeModel, options).then((result) => {
      if (current) setState({ result, busy: false });
    }).catch((error) => { if (current) setState({ busy: false, error: error instanceof Error ? error.message : String(error) }); });
    return () => { current = false; };
  }, [key, generation]);
  return { ...state, retry: () => setGeneration((value) => value + 1) };
}
