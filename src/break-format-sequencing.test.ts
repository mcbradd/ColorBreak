import { createElement } from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { calculateBreak } from "./domain/valuation";
import { SLOT_IDS } from "./domain/types";
import type { BreakAnalysis } from "./data/evaluate";

const evaluateBreakAnalysis = vi.hoisted(() => vi.fn());
const simulateOutcomesAsync = vi.hoisted(() => vi.fn());
vi.mock("./data/evaluate", () => ({ evaluateBreakAnalysis }));
vi.mock("./domain/simulation-client", () => ({ simulateOutcomesAsync }));

import { BuyerWorkspace } from "./features/buyer/BuyerWorkspace";

const valuation = calculateBreak({
  prices: [{ id: "w", set: "TST", collectorNumber: "1", name: "White", slot: "W", nonfoil: 20, foil: null }],
  draws: [{ set: "TST", collectorNumber: "1", copies: 1, foil: false, source: "fixed" }],
  threshold: 2,
});

const analysis: BreakAnalysis = {
  valuation,
  outcomeModel: { cacheKey: "format-sequencing", complete: true, packs: [], fixed: [{ id: "w", slot: "W", value: 20 }] },
  outcomeOmissions: [],
  priceAvailability: { status: "available", source: "test", message: "Test snapshot" },
};

const distribution = {
  min: 0, p01: 0, p10: 4, p25: 8, median: 12, mean: 14,
  p75: 18, p90: 24, p99: 30, max: 30, fingerprint: [],
};

const savedLine = {
  id: "line-1",
  set: "TST",
  productKey: "play-box",
  productLabel: "Play Booster Box",
  quantity: 1,
  tcgId: 1,
  marketCost: 100,
};

/**
 * The break format is a different kind of auction, not a detail of slot
 * picking. A buyer who came looking for a large break has to see that the
 * option exists before building anything, or they conclude it does not exist.
 */
describe("break format sequencing", () => {
  beforeEach(() => {
    evaluateBreakAnalysis.mockResolvedValue(analysis);
    simulateOutcomesAsync.mockResolvedValue({
      seed: "test",
      sampleCount: 50_000,
      slotDistributions: Object.fromEntries(SLOT_IDS.map((id) => [id, distribution])),
      remainingPool: distribution,
    });
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
    sessionStorage.clear();
    evaluateBreakAnalysis.mockReset();
    simulateOutcomesAsync.mockReset();
  });

  it("shows both formats on arrival, before any product is added", () => {
    render(createElement(BuyerWorkspace, { exit: vi.fn(), startFresh: true, startReady: false }));

    expect(screen.getByText("0 lines · 0 openings")).toBeInTheDocument();
    const formats = screen.getByRole("group", { name: "Break format" });
    expect(within(formats).getByRole("button", { name: "Color slots" })).toHaveAttribute("aria-pressed", "true");
    expect(within(formats).getByRole("button", { name: "Large break" })).toBeInTheDocument();
  });

  it("switches to a large break with no product in the break", () => {
    render(createElement(BuyerWorkspace, { exit: vi.fn(), startFresh: true, startReady: false }));

    fireEvent.click(screen.getByRole("button", { name: "Large break" }));

    expect(screen.getByRole("heading", { name: "Plan a large break" })).toBeInTheDocument();
    expect(screen.getByLabelText("Large break spot count")).toHaveValue("120");
    expect(screen.getByRole("button", { name: "Large break" })).toHaveAttribute("aria-pressed", "true");
  });

  it("keeps the standard color path one tap away and free of extra steps", () => {
    render(createElement(BuyerWorkspace, { exit: vi.fn(), startFresh: true, startReady: false }));

    fireEvent.click(screen.getByRole("button", { name: "Large break" }));
    fireEvent.click(screen.getByRole("button", { name: "Color slots" }));

    expect(screen.getByRole("heading", { name: "Check a color-break bid" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Large break spot count")).toBeNull();
  });

  it("keeps break contents and slot choices across a format change, naming what a large break cannot use", async () => {
    sessionStorage.setItem("colorbreak:buyer:draft:v1", JSON.stringify([savedLine]));
    render(createElement(BuyerWorkspace, { exit: vi.fn(), startFresh: false, startReady: false }));

    await screen.findByRole("region", { name: "Live bid decision" });
    fireEvent.click(screen.getByRole("button", { name: "Add Blue to the slots you’re considering" }));
    fireEvent.click(screen.getByRole("button", { name: "Mark Red taken" }));

    fireEvent.click(screen.getByRole("button", { name: "Large break" }));

    // The break itself survives the format change untouched.
    await waitFor(() => expect(screen.getByRole("region", { name: "Large break spot value" })).toBeInTheDocument());
    expect(screen.getByText("Play Booster Box")).toBeInTheDocument();
    expect(screen.getByText("1 line · 1 opening")).toBeInTheDocument();

    // The color-slot choices are not silently discarded: they are named.
    const notice = screen.getByRole("status", { name: "Color-slot choices a large break does not use" });
    expect(notice).toHaveTextContent("the White, Blue slots you were considering");
    expect(notice).toHaveTextContent("the Red slot you marked taken");
    expect(notice).toHaveTextContent("Nothing was deleted");

    // Switching back restores every choice rather than resetting them.
    fireEvent.click(screen.getByRole("button", { name: "Color slots" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Remove Blue from the slots you’re considering" })).toHaveAttribute("aria-pressed", "true"));
    expect(screen.getByRole("button", { name: "Remove White from the slots you’re considering" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Restore Red slot" })).toBeInTheDocument();
    expect(screen.getByText("Play Booster Box")).toBeInTheDocument();
  });
});
