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

    // Nothing is in the break yet, and the page says so by showing an Add
    // products button rather than a count of zero.
    expect(screen.getByRole("combobox", { name: "Find a set or product" })).toBeInTheDocument();
    const formats = screen.getByRole("group", { name: "Break format" });
    expect(within(formats).getByRole("button", { name: "Standard (8 Slots)" })).toHaveAttribute("aria-pressed", "true");
    expect(within(formats).getByRole("button", { name: "Custom" })).toBeInTheDocument();
    const toolbar = formats.parentElement!;
    expect(within(toolbar).getByRole("button", { name: "Adjust assumptions" })).toBeInTheDocument();
    expect(within(toolbar).getByRole("switch", { name: "Bulk filter" })).toBeInTheDocument();
    expect(screen.queryByText("Add a product in Break to see your bid decision.")).toBeNull();
  });

  it("switches to a large break with no product in the break", () => {
    render(createElement(BuyerWorkspace, { exit: vi.fn(), startFresh: true, startReady: false }));

    fireEvent.click(screen.getByRole("button", { name: "Custom" }));

    expect(screen.getByRole("heading", { name: "Custom" })).toBeInTheDocument();
    expect(screen.getByLabelText("Custom entry count")).toHaveValue("120");
    expect(screen.getByRole("button", { name: "Custom" })).toHaveAttribute("aria-pressed", "true");
  });

  it("keeps the standard color path one tap away and free of extra steps", () => {
    render(createElement(BuyerWorkspace, { exit: vi.fn(), startFresh: true, startReady: false }));

    fireEvent.click(screen.getByRole("button", { name: "Custom" }));
    fireEvent.click(screen.getByRole("button", { name: "Standard (8 Slots)" }));

    expect(screen.getByRole("heading", { name: "Check a bid" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Custom entry count")).toBeNull();
  });

  it("keeps taken slots and bid previews across a format change", async () => {
    sessionStorage.setItem("colorbreak:buyer:draft:v1", JSON.stringify([savedLine]));
    render(createElement(BuyerWorkspace, { exit: vi.fn(), startFresh: false, startReady: false }));

    await screen.findByRole("region", { name: "Bid decision" });
    fireEvent.click(screen.getByRole("button", { name: "Select White for bid preview" }));
    fireEvent.click(screen.getByRole("button", { name: "Select Blue for bid preview" }));
    fireEvent.click(screen.getByRole("button", { name: "Mark Red taken by another buyer" }));

    fireEvent.click(screen.getByRole("button", { name: "Custom" }));

    // The break itself survives the format change untouched.
    await waitFor(() => expect(screen.getByRole("region", { name: "Large break spot value" })).toBeInTheDocument());
    expect(screen.getByText("Play Booster Box")).toBeInTheDocument();

    // The color-slot choices are not silently discarded: they are named.
    const notice = screen.getByRole("status", { name: "Color-slot choices a large break does not use" });
    expect(notice).toHaveTextContent("the White, Blue slots selected for bid preview");
    expect(notice).toHaveTextContent("the Red slot you marked taken");

    // Switching back restores every choice rather than resetting them.
    fireEvent.click(screen.getByRole("button", { name: "Standard (8 Slots)" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Remove Blue from bid preview" })).toHaveAttribute("aria-pressed", "true"));
    expect(screen.getByRole("button", { name: "Remove White from bid preview" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Restore Red" })).toBeInTheDocument();
    expect(screen.getByText("Play Booster Box")).toBeInTheDocument();
  });
});
