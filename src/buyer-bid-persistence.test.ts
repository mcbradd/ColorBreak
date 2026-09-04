import { createElement } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { calculateBreak } from "./domain/valuation";
import type { BreakAnalysis } from "./data/evaluate";

const evaluateBreakAnalysis = vi.hoisted(() => vi.fn());
vi.mock("./data/evaluate", () => ({ evaluateBreakAnalysis }));
const productsForSet = vi.hoisted(() => vi.fn().mockResolvedValue([]));
vi.mock("./data/catalog", () => ({ catalogSets: [], productsForSet, readinessForProduct: vi.fn() }));

import { App } from "./App";
import { BuyerWorkspace } from "./features/buyer/BuyerWorkspace";

const valuation = calculateBreak({
  prices: [{ id: "w", set: "TST", collectorNumber: "1", name: "White", slot: "W", nonfoil: 20, foil: null }],
  draws: [{ set: "TST", collectorNumber: "1", copies: 1, foil: false, source: "fixed" }],
  threshold: 2,
});

const analysis: BreakAnalysis = {
  valuation,
  outcomeModel: { complete: true, packs: [], fixed: [{ id: "w", slot: "W", value: 20 }] },
  outcomeOmissions: [],
};

describe("buyer assumption persistence", () => {
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
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
    sessionStorage.clear();
    evaluateBreakAnalysis.mockReset();
  });

  const openAssumptions = async () => {
    const summary = await screen.findByText("Adjust assumptions");
    fireEvent.click(summary);
    summary.closest("details")!.open = true;
  };

  it("keeps the buyer's costs while the bulk setting recalculates results", async () => {
    render(createElement(BuyerWorkspace, { exit: vi.fn(), startFresh: false, startReady: false }));
    await openAssumptions();

    const shipping = screen.getByLabelText("Shipping");
    fireEvent.change(shipping, { target: { value: "4.25" } });
    fireEvent.blur(shipping);
    await waitFor(() => expect(screen.getByLabelText("Shipping")).toHaveValue("4.25"));

    evaluateBreakAnalysis.mockClear();
    fireEvent.click(screen.getByRole("switch", { name: /Bulk filter/ }));

    await waitFor(() => expect(evaluateBreakAnalysis).toHaveBeenCalled());
    expect(screen.getByLabelText("Shipping")).toHaveValue("4.25");
  });

  it("restores the buyer's costs after a cold remount", async () => {
    const first = render(createElement(BuyerWorkspace, { exit: vi.fn(), startFresh: false, startReady: false }));
    await openAssumptions();
    fireEvent.change(screen.getByLabelText("Shipping"), { target: { value: "4.25" } });
    fireEvent.blur(screen.getByLabelText("Shipping"));
    fireEvent.change(screen.getByLabelText("Tax"), { target: { value: "8" } });
    fireEvent.blur(screen.getByLabelText("Tax"));
    await waitFor(() => expect(screen.getByLabelText("Tax")).toHaveValue("8"));
    first.unmount();
    history.replaceState(null, "", "/#buyer");

    render(createElement(BuyerWorkspace, { exit: vi.fn(), startFresh: false, startReady: false }));
    await openAssumptions();
    // A buyer sets these once and expects them to still be there.
    expect(screen.getByLabelText("Shipping")).toHaveValue("4.25");
    expect(screen.getByLabelText("Tax")).toHaveValue("8");
  });

  it("restores the remaining pool only for the same saved composition", async () => {
    const first = render(createElement(BuyerWorkspace, { exit: vi.fn(), startFresh: false, startReady: false }));
    fireEvent.click(await screen.findByRole("button", { name: "Mark Blue taken by another buyer" }));
    first.unmount();

    render(createElement(BuyerWorkspace, { exit: vi.fn(), startFresh: false, startReady: false }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Restore Blue" })).toBeInTheDocument());
  });

  it("opens the front page from the base URL so both jobs are visible", async () => {
    history.replaceState(null, "", "/");
    render(createElement(App));

    expect(await screen.findByRole("button", { name: /Buyer/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Seller/ })).toBeInTheDocument();
    expect(screen.queryByText("Play Booster Box")).not.toBeInTheDocument();
  });

  it("starts a new decision instead of silently resuming a prior buyer setup", async () => {
    history.replaceState(null, "", "/#buyer");
    render(createElement(App));

    expect(await screen.findByRole("heading", { name: "Check a bid" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Add products/ })).toBeInTheDocument();
    expect(screen.queryByText("Play Booster Box")).not.toBeInTheDocument();
  });
});
