import { createContext, useContext, useCallback, useEffect, useId, useMemo, useState, type ReactNode } from "react";
import { fmt, fmtCompact, EstimateTip } from "./Primitives";

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
    if (!register || primary || !detail) return;
    register(id, detail);
    return () => register(id);
  }, [register, primary, id, detail]);
  if (group && !primary) return null;
  const text = conciseExplanation([detail, ...factors, ...(group?.notes.values() ?? [])]);
  return <EstimateTip label={label} text={text} />;
}

export function AnswerValue({ value, detail, compact = false }: { value: number | undefined; detail?: string; compact?: boolean }) {
  if (compact && value != null && Math.abs(value) >= 1000) detail = `${fmt(value)} before display rounding. ${detail ?? "Uses the available pack rules and prices; missing data can change this estimate."}`;
  return <span className="answer-value">{value != null && !Number.isFinite(value) ? "No finite amount" : compact ? fmtCompact(value ?? 0) : fmt(value ?? 0)}<AnswerNote detail={value != null && !Number.isFinite(value) ? "These assumptions leave no finite break-even price. Percentage fees consume all revenue; lower the fee assumptions to calculate a usable price." : value == null ? "No amount is available yet. $0 counts only what is known, not a confirmed zero." : detail} /></span>;
}

export function AnswerGraphic({ children, detail }: { children: ReactNode; detail: string }) {
  return <div className="answer-graphic">{children}<AnswerNote detail={detail} label="What affects this chart" /></div>;
}
