import type { BreakLine, ValuationResult } from "./types";
import type { BuyerCosts } from "./bid-ceiling";

export type ShippingMode = "flat" | "per-item";
/** Only intentional edits are stored. Defaults can improve with the break data. */
export interface CostOverrides { shipping?: number; shippingMode?: ShippingMode; taxPercent?: number }
export const SHIPPING_NOTE = "Estimated US Whatnot Ground Advantage label, including operational fees (July 31, 2026). Uses all opened cards, about 1.8 g each, plus packaging; the value filter does not reduce weight. Actual packed weight, seller profiles, earlier purchases and destination can change the charge. Alaska, Hawaii and international rates differ. Above 5 lb, multiple 5 lb parcels are a rough estimate.";

export function labelPrice(ounces: number): number {
  if (ounces <= 0) return 0;
  if (ounces <= 4) return 4.47;
  if (ounces <= 8) return 4.85;
  if (ounces <= 12) return 5.25;
  if (ounces < 16) return 6.75;
  return 7.75 * Math.ceil(ounces / 80);
}

/** Physical cards, including chaff. Partial models cannot erase unresolved packs. */
export function estimatedCards(lines: BreakLine[], result?: ValuationResult): number {
  const fallback = lines.reduce((sum, line) => sum + line.quantity * Math.max(1, line.packCount ?? 1)
    * (/sample/i.test(line.productLabel) ? 2 : /set booster/i.test(line.productLabel) ? 12 : /play booster/i.test(line.productLabel) ? 14 : 15), 0);
  const modeled = result?.expectedCards ?? 0;
  return result?.omissions.some((item) => item.material) || !modeled ? Math.max(fallback, modeled) : modeled;
}

export function estimatedLabel(cards: number, spots = 8, purchases = 1): number {
  if (purchases <= 0 || cards <= 0) return 0;
  const perSpot = cards / Math.max(1, spots) * 1.8 / 28.3495;
  // One combined mailer, with additional packaging for heavier parcels.
  const weight = perSpot * purchases;
  return labelPrice(Math.ceil(weight + (weight > 12 ? 4 : 1)));
}

const TAX_REGIONS: Record<string, [string, number]> = {
  "America/Los_Angeles": ["California / Pacific time", 9.03],
  "America/New_York": ["New York / Eastern time", 8.54],
  "America/Chicago": ["Illinois / Central time", 8.98],
  "America/Denver": ["Colorado / Mountain time", 7.89],
  "America/Phoenix": ["Arizona", 8.54],
  "America/Detroit": ["Michigan", 6],
  "America/Indiana/Indianapolis": ["Indiana", 7],
  "America/Anchorage": ["Alaska", 1.82],
  "Pacific/Honolulu": ["Hawaii", 4.5],
};

export function estimatedTax(timeZone: string): { rate: number; note: string } {
  const region = TAX_REGIONS[timeZone];
  return {
    rate: region?.[1] ?? 7.53,
    note: `${region ? `Device time zone suggests ${region[0]}; using its average` : "Delivery location is unknown; using the US average"} sales tax. This is a rough guess, not your address: a time zone spans different tax areas. July 2026 state/local averages. Applied to bid plus added shipping; shipping exemptions and your checkout address can change tax. Enter your checkout rate to improve it.`,
  };
}

export function resolveCosts(overrides: CostOverrides, cards: number, spots: number, owned: number, timeZone: string) {
  const mode = overrides.shippingMode ?? "flat";
  const tax = estimatedTax(timeZone);
  const amount = overrides.shipping ?? estimatedLabel(cards, spots, mode === "flat" ? owned + 1 : 1);
  const previous = mode === "flat" && owned > 0
    ? overrides.shipping ?? estimatedLabel(cards, spots, owned) : 0;
  const costs: BuyerCosts = { shipping: Math.max(0, Math.round((amount - previous) * 100) / 100), taxPercent: overrides.taxPercent ?? tax.rate };
  return { costs, amount, mode, taxNote: overrides.taxPercent == null ? tax.note : "Your saved checkout tax rate. Applied to bid plus added shipping; shipping exemptions can change the actual tax.",
    shippingNote: `${SHIPPING_NOTE} ${mode === "flat" ? "Flat fee shows the combined label for your owned spots plus the next spot. Only the increase is deducted from the next bid limit. An entered flat fee is charged once, so additional owned spots add $0." : "Per item charges the displayed amount for every purchased spot."} ${overrides.shipping == null ? "Updates with break contents until you type an override." : "Your entered amount stays until all local app data is cleared."}` };
}
