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
  outcomeModel: { cacheKey: "command-center", complete: true, packs: [], fixed: [{ id: "w", slot: "W", value: 20 }] },
  outcomeOmissions: [],
  priceAvailability: { status: "available", source: "test", message: "Test snapshot" },
};

const distribution = {
  min: 0, p01: 0, p10: 4, p25: 8, median: 12, mean: 14,
  p75: 18, p90: 24, p99: 30, max: 30, fingerprint: [],
};

describe("Bid Check command center", () => {
  beforeEach(() => {
    sessionStorage.setItem("colorbreak:buyer:draft:v1", JSON.stringify([{
      id: "line-1",
      set: "TST",
      productKey: "play-box",
      productLabel: "Play Booster Box",
      quantity: 1,
      tcgId: 1,
      marketCost: 100,
    }]));
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

  it("keeps the decision in one primary surface, with nothing to type into it", async () => {
    render(createElement(BuyerWorkspace, { exit: vi.fn(), startFresh: false, startReady: false }));

    const decision = await screen.findByRole("region", { name: "Bid decision" });
    expect(screen.getAllByRole("region", { name: "Bid decision" })).toHaveLength(1);
    // An auction gives about ten seconds. Nothing here asks the buyer to
    // enter a bid, a shipping figure, or a risk stance mid-auction.
    expect(screen.queryByLabelText("Current bid")).not.toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Risk stance" })).not.toBeInTheDocument();
    expect(within(decision).getByText("DON’T BID OVER")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByLabelText("Highest bid to make")).toHaveTextContent("$12.00"));
  });

  it("keeps break evidence — the only audit trail for the model — behind a real, keyboard-operable disclosure", async () => {
    render(createElement(BuyerWorkspace, { exit: vi.fn(), startFresh: false, startReady: false }));
    await screen.findByRole("region", { name: "Bid decision" });

    const summary = screen.getByText("Break evidence").closest("summary");
    expect(summary).not.toBeNull();
    const evidence = summary!.closest("details");
    expect(evidence).not.toBeNull();
    // Dense evidence stays collapsed until the buyer asks for it (CLAUDE.md),
    // but it must be reachable — a bare, unwired <header> that merely looked
    // clickable is the exact regression this guards against.
    expect(evidence).not.toHaveAttribute("open");

    fireEvent.click(summary!);

    expect(evidence).toHaveAttribute("open");
    await waitFor(() => expect(within(evidence as HTMLElement).getByText(/Data confidence/i)).toBeInTheDocument());
    expect(screen.queryByText("Chase Map")).not.toBeInTheDocument();
    // The candlesticks live on the slot rail now; repeating them down here
    // was the reason nobody found them in the first place.
    expect(screen.queryByText(/BREAK BALANCE/i)).not.toBeInTheDocument();
  });

  it("shows low, expected and high value on each slot, at the point of decision", async () => {
    render(createElement(BuyerWorkspace, { exit: vi.fn(), startFresh: false, startReady: false }));
    await screen.findByRole("region", { name: "Bid decision" });

    await waitFor(() => expect(document.querySelectorAll(".slot-candle")).toHaveLength(8));
    const white = screen.getByLabelText(/^White: low/);
    expect(white).toHaveAccessibleName(/low \$0\.00, expected \$20\.00, high \$30\.00/);
  });

  it("shows incomplete projections with the exact omission warning", async () => {
    const incompleteValuation = calculateBreak({
      prices: [{ id: "w", set: "TST", collectorNumber: "1", name: "White", slot: "W", nonfoil: 20, foil: null }],
      draws: [{ set: "TST", collectorNumber: "1", copies: 1, foil: false, source: "fixed" }],
      threshold: 2,
      omissions: [{ code: "missing-topper", message: "1× foil box topper has no verified card list.", material: true }],
    });
    evaluateBreakAnalysis.mockResolvedValue({
      ...analysis,
      valuation: incompleteValuation,
      outcomeModel: { ...analysis.outcomeModel, complete: false },
      outcomeOmissions: [{ code: "missing-topper", message: "1× foil box topper has no verified card list.", material: true }],
    });

    render(createElement(BuyerWorkspace, { exit: vi.fn(), startFresh: false, startReady: false }));

    const warningTitle = await screen.findByText("Some estimates may be low");
    expect(warningTitle.closest("details")).not.toHaveAttribute("open");
    expect(warningTitle.closest("summary")).toHaveTextContent("Some prices, pull chances, or pack contents could not be verified.");
    fireEvent.click(warningTitle.closest("summary")!);
    expect(screen.getByText(/The estimate still uses all verified information/)).toBeInTheDocument();
    const technicalSummary = screen.getByText("Technical details").closest("summary")!;
    expect(technicalSummary).toHaveTextContent("1 issue");
    expect(technicalSummary.closest("details")).not.toHaveAttribute("open");
    expect(screen.getAllByText("1× foil box topper has no verified card list.").length).toBeGreaterThan(0);
    await waitFor(() => expect(simulateOutcomesAsync).toHaveBeenCalled());
    expect(screen.getByText("LIMIT UNAVAILABLE")).toBeInTheDocument();
    // Materially incomplete evidence is a permanent, named block for this
    // calculation — never a stuck spinner.
    expect(screen.getByLabelText("Highest bid to make")).toHaveTextContent("—");
    expect(screen.getByLabelText("Highest bid to make")).not.toHaveTextContent("Checking…");
    expect(screen.getByRole("button", { name: "Choose a ready product" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Use manual budget cap" })).toBeInTheDocument();
  });

  it("takes the buyer's standing costs out of the ceiling", async () => {
    render(createElement(BuyerWorkspace, { exit: vi.fn(), startFresh: false, startReady: false }));
    await screen.findByRole("region", { name: "Bid decision" });
    await waitFor(() => expect(screen.getByLabelText("Highest bid to make")).toHaveTextContent("$12.00"));

    const summary = screen.getByText("Adjust assumptions");
    fireEvent.click(summary);
    summary.closest("details")!.open = true;
    fireEvent.change(screen.getByLabelText("Shipping"), { target: { value: "5" } });

    await waitFor(() => expect(screen.getByLabelText("Highest bid to make")).toHaveTextContent("$7.00"));
  });

  it("resolves a costs-exceed-value verdict to a named fact instead of a stuck spinner", async () => {
    render(createElement(BuyerWorkspace, { exit: vi.fn(), startFresh: false, startReady: false }));
    await screen.findByRole("region", { name: "Bid decision" });

    const summary = screen.getByText("Adjust assumptions");
    fireEvent.click(summary);
    summary.closest("details")!.open = true;
    fireEvent.change(screen.getByLabelText("Shipping"), { target: { value: "20" } });

    // Shipping alone ($20) exceeds the typical value ($12): a resolved fact,
    // not missing data, so it must never render as "Checking…".
    await waitFor(() => expect(screen.getByLabelText("Highest bid to make")).toHaveTextContent("$0.00"));
    expect(screen.getByLabelText("Highest bid to make")).not.toHaveTextContent("Checking…");
    expect(screen.getByText("DO NOT BID")).toBeInTheDocument();
    expect(screen.getByText(/already meet the typical card value/)).toBeInTheDocument();
  });

  it("names result navigation from the active assignment mode", async () => {
    render(createElement(BuyerWorkspace, { exit: vi.fn(), startFresh: false, startReady: false }));
    expect(await screen.findByLabelText("Break sections")).toBeInTheDocument();
    expect(screen.queryByLabelText("Large Break sections")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Large break" }));
    expect(screen.getByLabelText("Large Break sections")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Color slots" }));
    expect(screen.getByLabelText("Break sections")).toBeInTheDocument();
  });
});

