import { createElement, Fragment, useState } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BuyerView } from "./features/buyer/BuyerDetails";
import { SlotRail, useOutcomeSimulation } from "./features/buyer/BuyerVisuals";
import { createAuction } from "./domain/auction";
import { calculateBreak } from "./domain/valuation";
import type { AuctionState } from "./domain/auction";
import { DEFAULT_BUYER_COSTS } from "./domain/bid-ceiling";
import type { BuyerCosts } from "./domain/bid-ceiling";
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
  const [targetSlots, setTargetSlots] = useState<SlotId[]>([]);
  const activeTargets = targetSlots.filter((slot) => auction.remaining.includes(slot));
  const calculationSlots = activeTargets.length ? activeTargets : auction.remaining;
  const simulation = useOutcomeSimulation(analysis, calculationSlots, undefined);
  return createElement(Fragment, null,
    createElement(SlotRail, { result: valuation, auction, setAuction, targetSlots: activeTargets, setTargetSlots, distributions: simulation.result?.slotDistributions }),
    createElement(BuyerView, { analysis, auction, targetSlots: activeTargets, costs: DEFAULT_BUYER_COSTS, simulation }),
  );
}

describe("live random-slot buyer workflow", () => {
  it("prices the remaining pool with no bid to type in", async () => {
    render(createElement(Harness));

    expect(screen.getByRole("region", { name: "Bid decision" })).toHaveTextContent("8 slots left");
    expect(screen.getByText("DON’T BID OVER")).toBeInTheDocument();
    // A ten-second auction is no time to fill in a form: there is no bid or
    // shipping field here, and nothing to reconfirm.
    expect(screen.queryByLabelText("Current bid")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reconfirm current bid" })).not.toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Risk stance" })).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByLabelText("Highest bid to make")).not.toHaveTextContent("Checking…"));
    expect(screen.getByRole("region", { name: "Bid decision" })).toHaveTextContent("Bid basis: all 8 remaining slots; average EV $3.75 per spot");
  });

  it("takes a slot out of the pool inline, without a separate editing screen", async () => {
    render(createElement(Harness));
    await waitFor(() => expect(screen.getByLabelText("Highest bid to make")).not.toHaveTextContent("Checking…"));

    expect(screen.queryByRole("button", { name: "Edit availability" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Mark Blue taken by another buyer" }));
    expect(screen.getByRole("region", { name: "Bid decision" })).toHaveTextContent("7 slots left");
    expect(screen.getByRole("region", { name: "Bid decision" })).toHaveTextContent("average EV $1.43 per spot");
    expect(screen.queryByRole("button", { name: /mine/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Restore Blue" }));
    expect(screen.getByRole("region", { name: "Bid decision" })).toHaveTextContent("8 slots left");
    expect(screen.getByRole("region", { name: "Bid decision" })).toHaveTextContent("average EV $3.75 per spot");
  });

  it("bases the recommendation on only the selected available bid targets", async () => {
    render(createElement(Harness));
    await waitFor(() => expect(screen.getByLabelText("Highest bid to make")).not.toHaveTextContent("Checking…"));

    fireEvent.click(screen.getByRole("button", { name: "Select Blue for bid preview" }));
    expect(screen.getByRole("region", { name: "Bid decision" })).toHaveTextContent("average EV $20.00 per spot");
    expect(screen.getByRole("region", { name: "Bid decision" })).toHaveTextContent("the selected preview slots (Blue)");

    fireEvent.click(screen.getByRole("button", { name: "Select White for bid preview" }));
    expect(screen.getByRole("region", { name: "Bid decision" })).toHaveTextContent("average EV $15.00 per spot");
  });

  it("drops a selected preview as soon as another buyer takes that slot", async () => {
    render(createElement(Harness));
    await waitFor(() => expect(screen.getByLabelText("Highest bid to make")).not.toHaveTextContent("Checking…"));

    fireEvent.click(screen.getByRole("button", { name: "Select Blue for bid preview" }));
    expect(screen.getByRole("region", { name: "Bid decision" })).toHaveTextContent("average EV $20.00 per spot");
    fireEvent.click(screen.getByRole("button", { name: "Mark Blue taken by another buyer" }));

    expect(screen.getByRole("region", { name: "Bid decision" })).toHaveTextContent("7 slots left");
    expect(screen.getByRole("region", { name: "Bid decision" })).toHaveTextContent("average EV $1.43 per spot");
    expect(screen.getByRole("region", { name: "Bid decision" })).not.toHaveTextContent("Blue selected for bid preview");
  });

  it("keeps slot EV and preview controls while the bid limit stays in the top decision", async () => {
    render(createElement(Harness));
    await waitFor(() => expect(screen.getByLabelText("Highest bid to make")).not.toHaveTextContent("Checking…"));

    expect(screen.getByRole("region", { name: "Slot EV and preview" })).toBeInTheDocument();
    expect(screen.queryByText("Bid ceiling")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Select Blue for bid preview" })).toBeInTheDocument();
    expect(screen.getByLabelText(/^White: expected/)).toHaveAccessibleName(/expected \$10\.00/);
    expect(screen.getByLabelText(/^Blue: expected/)).toHaveAccessibleName(/expected \$20\.00/);

    fireEvent.click(screen.getByRole("button", { name: "Select Blue for bid preview" }));
    expect(screen.getByRole("region", { name: "Bid decision" })).toHaveTextContent("average EV $20.00 per spot");
  });

  it("removes the buyer's costs from the ceiling it recommends", async () => {
    // Only White and Blue hold value in this fixture, so a pool of those two
    // has a non-zero average EV to take costs out of.
    const free = render(createElement(PricedPool, { costs: DEFAULT_BUYER_COSTS }));
    await waitFor(() => expect(screen.getByLabelText("Highest bid to make")).toHaveTextContent("$15.00"));
    free.unmount();

    render(createElement(PricedPool, { costs: { ...DEFAULT_BUYER_COSTS, shipping: 4, taxPercent: 8 } }));
    // $15 average EV, less $4 shipping and 8% tax: $15/1.08 − $4.
    await waitFor(() => expect(screen.getByLabelText("Highest bid to make")).toHaveTextContent("$9.88"));
  });

  it("shows the bid verdict before the supporting break-value summary", () => {
    const { container } = render(createElement(Harness));
    const verdict = container.querySelector('[aria-label="Bid decision"]')!;
    const supporting = container.querySelector(".bid-explorer")!;

    expect(verdict.compareDocumentPosition(supporting) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // "Break evidence" is a real <details> disclosure now, not a bare section.
    expect(supporting.tagName).toBe("DETAILS");
  });
});

function PricedPool({ costs }: { costs: BuyerCosts }) {
  const [auction] = useState<AuctionState>(() => createAuction(["W", "U"]));
  const simulation = useOutcomeSimulation(analysis, auction.remaining, undefined);
  return createElement(BuyerView, { analysis, auction, costs, simulation });
}
