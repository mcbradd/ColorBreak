export type AnalyticsEvent =
  | "break_created"
  | "first_result"
  | "slot_assigned"
  | "break_shared"
  | "calculation_error";

const ALLOWED: Record<AnalyticsEvent, readonly string[]> = {
  break_created: ["mode", "productCount"],
  first_result: ["mode", "productCount", "durationBucket", "status"],
  slot_assigned: ["remainingCount"],
  break_shared: ["mode", "productCount", "remainingCount"],
  calculation_error: ["mode", "stage", "code"],
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
