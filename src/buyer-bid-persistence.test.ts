import { createElement } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { calculateBreak } from "./domain/valuation";
import type { BreakAnalysis } from "./data/evaluate";

const evaluateBreakAnalysis = vi.hoisted(() => vi.fn());
vi.mock("./data/evaluate", () => ({ evaluateBreakAnalysis }));
const productsForSet = vi.hoisted(() => vi.fn().mockResolvedValue([]));
vi.mock("./data/catalog", () => ({ catalogSets: [], productsForSet, readinessForProduct: vi.fn() }));

import { App, Workspace } from "./App";

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

describe("buyer bid persistence", () => {
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

  it("keeps bid and shipping values while the bulk setting recalculates results", async () => {
    render(createElement(Workspace, { mode: "buyer", exit: vi.fn() }));
    const bid = await screen.findByLabelText("Current bid");
    const shipping = screen.getByLabelText("Your added shipping");

    fireEvent.change(bid, { target: { value: "12.50" } });
    fireEvent.blur(bid);
    fireEvent.change(shipping, { target: { value: "4.25" } });
    fireEvent.blur(shipping);
    // Wait for the controlled inputs to commit before triggering the separate
    // bulk recalculation; otherwise a fast analysis response can race this
    // test's synthetic blur sequence on CI.
    await waitFor(() => expect(screen.getByLabelText("Current bid")).toHaveValue("12.5"));
    expect(screen.getByLabelText("Your added shipping")).toHaveValue("4.25");
    evaluateBreakAnalysis.mockClear();
    fireEvent.click(screen.getByRole("switch", { name: /Bulk filter/ }));

    await waitFor(() => expect(evaluateBreakAnalysis).toHaveBeenCalled());
    expect(await screen.findByLabelText("Current bid")).toHaveValue("12.5");
    expect(screen.getByLabelText("Your added shipping")).toHaveValue("4.25");
  });

  it("restores bid and shipping after a cold remount", async () => {
    const first = render(createElement(Workspace, { mode: "buyer", exit: vi.fn() }));
    fireEvent.change(await screen.findByLabelText("Current bid"), { target: { value: "12.50" } });
    fireEvent.blur(screen.getByLabelText("Current bid"));
    fireEvent.change(screen.getByLabelText("Your added shipping"), { target: { value: "4.25" } });
    fireEvent.blur(screen.getByLabelText("Your added shipping"));
    first.unmount();
    history.replaceState(null, "", "/#buyer");

    render(createElement(Workspace, { mode: "buyer", exit: vi.fn() }));
    expect(await screen.findByLabelText("Current bid")).toHaveValue("12.5");
    expect(screen.getByLabelText("Your added shipping")).toHaveValue("4.25");
  });

  it("restores a random pool only for the same saved composition", async () => {
    const first = render(createElement(Workspace, { mode: "buyer", exit: vi.fn() }));
    await screen.findByLabelText("Current bid");
    fireEvent.click(screen.getByRole("button", { name: "Random remaining" }));
    fireEvent.click(screen.getByRole("button", { name: "Edit availability" }));
    fireEvent.click(screen.getByRole("button", { name: "Mark Blue taken" }));
    fireEvent.change(screen.getByLabelText("Current bid"), { target: { value: "12.50" } });
    fireEvent.blur(screen.getByLabelText("Current bid"));
    fireEvent.change(screen.getByLabelText("Your added shipping"), { target: { value: "4.25" } });
    fireEvent.blur(screen.getByLabelText("Your added shipping"));
    first.unmount();

    render(createElement(Workspace, { mode: "buyer", exit: vi.fn() }));
    expect(await screen.findByRole("button", { name: "Random remaining" })).toHaveClass("active");
    fireEvent.click(screen.getByRole("button", { name: "Edit availability" }));
    expect(screen.getByRole("button", { name: "Restore Blue slot" })).toBeInTheDocument();
    expect(screen.getByLabelText("Current bid")).toHaveValue("12.5");
    expect(screen.getByLabelText("Your added shipping")).toHaveValue("4.25");
  });

  it("offers a shared break without carrying private bid or shipping into it", async () => {
    const first = render(createElement(Workspace, { mode: "buyer", exit: vi.fn() }));
    fireEvent.change(await screen.findByLabelText("Current bid"), { target: { value: "12.50" } });
    fireEvent.blur(screen.getByLabelText("Current bid"));
    fireEvent.change(screen.getByLabelText("Your added shipping"), { target: { value: "4.25" } });
    fireEvent.blur(screen.getByLabelText("Your added shipping"));
    first.unmount();

    history.replaceState(null, "", "/?b=TST.play-box.2&m=pick&s=W&r=WUBRGMCL&f=1&t=2#buyer");
    render(createElement(Workspace, { mode: "buyer", exit: vi.fn() }));
    expect(await screen.findByRole("button", { name: "Use this shared break" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Use this shared break" }));
    expect(screen.getByLabelText("Current bid")).toHaveValue("");
    expect(screen.getByLabelText("Your added shipping")).toHaveValue("");
  });

  it("starts with empty break contents when Bid Check is opened from the base page", async () => {
    history.replaceState(null, "", "/");
    render(createElement(App));

    fireEvent.click(screen.getByRole("button", { name: /Bid Check/ }));

    expect(await screen.findByRole("heading", { name: "Bid Check" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "0 lines · 0 openings" })).toBeInTheDocument();
    expect(screen.queryByText("Play Booster Box")).not.toBeInTheDocument();
  });

  it("offers an explicit one-tap resume for the last buyer setup", async () => {
    history.replaceState(null, "", "/");
    render(createElement(App));

    fireEvent.click(screen.getByRole("button", { name: /Resume 1 product/ }));

    expect(await screen.findByText("Play Booster Box")).toBeInTheDocument();
  });
});
