import type { ShippingMode } from "../../domain/cost-assumptions";
import { NumberField } from "./Primitives";

export function ShippingField({ value, mode, onValue, onMode, hint, label = "Shipping" }: {
  value: number; mode: ShippingMode; onValue: (value: number) => void;
  onMode: (mode: ShippingMode) => void; hint: string; label?: string;
}) {
  return <div className="shipping-field">
    <div className="shipping-mode" role="group" aria-label={`${label} basis`}>
      <button type="button" aria-pressed={mode === "per-item"} onClick={() => onMode("per-item")}>Per item</button>
      <button type="button" aria-pressed={mode === "flat"} onClick={() => onMode("flat")}>Flat fee</button>
    </div>
    <NumberField label={label} value={value} onChange={(n) => onValue(n ?? 0)} hint={hint} live inline />
  </div>;
}
