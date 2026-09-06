import { createElement, useEffect } from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BreakAnalysis } from "./data/evaluate";
import { summarizeDistribution, type SimulationResult } from "./domain/simulation";
import { calculateBreak } from "./domain/valuation";
import { SLOT_IDS, type SlotId } from "./domain/types";

const mocks = vi.hoisted(() => ({
  requests: vi.fn(),
  state: {
    result: undefined as SimulationResult | undefined,
    current: false,
    busy: true,
    error: undefined as string | undefined,
    retry: vi.fn(),
  },
}));

vi.mock("./features/shared/OutcomeFeedback", () => ({
  IncompleteDataWarning: () => null,
  useOutcomeSimulation: (analysis: BreakAnalysis, remaining: SlotId[], landedCost?: number, settleMs = 0) => {
    // Track requested inputs at the hook seam while controlling its lifecycle.
    const key = `${analysis.outcomeModel.cacheKey}|${remaining.join("")}|${landedCost ?? "none"}|${settleMs}`;
    useEffect(() => { mocks.requests(analysis, remaining, landedCost, settleMs); }, [key]);
    return mocks.state;
  },
}));

import { UpsideCandles } from "./features/seller/SellerView";
import { SellerGlance } from "./features/seller/SellerGlance";

function analysis(): BreakAnalysis {
  return {
    valuation: calculateBreak({
      prices: [
        { id: "w", set: "TST", collectorNumber: "1", name: "White", slot: "W", nonfoil: 10, foil: null },
        { id: "u", set: "TST", collectorNumber: "2", name: "Blue", slot: "U", nonfoil: 20, foil: null },
      ],
      draws: [
        { set: "TST", collectorNumber: "1", copies: 1, foil: false, source: "fixed" },
        { set: "TST", collectorNumber: "2", copies: 1, foil: false, source: "fixed" },
      ],
      threshold: 0, dataVersion: "glance-test", priceSource: "snapshot", pricedAt: new Date().toISOString(),
    }),
    outcomeModel: { cacheKey: "glance-test", complete: true, fixed: [], packs: [] },
    outcomeOmissions: [],
    priceAvailability: { status: "available", source: "snapshot", message: "Available" },
  };
}

const zero = summarizeDistribution([0]);
const ranges: SimulationResult = {
  seed: "glance-test", sampleCount: 10_000,
  remainingPool: summarizeDistribution([0, 0, 0, 4, 20, 20, 20]),
  slotDistributions: {
    W: summarizeDistribution([0, 0, 0, 0, 0, 0, 0, 0, 100, 100]),
    U: summarizeDistribution([2, 5, 8]),
    B: zero, R: zero, G: zero, M: zero, C: zero, L: zero,
  },
};

function show(value = analysis(), current = true) {
  return render(createElement(SellerGlance, { analysis: value, current, busy: !current }));
}

