import { createElement, useState } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BuyerView } from "./App";
import { createAuction } from "./domain/auction";
import { calculateBreak } from "./domain/valuation";
import type { AuctionState } from "./domain/auction";
import type { BreakAnalysis } from "./data/evaluate";
import type { SlotId } from "./domain/types";

const valuation = calculateBreak({
  prices: [
    { id: "w", set: "TST", collectorNumber: "1", name: "White", slot: "W", nonfoil: 10, foil: null },
    { id: "u", set: "TST", collectorNumber: "2", name: "Blue", slot: "U", nonfoil: 20, foil: null },
  ],
  draws: [
    { set: "TST", collectorNumber: "1", copies: 1, foil: false, source: "fixed" },
    { set: "TST", collectorNumber: "2", copies: 1, foil: false, source: "fixed" },
  ],
  threshold: 2,
});

const analysis: BreakAnalysis = {
  valuation,
  outcomeModel: {
    complete: true,
    packs: [],
    fixed: [
      { id: "w", slot: "W", value: 10 },
      { id: "u", slot: "U", value: 20 },
    ],
  },
  outcomeOmissions: [],
};

function Harness() {
  const [auction, setAuction] = useState<AuctionState>(() => createAuction());
  const [selected, setSelected] = useState<SlotId>("W");
  return createElement(BuyerView, { analysis, auction, setAuction, selected, setSelected });
}

describe("live random-slot buyer workflow", () => {
  it("removes the revealed slot in one tap and restores it with undo", async () => {
    render(createElement(Harness));
    fireEvent.click(screen.getByRole("button", { name: "Random remaining slot" }));
    expect(screen.getByText("8 RANDOM SLOTS REMAIN")).toBeInTheDocument();
    expect(screen.getByText("ENTER BID")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByLabelText("Possible opening values")).toBeInTheDocument());
    expect(screen.queryByLabelText("Twenty equal-probability modeled outcome bands")).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Current bid"), { target: { value: "12.50" } });
    fireEvent.blur(screen.getByLabelText("Current bid"));
    await waitFor(() => expect(screen.getByText(/Chance card value covers your \$12\.50 cost/)).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Mark Blue assigned" }));
    expect(screen.getByText("7 RANDOM SLOTS REMAIN")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mark Blue assigned" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(screen.getByText("8 RANDOM SLOTS REMAIN")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByLabelText("Possible opening values")).toBeInTheDocument());
  });

  it("switches every buyer view to the chosen color", async () => {
    render(createElement(Harness));
    fireEvent.click(screen.getByRole("tab", { name: "Green slot" }));
    expect(screen.getByRole("button", { name: "I pick my color" })).toHaveClass("active");
    expect(screen.getByText("GREEN SLOT")).toBeInTheDocument();
    expect(screen.getByText("GREEN VALUE DETAILS")).toBeInTheDocument();
  });
});
