import { createContext, useContext, type ReactNode } from "react";
import { fmt, fmtCompact, EstimateTip } from "./Primitives";

const AnswerContext = createContext<readonly string[]>([]);
export const AnswerProvider = AnswerContext.Provider;

/** One control for every calculated value and chart, including portal content. */
export function AnswerNote({ detail, label = "What affects this estimate" }: { detail?: string; label?: string }) {
  const factors = useContext(AnswerContext);
  const text = [...new Set([detail, ...factors.slice(0, 4)].filter((value): value is string => Boolean(value)))].join(" ")
    || "Uses the best available prices and pack odds. Real openings and selling prices vary; this is an estimate, not a guaranteed return.";
  return <EstimateTip label={label} text={text} />;
}

export function AnswerValue({ value, detail, compact = false }: { value: number | undefined; detail?: string; compact?: boolean }) {
  if (compact && value != null && Math.abs(value) >= 1000) detail = `${fmt(value)} before display rounding. ${detail ?? "Uses the available pack rules and prices; missing data can change this estimate."}`;
  return <span className="answer-value">{value != null && !Number.isFinite(value) ? "No finite amount" : compact ? fmtCompact(value ?? 0) : fmt(value ?? 0)}<AnswerNote detail={value != null && !Number.isFinite(value) ? "These assumptions leave no finite break-even price. Percentage fees consume all revenue; lower the fee assumptions to calculate a usable price." : value == null ? "No amount is available yet. $0 counts only what is known, not a confirmed zero." : detail} /></span>;
}

export function AnswerGraphic({ children, detail }: { children: ReactNode; detail: string }) {
  return <div className="answer-graphic">{children}<AnswerNote detail={detail} label="What affects this chart" /></div>;
}
