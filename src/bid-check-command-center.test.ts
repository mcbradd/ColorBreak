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

import { Workspace } from "./App";

const valuation = calculateBreak({
  prices: [{ id: "w", set: "TST", collectorNumber: "1", name: "White", slot: "W", nonfoil: 20, foil: null }],
  draws: [{ set: "TST", collectorNumber: "1", copies: 1, foil: false, source: "fixed" }],
  threshold: 2,
});

const analysis: BreakAnalysis = {
  valuation,
  outcomeModel: { cacheKey: "command-center", complete: true, packs: [], fixed: [{ id: "w", slot: "W", value: 20 }] },
  outcomeOmissions: [],
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
    sessionStorage.setItem("colorbreak:buyer:bid", "9");
    sessionStorage.setItem("colorbreak:buyer:shipping", "3");
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

  it("keeps the live decision and its controls in one primary surface", async () => {
    render(createElement(Workspace, { mode: "buyer", exit: vi.fn() }));

    const decision = await screen.findByRole("region", { name: "Live bid decision" });
    expect(within(decision).getByLabelText("Current bid")).toHaveValue("9");
    expect(within(decision).getByLabelText("Your added shipping")).toHaveValue("3");
    expect(within(decision).getByRole("group", { name: "Risk stance" })).toBeInTheDocument();
    expect(within(decision).getByText("Your max hammer")).toBeInTheDocument();
    expect(screen.queryByText("V2 RESEARCH PREVIEW")).not.toBeInTheDocument();
  });

  it("keeps supporting analysis immediately available without a disclosure", async () => {
    render(createElement(Workspace, { mode: "buyer", exit: vi.fn() }));
    await screen.findByRole("region", { name: "Live bid decision" });

    const evidence = screen.getByText("Decision evidence").closest("section");
    expect(evidence).not.toBeNull();
    await waitFor(() => expect(within(evidence as HTMLElement).getByText(/Break Balance/)).toBeInTheDocument());
    expect(screen.queryByText("Chase Map")).not.toBeInTheDocument();
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

    render(createElement(Workspace, { mode: "buyer", exit: vi.fn() }));

    const warningTitle = await screen.findByText("Some estimates may be low");
    expect(warningTitle.closest("details")).not.toHaveAttribute("open");
    expect(warningTitle.closest("summary")).toHaveTextContent("Some prices, pull chances, or pack contents could not be verified.");
    fireEvent.click(warningTitle.closest("summary")!);
    expect(screen.getByText(/The estimate still uses all verified information/)).toBeInTheDocument();
    const technicalSummary = screen.getByText("Technical details").closest("summary")!;
    expect(technicalSummary).toHaveTextContent("1 issue");
    expect(technicalSummary.closest("details")).not.toHaveAttribute("open");
    expect(screen.getAllByText("1× foil box topper has no verified card list.").length).toBeGreaterThan(0);
    expect(screen.queryByText(/Expected impact:/)).not.toBeInTheDocument();
    await waitFor(() => expect(simulateOutcomesAsync).toHaveBeenCalled());
    expect(screen.getByText(/LIMIT UNAVAILABLE/)).toBeInTheDocument();
    expect(screen.getByLabelText("Maximum hammer")).toHaveTextContent("—");
  });

  it("links missing buyer information to the exact fields", async () => {
    sessionStorage.removeItem("colorbreak:buyer:bid");
    sessionStorage.removeItem("colorbreak:buyer:shipping");
    render(createElement(Workspace, { mode: "buyer", exit: vi.fn() }));

    const bidLink = await screen.findByRole("link", { name: "Enter the current auction price" });
    expect(bidLink).toHaveAttribute("href", "#buyer-current-bid");
    expect(screen.getByLabelText("Current bid")).toHaveAttribute("id", "buyer-current-bid");
  });
});
