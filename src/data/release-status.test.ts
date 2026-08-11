import { describe, expect, it } from "vitest";
import { releaseStatus } from "./sealed";

describe("release evidence status", () => {
  it("keeps a structured prerelease product estimated until release day", () => {
    expect(releaseStatus("2026-08-14", "2026-08-11")).toBe("estimated");
    expect(releaseStatus("2026-08-14", "2026-08-14")).toBe("verified");
  });
});
