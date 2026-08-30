import type { ReactNode } from "react";
import { ShieldAlert } from "lucide-react";
import { DisclosureArrow } from "./Primitives";

/** Role-neutral disclosure for recoverable loading and data warnings. */
export function CompactWarning({ title, summary, children, className = "" }: { title: ReactNode; summary: string; children: ReactNode; className?: string }) {
  return <details className={`compact-warning ${className}`.trim()}>
    <summary className="disclosure-summary"><ShieldAlert /><span><b>{title}</b><small>{summary}</small></span><DisclosureArrow /></summary>
    <div className="compact-warning-details">{children}</div>
  </details>;
}
