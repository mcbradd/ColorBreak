import { createElement } from "react";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BreakBalance } from "./App";
import { calculateBreak } from "./domain/valuation";
import { SLOT_IDS } from "./domain/types";
import type { PackOutcomeModel } from "./domain/simulation";

describe("Break Balance values", () => {
  it("uses simulated one-percent bounds and the interquartile range for the candle body", () => {
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
    const model: PackOutcomeModel = {
      fixed: [],
      packs: [{
        count: 1,
        variants: [{ weight: 1, picks: { cards: 1 } }],
        sheets: { cards: { totalWeight: 2, cards: [
          { id: "zero", slot: "W", value: 0, weight: 1 },
          { id: "twenty", slot: "W", value: 20, weight: 1 },
        ] } },
      }],
    };
    const distribution = {
      min: 0, p01: 1, p10: 3, p25: 5, median: 9, mean: 10, p75: 14, p90: 18, p99: 19, max: 20, fingerprint: [],
    };
    const simulation = {
      seed: "test", sampleCount: 50_000,
      slotDistributions: Object.fromEntries(SLOT_IDS.map((id) => [id, distribution])),
      remainingPool: distribution,
    };
    const { container } = render(createElement(BreakBalance, { result, model, remaining: [...SLOT_IDS], simulation }));
    expect(container.querySelectorAll(".balance-average")).toHaveLength(0);
    expect(container.querySelectorAll(".balance-column")).toHaveLength(8);
    expect(container.querySelectorAll(".balance-best")).toHaveLength(8);
    expect(container.querySelectorAll(".balance-worst")).toHaveLength(8);
    expect(container.querySelectorAll(".balance-ev")).toHaveLength(8);
    expect(container.querySelectorAll(".balance-body")).toHaveLength(8);
    expect(container.querySelector(".slot-W .balance-best")?.textContent).toBe("$19.0");
    expect(container.querySelector(".slot-W .balance-worst")?.textContent).toBe("$1.0");
    expect(container.querySelector(".slot-W .balance-ev b")?.textContent).toBe("EV$10.0");
    const onScale = (value: number) => Math.log1p(value) / Math.log1p(20) * 100;
    expect(container.querySelector(".slot-W .balance-body")?.getAttribute("style")).toContain(`bottom: ${onScale(5)}%`);
    expect(container.querySelector(".slot-W .balance-body")?.getAttribute("style")).toContain(`height: ${onScale(14) - onScale(5)}%`);
    expect(container.querySelector(".slot-W .balance-ev")?.getAttribute("style")).toContain(`bottom: ${onScale(10)}%`);
  });
});
