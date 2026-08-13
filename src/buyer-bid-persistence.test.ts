import { createElement } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { calculateBreak } from "./domain/valuation";
import type { BreakAnalysis } from "./data/evaluate";

const evaluateBreakAnalysis = vi.hoisted(() => vi.fn());
vi.mock("./data/evaluate", () => ({ evaluateBreakAnalysis }));

import { Workspace } from "./App";

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
    localStorage.setItem("colorbreak:buyer:lines", JSON.stringify([{
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
    localStorage.clear();
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

    render(createElement(Workspace, { mode: "buyer", exit: vi.fn() }));
    expect(await screen.findByLabelText("Current bid")).toHaveValue("12.5");
    expect(screen.getByLabelText("Your added shipping")).toHaveValue("4.25");
  });
});
