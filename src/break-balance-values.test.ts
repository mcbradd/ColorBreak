import { createElement } from "react";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BreakBalance } from "./App";
import { calculateBreak } from "./domain/valuation";
import { SLOT_IDS } from "./domain/types";
import type { DistributionSummary, SimulationResult } from "./domain/simulation";

const summary = (median: number): DistributionSummary => ({
  min: 0, p10: 0, p25: median / 2, median, mean: median, p75: median * 1.5, p90: median + 5, max: median + 10, fingerprint: [],
});

describe("Break Balance values", () => {
  it("shows one middle-half body and typical-value label per color without repeating inspector averages", () => {
    const result = calculateBreak({
      threshold: 2,
      prices: [
        { id: "w", set: "TST", collectorNumber: "1", name: "White", slot: "W", nonfoil: 10, foil: null },
        { id: "u", set: "TST", collectorNumber: "2", name: "Blue", slot: "U", nonfoil: 20, foil: null },
      ],
      draws: [
        { set: "TST", collectorNumber: "1", copies: 1, foil: false, source: "test" },
        { set: "TST", collectorNumber: "2", copies: 1, foil: false, source: "test" },
      ],
    });
    const slotDistributions = Object.fromEntries(SLOT_IDS.map((id) => [id, summary(id === "W" ? 10 : id === "U" ? 20 : 0)])) as SimulationResult["slotDistributions"];
    const simulation: SimulationResult = { seed: "test", sampleCount: 10, slotDistributions, remainingPool: summary(0) };
    const { container } = render(createElement(BreakBalance, { result, simulation, remaining: [...SLOT_IDS] }));
    expect(container.querySelectorAll(".balance-average")).toHaveLength(0);
    expect(container.querySelectorAll(".balance-column")).toHaveLength(8);
    expect(container.querySelectorAll(".balance-best")).toHaveLength(8);
    expect(container.querySelectorAll(".balance-worst")).toHaveLength(8);
    expect(container.querySelectorAll(".balance-median")).toHaveLength(8);
    expect(container.querySelectorAll(".balance-middle")).toHaveLength(8);
    expect(container.querySelector(".balance-median b")?.textContent).toBe("$10.0");
    expect(container.querySelector(".balance-median")?.getAttribute("style")).toContain("bottom: 33.3333");
  });
});
