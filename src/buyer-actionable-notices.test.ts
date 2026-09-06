import { createElement } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BuyerView, ContributorRows, type PriceRefreshState } from "./features/buyer/BuyerDetails";
import { useOutcomeSimulation } from "./features/buyer/BuyerVisuals";
import { createAuction } from "./domain/auction";
import { calculateBreak } from "./domain/valuation";
import { DEFAULT_BUYER_COSTS } from "./domain/bid-ceiling";
import type { BreakAnalysis } from "./data/evaluate";
import type { DecisionEligibility, SlotValuation } from "./domain/types";

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
  outcomeModel: { complete: true, packs: [], fixed: [{ id: "w", slot: "W", value: 10 }] },
  outcomeOmissions: [],
};

const staleEligibility: DecisionEligibility = {
  status: "stale",
  blockerCount: 1,
  affectedGroups: [],
  observedAt: new Date(Date.now() - 9 * 60 * 60 * 1000).toISOString(),
  ageMs: 9 * 60 * 60 * 1000,
  freshnessThresholdMs: 6 * 60 * 60 * 1000,
  resolvedOnlyAvailable: true,
  reason: "stale-price-snapshot",
};

function Decision({
  eligibility,
  priceRefresh = "idle",
  onRefreshPrices,
}: {
  eligibility?: DecisionEligibility;
  priceRefresh?: PriceRefreshState;
  onRefreshPrices?: () => void;
}) {
  const auction = createAuction();
  const simulation = useOutcomeSimulation(analysis, auction.remaining, undefined);
  return createElement(BuyerView, {
    analysis,
    eligibility,
    auction,
    selectedSlots: [],
    costs: DEFAULT_BUYER_COSTS,
    simulation,
    priceRefresh,
    onRefreshPrices,
  });
}

describe("stale prices are an action, not an announcement", () => {
  it("offers a refresh control instead of a read-only age notice", async () => {
    const refresh = vi.fn();
    render(createElement(Decision, { eligibility: staleEligibility, onRefreshPrices: refresh }));

    const control = await screen.findByRole("button", { name: /Prices over 6 hours old/ });
    fireEvent.click(control);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("reports each phase, then the real answer, in the picker's own words", async () => {
    const { rerender } = render(createElement(Decision, {
      eligibility: staleEligibility, onRefreshPrices: () => {}, priceRefresh: "searching",
    }));
    expect(await screen.findByRole("button", { name: /Searching/ })).toBeDisabled();

    rerender(createElement(Decision, {
      eligibility: staleEligibility, onRefreshPrices: () => {}, priceRefresh: "updating",
    }));
    expect(screen.getByRole("button", { name: /Updating/ })).toHaveAttribute("aria-busy", "true");

    // Nothing newer exists is an answer, not a silence.
    rerender(createElement(Decision, {
      eligibility: staleEligibility, onRefreshPrices: () => {}, priceRefresh: "stale",
    }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("No newer prices are published yet"));
    expect(screen.getByRole("button", { name: /No newer data/ })).toBeEnabled();

    // A refused refresh keeps the estimate and offers the retry.
    rerender(createElement(Decision, {
      eligibility: staleEligibility, onRefreshPrices: () => {}, priceRefresh: "error",
    }));
    expect(screen.getByRole("status")).toHaveTextContent("keeps the prices it already had");
    expect(screen.getByRole("button", { name: /Retry/ })).toBeEnabled();
  });

  it("keeps the control visible after a refresh makes the estimate fresh", async () => {
    // The answer to "did that work?" must outlive the condition that prompted
    // it; swapping straight back to a plain label loses the result.
    render(createElement(Decision, { onRefreshPrices: () => {}, priceRefresh: "updated" }));
    expect(await screen.findByRole("button", { name: /Updated/ })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Newer prices are in this estimate");
  });

  it("keeps a plain label when the estimate is fresh", async () => {
    render(createElement(Decision, { onRefreshPrices: () => {} }));
    await waitFor(() => expect(screen.getByRole("region", { name: "Bid decision" })).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: /Prices over 6 hours old/ })).not.toBeInTheDocument();
  });
});

describe("ranked card column help", () => {
  const slot = {
    ...valuation.slots.find((row) => row.id === "W")!,
  } as SlotValuation;

  it("explains each column as its own paragraph, with the term set apart", () => {
    render(createElement(ContributorRows, { slot, onInspect: () => {} }));

    fireEvent.click(screen.getByRole("button", { name: "What Chance and Adds mean" }));
    const paragraphs = screen.getByRole("tooltip").querySelectorAll(".tip-paragraph");

    expect(paragraphs).toHaveLength(2);
    expect(paragraphs[0].querySelector("b")).toHaveTextContent("Chance");
    expect(paragraphs[1].querySelector("b")).toHaveTextContent("Adds");
    expect(paragraphs[1]).toHaveTextContent("average number of copies opened");
  });

  it("gives every ranked row a chance cell and an adds cell", () => {
    const { container } = render(createElement(ContributorRows, { slot, onInspect: () => {} }));
    const row = container.querySelector(".contributor-card")!;

    // Four cells, in the order the four column headers name them. A row with
    // fewer wraps its last cell onto its own line and reads as an empty
    // Chance column.
    expect(row.children).toHaveLength(4);
    expect(row.querySelector(".pull-odds")).not.toBeEmptyDOMElement();
    expect(row.querySelector(".ev-contribution")).not.toBeEmptyDOMElement();
  });
});
