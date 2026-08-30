import { describe, expect, it } from "vitest";
import { accessInterestFrom } from "./access-interest";

describe("access-interest configuration", () => {
  it("stays absent until destination, owner, and privacy disclosure are all provided", () => {
    expect(accessInterestFrom({ VITE_ACCESS_INTEREST_URL: "https://example.test/form" })).toBeUndefined();
  });

  it("returns the complete, separately disclosed interest route", () => {
    expect(accessInterestFrom({
      VITE_ACCESS_INTEREST_URL: "https://example.test/form",
      VITE_ACCESS_INTEREST_PRIVACY_URL: "https://example.test/privacy",
      VITE_ACCESS_INTEREST_OWNER: "ColorBreak team",
    })).toEqual({ url: "https://example.test/form", privacyUrl: "https://example.test/privacy", owner: "ColorBreak team" });
  });
});
