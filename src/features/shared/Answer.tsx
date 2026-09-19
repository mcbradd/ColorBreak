import { createContext, useContext, useCallback, useEffect, useId, useMemo, useState, type ReactNode } from "react";
import { fmt, fmtCompact, EstimateTip } from "./Primitives";
import { InformationButton } from "./InformationLayer";

const AnswerContext = createContext<readonly string[]>([]);
export const AnswerProvider = AnswerContext.Provider;

const GroupContext = createContext<{ notes: Map<string, string>; register: (id: string, detail?: string) => void } | null>(null);
/** Values contribute evidence to one header control instead of growing tap targets in every row. */
export function AnswerGroup({ children }: { children: ReactNode }) {
  const [notes, setNotes] = useState(new Map<string, string>());
  const register = useCallback((id: string, detail?: string) => setNotes(current => {
    if (current.get(id) === detail) return current;
    const next = new Map(current);
    if (detail) next.set(id, detail); else next.delete(id);
    return next;
  }), []);
  const group = useMemo(() => ({ notes, register }), [notes, register]);
  return <GroupContext.Provider value={group}>{children}</GroupContext.Provider>;
}

export function conciseExplanation(parts: readonly (string | undefined)[]): string {
  const sentences = [...new Set(parts.filter(Boolean).flatMap(part => part!.split(/(?<=[.!?])\s+(?=[A-Z])/)))];
  const result: string[] = [];
  let words = 0;
  for (const sentence of sentences) {
    const count = sentence.split(/\s+/).length;
    if (words + count > 65) continue;
    result.push(sentence); words += count;
  }
  return result.join("\n\n") || "Uses available prices and estimated pack odds. Real openings vary.";
}

/** One header control per group; standalone values retain an accessible explanation. */
export function AnswerNote({ detail, label = "What affects this estimate", primary = false }: { detail?: string; label?: string; primary?: boolean }) {
  const factors = useContext(AnswerContext);
  const group = useContext(GroupContext);
  const register = group?.register;
  const id = useId();
  useEffect(() => {
    if (!register || !detail) return;
    register(id, detail);
    return () => register(id);
  }, [register, primary, id, detail]);
  if (group && !primary) return null;
  const text = conciseExplanation([detail, ...factors, ...(group?.notes.values() ?? [])]);
  return <EstimateTip label={label} text={text} />;
}

export function AnswerValue({ value, detail, compact = false, label = "Value details", interactive = true }: { value: number | undefined; detail?: string; compact?: boolean; label?: string; interactive?: boolean }) {
  const factors = useContext(AnswerContext);
  const group = useContext(GroupContext);
  if (compact && value != null && Math.abs(value) >= 1000) detail = `${fmt(value)} before display rounding. ${detail ?? "Uses the available pack rules and prices; missing data can change this estimate."}`;
  const invalid = value != null && !Number.isFinite(value);
  const explanation = invalid ? "These assumptions leave no finite break-even price. Percentage fees consume all revenue; lower the fee assumptions to calculate a usable price." : value == null ? "No amount is available yet. $0 counts only what is known, not a confirmed zero." : detail;
  const display = invalid ? "No finite amount" : compact ? fmtCompact(value ?? 0) : fmt(value ?? 0);
  return <span className="answer-value">{interactive ? <InformationButton title={label} label={`${label}: ${display}`} preview={`${invalid ? display : fmt(value ?? 0)}. ${explanation ?? conciseExplanation([...factors, ...(group?.notes.values() ?? [])])}`} className="value-information" content={<>
    <p className="information-amount">{invalid ? display : fmt(value ?? 0)}</p>
    <p>{explanation ?? "Uses the best available prices and current assumptions. This amount can change as evidence improves."}</p>
    {[...new Set([...factors, ...(group?.notes.values() ?? [])])].filter(note => note !== detail).map(note => <p key={note}>{note}</p>)}
  </>}>{display}</InformationButton> : display}<AnswerNote detail={explanation} /></span>;
}

export function AnswerGraphic({ children, detail }: { children: ReactNode; detail: string }) {
  const factors = useContext(AnswerContext);
  return <div className="answer-graphic"><InformationButton title="Chart details" preview={detail} className="chart-information" content={<><p>{detail}</p>{factors.map(note => <p key={note}>{note}</p>)}</>}><span className="sr-only">Explore this chart</span></InformationButton><div className="answer-graphic-content">{children}</div><AnswerNote detail={detail} label="What affects this chart" /></div>;
}
