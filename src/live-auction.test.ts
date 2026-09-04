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
  const [selectedSlots, setSelectedSlots] = useState<SlotId[]>([]);
  const simulation = useOutcomeSimulation(analysis, auction.remaining, undefined);
  return createElement(Fragment, null,
    createElement(SlotRail, { result: valuation, auction, setAuction, selectedSlots, setSelectedSlots, distributions: simulation.result?.slotDistributions }),
    createElement(BuyerView, { analysis, auction, selectedSlots, costs: DEFAULT_BUYER_COSTS, simulation }),
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
  });

  it("takes a slot out of the pool inline, without a separate editing screen", async () => {
    render(createElement(Harness));
    await waitFor(() => expect(screen.getByLabelText("Highest bid to make")).not.toHaveTextContent("Checking…"));

    expect(screen.queryByRole("button", { name: "Edit availability" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Mark Blue taken by another buyer" }));
    expect(screen.getByRole("region", { name: "Bid decision" })).toHaveTextContent("7 slots left");
    expect(screen.getByRole("button", { name: "Mark Blue as mine" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Restore Blue" }));
    expect(screen.getByRole("region", { name: "Bid decision" })).toHaveTextContent("8 slots left");
  });

  it("reports the value of the slots the buyer already owns", async () => {
    render(createElement(Harness));
    await waitFor(() => expect(screen.getByLabelText("Highest bid to make")).not.toHaveTextContent("Checking…"));

    fireEvent.click(screen.getByRole("button", { name: "Mark Blue as mine" }));

    const owned = document.querySelector(".owned-slot-value")!;
    expect(owned).toHaveTextContent("My slot: Blue");
    expect(owned).toHaveTextContent("$20.00");
    // An owned slot leaves the pool the next bid draws from.
    expect(screen.getByRole("region", { name: "Bid decision" })).toHaveTextContent("7 slots left");
  });

  it("removes the buyer's costs from the ceiling it recommends", async () => {
    // Only White and Blue hold value in this fixture, so a pool of those two
    // has a non-zero typical value to take costs out of.
    const free = render(createElement(PricedPool, { costs: DEFAULT_BUYER_COSTS }));
    await waitFor(() => expect(screen.getByLabelText("Highest bid to make")).toHaveTextContent("$10.00"));
    free.unmount();

    render(createElement(PricedPool, { costs: { ...DEFAULT_BUYER_COSTS, shipping: 4, taxPercent: 8 } }));
    // $10 typical − $4 shipping, with 8% tax on the rest: $10/1.08 − $4.
    await waitFor(() => expect(screen.getByLabelText("Highest bid to make")).toHaveTextContent("$5.25"));
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
  return createElement(BuyerView, { analysis, auction, selectedSlots: [], costs, simulation });
}
