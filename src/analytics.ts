export type AnalyticsEvent =
  | "persona_selected" | "builder_opened" | "product_selected" | "builder_abandoned"
  | "calculation_completed" | "decision_eligibility" | "draft_resumed"
  | "buyer_setup_copied" | "price_refresh_requested" | "break_link_shared";

const ALLOWED: Record<AnalyticsEvent, readonly string[]> = {
  persona_selected: ["mode", "viewportClass"], builder_opened: ["mode"],
  product_selected: ["mode", "productCount"], builder_abandoned: ["mode", "durationBucket"],
  calculation_completed: ["mode", "productCount", "status", "durationBucket"],
  decision_eligibility: ["mode", "eligibility"], draft_resumed: ["mode", "productCount"],
  buyer_setup_copied: ["mode", "productCount"],
  price_refresh_requested: ["mode", "productCount"],
  break_link_shared: ["mode", "productCount"],
};

export function analyticsPayload(
  event: AnalyticsEvent,
  properties: Record<string, string | number | boolean | undefined>,
): { event: AnalyticsEvent; properties: Record<string, string | number | boolean> } {
  return {
    event,
    properties: Object.fromEntries(Object.entries(properties).filter(([key, value]) =>
      ALLOWED[event].includes(key) && value != null,
    )) as Record<string, string | number | boolean>,
  };
}

export function track(
  event: AnalyticsEvent,
  properties: Record<string, string | number | boolean | undefined>,
): void {
  const endpoint = import.meta.env.VITE_ANALYTICS_ENDPOINT as string | undefined;
  if (!endpoint || typeof navigator === "undefined" || typeof navigator.sendBeacon !== "function") return;
  const body = JSON.stringify({ ...analyticsPayload(event, properties), sentAt: new Date().toISOString() });
  navigator.sendBeacon(endpoint, new Blob([body], { type: "application/json" }));
}