describe("seller value at a glance", () => {
  beforeEach(() => {
    mocks.requests.mockClear(); mocks.state.retry.mockClear();
    mocks.state.result = ranges; mocks.state.current = true; mocks.state.busy = false; mocks.state.error = undefined;
  });
  afterEach(cleanup);

  it("keeps compact bars readable when possible MAX is far beyond the probable range", () => {
    const summary = { ...zero, p01: 2, p10: 5, p25: 10, median: 20, mean: 20, p75: 30, p90: 40, p99: 50, max: 10000 };
    mocks.state.result = { ...ranges, slotDistributions: Object.fromEntries(SLOT_IDS.map(id => [id, summary])) as SimulationResult["slotDistributions"] };
    const { container } = show();
    expect(container.querySelector<HTMLElement>(".glance-color-bar i")?.style.width).toBe("87.5%");
    expect(container.querySelector<HTMLElement>(".glance-color-bar i")?.style.left).toBe("12.5%");
    expect(screen.getByRole("button", { name: "Inspect White value" })).toHaveTextContent(/MAX \$10(?:\.0)?K/);
  });

  it("uses probable whiskers and middle-half bodies for vertical comparison candles", () => {
    const summary = { ...zero, p01: 2, p25: 10, median: 20, p75: 30, p99: 50, max: 10000 };
    mocks.state.result = { ...ranges, slotDistributions: Object.fromEntries(SLOT_IDS.map(id => [id, summary])) as SimulationResult["slotDistributions"] };
    const value = analysis();
    const { container } = render(createElement(UpsideCandles, { base: value, bonus: value, bonusLabel: "Pack", selectedSlot: "W", selectSlot: () => {}, useRandom: false, buyerLanded: 0 }));
    expect(container.querySelector<HTMLElement>(".candle-wick")?.style.bottom).toBe("4%");
    expect(container.querySelector<HTMLElement>(".candle-wick")?.style.height).toBe("96%");
    expect(container.querySelector<HTMLElement>(".candle-body")?.style.height).toBe("40%");
  });

  it("shows whole-break and per-color EV before an outcome range finishes", () => {
    mocks.state.result = undefined; mocks.state.current = false; mocks.state.busy = true;
    show();
    expect(screen.getByText("Whole break · expected card value").parentElement).toHaveTextContent("$30.00");
    expect(screen.getByRole("button", { name: "Inspect White value" })).toHaveTextContent("$10.00");
    expect(screen.getByRole("button", { name: "Inspect Blue value" })).toHaveTextContent("$20.00");
    expect(screen.getByLabelText("Selected spot value")).toHaveTextContent("Average $3.75");
    expect(screen.getByLabelText("Modeled opening range")).toHaveTextContent("$0.00");
    expect(screen.getAllByRole("button", { name: "What affects this chart" }).length).toBeGreaterThan(0);
  });

  it("shows the selected color's endpoints and retains a real zero median", () => {
    show();
    fireEvent.click(screen.getByRole("button", { name: "Inspect White value" }));
    let region = screen.getByLabelText("Modeled opening range");
    expect(within(region).getByText("TYPICAL").parentElement).toHaveTextContent("$0.00");
    expect(within(region).getByText("MIN").parentElement).toHaveTextContent("$0.00");
    expect(within(region).getByText("MAX").parentElement).toHaveTextContent("$100.00");
    expect(screen.getByText("Estimated bid limit").parentElement).toHaveTextContent("$0.00");
    expect(screen.getByLabelText("Selected spot value")).toHaveTextContent("Average $10.00");

    fireEvent.click(screen.getByRole("button", { name: "Inspect Blue value" }));
    region = screen.getByLabelText("Modeled opening range");
    expect(within(region).getByText("MIN").parentElement).toHaveTextContent("$2.00");
    expect(within(region).getByText("TYPICAL").parentElement).toHaveTextContent("$5.00");
    expect(within(region).getByText("MAX").parentElement).toHaveTextContent("$8.00");
    expect(screen.getByRole("button", { name: "Inspect Blue value" })).toHaveAttribute("aria-pressed", "true");
  });

  it.each(["stale", "material omission", "incomplete outcomes", "estimated"])("shows the best available bid cap for %s evidence", (condition) => {
    const value = analysis();
    if (condition === "stale") value.valuation.pricedAt = new Date(Date.now() - 7 * 60 * 60 * 1000).toISOString();
    if (condition === "material omission") {
      value.valuation.status = "incomplete";
      value.valuation.omissions.push({ code: "missing-price", message: "One price is unavailable", material: true });
    }
    if (condition === "incomplete outcomes") value.outcomeModel.complete = false;
    if (condition === "estimated") value.valuation.status = "estimated";
    show(value);
    expect(screen.getByText("Estimated bid limit").parentElement).toHaveTextContent("$4.00");
    expect(screen.queryByText(/Analysis only/)).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "What affects this estimate" }).length).toBeGreaterThan(0);
  });

  it("keeps numeric ranges available while refinement runs", () => {
    mocks.state.current = false; mocks.state.busy = true;
    show();
    const region = screen.getByLabelText("Modeled opening range");
    expect(region).toHaveTextContent("$4.00");
    expect(region).toHaveTextContent("$20.00");
    expect(screen.getByText("Estimated bid limit").parentElement).toHaveTextContent("$4.00");
    expect(screen.getByRole("button", { name: "Inspect White value" })).toHaveTextContent("$100.00");
  });

  it("marks an updating composition and keeps its best available cap", () => {
    show(analysis(), false);
    expect(screen.getByText("Updating this mix… Best available values shown below.")).toBeInTheDocument();
    expect(screen.getByText("Estimated bid limit").parentElement).toHaveTextContent("$4.00");
    expect(screen.getByLabelText("Modeled opening range")).toHaveTextContent("$4.00");
  });

  it("updates color and shipping instantly without requesting another simulation", () => {
    const value = analysis();
    show(value);
    expect(mocks.requests).toHaveBeenCalledTimes(1);
    expect(mocks.requests).toHaveBeenLastCalledWith(value, [...SLOT_IDS], undefined, 180);
    fireEvent.click(screen.getByRole("button", { name: "Inspect Blue value" }));
    expect(screen.getByText("Estimated bid limit").parentElement).toHaveTextContent("$5.00");
    fireEvent.change(screen.getByLabelText("Buyer shipping for this spot"), { target: { value: "2" } });
    expect(screen.getByText("Estimated bid limit").parentElement).toHaveTextContent("$3.00");
    fireEvent.click(screen.getByRole("button", { name: "Random", exact: true }));
    expect(screen.getByText("Estimated bid limit").parentElement).toHaveTextContent("$2.00");
    expect(mocks.requests).toHaveBeenCalledTimes(1);
  });
});
