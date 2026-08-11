import { describe, expect, it } from "vitest";
import { analyticsPayload } from "./analytics";

describe("privacy-conscious analytics", () => {
  it("keeps only the event taxonomy and non-sensitive counters", () => {
    expect(analyticsPayload("first_result", {
      mode: "buyer",
      productCount: 2,
      durationBucket: "under-10s",
      cardName: "must not leave device",
      bid: 99,
    } as never)).toEqual({
      event: "first_result",
      properties: { mode: "buyer", productCount: 2, durationBucket: "under-10s" },
    });
  });
});
