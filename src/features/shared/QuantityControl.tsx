import type { BreakLine } from "../../domain/types";
import { NumericInput } from "./Primitives";

/** One quantity interaction for every product surface: decrement, edit, increment. */
export function QuantityControl({ line, update, onEmpty, label = line.productLabel, ariaLabel, className = "" }: {
  line: BreakLine;
  update: (quantity: number) => void;
  onEmpty?: () => void;
  label?: string;
  ariaLabel?: string;
  className?: string;
}) {
  const inputLabel = ariaLabel ?? `${label} quantity in ${line.packCount && line.packCount > 1 ? "products" : "openings"}`;
  return <div className={`quick-line-quantity quantity-selector ${className}`} role="group" aria-label={`${label} quantity controls`}>
    <button type="button" disabled={!onEmpty && line.quantity <= 1}
      aria-label={line.quantity <= 1 ? `Remove ${label} from break` : `Decrease ${label} quantity`}
      onClick={() => line.quantity <= 1 ? onEmpty?.() : update(line.quantity - 1)}>−</button>
    <NumericInput ariaLabel={inputLabel} value={line.quantity} min={1} max={999} integer live selectOnFocus
      onCommit={(value) => { if (value != null) update(value); }} />
    <button type="button" aria-label={`Increase ${label} quantity`} disabled={line.quantity >= 999}
      onClick={() => update(Math.min(999, line.quantity + 1))}>+</button>
  </div>;
}
