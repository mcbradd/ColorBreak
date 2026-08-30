import { describe, expect, it } from "vitest";
import { analyticsPayload } from "./analytics";

describe("analytics event filtering", () => {
  it("keeps only the event taxonomy and non-sensitive counters", () => {
    expect(analyticsPayload("calculation_completed", {
      mode: "buyer",
      productCount: 2,
      durationBucket: "under-10s",
      cardName: "must not leave device",
      bid: 99,
    } as never)).toEqual({
      event: "calculation_completed",
      properties: { mode: "buyer", productCount: 2, durationBucket: "under-10s" },
    });
  });
});
