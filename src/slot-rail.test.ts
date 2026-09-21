import { createElement, useState } from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SlotRail } from "./features/buyer/BuyerVisuals";
import { createAuction } from "./domain/auction";
import { calculateBreak } from "./domain/valuation";
import type { AuctionState } from "./domain/auction";
import { SLOT_IDS } from "./domain/types";
import type { DistributionSummary } from "./domain/simulation";
import type { SlotId, ValuationResult } from "./domain/types";

const result = {
  marketEV: 9,
  sellableEV: 9,
  knownEV: 9,
  threshold: 2,
  status: "verified",
  statusReason: "Complete",
  omissions: [],
  slots: ["W", "U", "B", "R", "G", "M", "C", "L"].map((id, index) => ({
    id,
    name: id,
    marketEV: index + 1,
    sellableEV: index + 1,
    knownEV: index + 1,
    contributors: [],
    chaseShare: 0,
    withoutChase: index + 1,
  })),
} as ValuationResult;

function Harness() {
  const [targetSlots, setTargetSlots] = useState<SlotId[]>([]);
  const [auction, setAuction] = useState<AuctionState>(() => createAuction());
  return createElement(SlotRail, {
    result,
    auction,
    setAuction,
    targetSlots,
    setTargetSlots,
  });
}

describe("buyer color controls", () => {
  it("shows each color symbol, card count, EV tile, selection check, and taken control", () => {
    const { container } = render(createElement(Harness));

    const rows = [...container.querySelectorAll<HTMLElement>(".buyer-slot-row")];
    expect(rows).toHaveLength(8);
    expect(rows.map((row) => row.querySelector(".buyer-slot-symbol")?.textContent)).toEqual([...SLOT_IDS]);
    expect(rows.every((row) => row.querySelector(".buyer-slot-member-count b")?.textContent === "0")).toBe(true);
    expect(rows.every((row) => row.querySelector(".buyer-slot-member-count svg.lucide-credit-card"))).toBe(true);
    expect(rows.every((row) => row.querySelector(".buyer-slot-ev strong")?.textContent)).toBe(true);
    expect(rows.every((row) => row.querySelector(".slot-target-btn svg.lucide-check"))).toBe(true);
    expect(rows.every((row) => row.querySelector(".slot-disable-btn svg.lucide-ban"))).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "Select White for bid preview" }));
    expect(screen.getByRole("button", { name: "Remove White from bid preview" })).toHaveAttribute("aria-pressed", "true");
  });

  it("opens a team's price-ranked members and returns from a card to its thumbnail", async () => {
    const memberResult = calculateBreak({
      threshold: 0,
      prices: [
        { id: "small", name: "Small Dragon", set: "TST", collectorNumber: "1", slot: "R", nonfoil: 5, foil: null },
        { id: "big", name: "Big Dragon", set: "TST", collectorNumber: "2", slot: "R", nonfoil: 50, foil: null },
      ],
      draws: [1, 2].map(number => ({ set: "TST", collectorNumber: String(number), copies: 1, foil: false, source: "fixed" })),
    });
    render(createElement(SlotRail, { result: memberResult, auction: createAuction(), setAuction: () => {} }));
    fireEvent.click(screen.getByRole("button", { name: "Show cards in Red team" }));
    const members = screen.getByRole("table", { name: "Cards in Red team" });
    expect(within(members).getAllByRole("row")[1]).toHaveTextContent("Big Dragon");
    expect(screen.getByRole("button", { name: "Select Red for bid preview" })).toHaveAttribute("aria-pressed", "false");
    const thumbnail = within(members).getByRole("button", { name: "Open Big Dragon card details" });
    screen.getByRole("button", { name: "Select Red for bid preview" }).focus();
    fireEvent.click(thumbnail);
    expect(screen.getByRole("dialog", { name: "Big Dragon" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Close card details" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(thumbnail).toHaveFocus();
    fireEvent.click(screen.getByRole("button", { name: "Show cards in Blue team" }));
    expect(screen.queryByRole("table", { name: "Cards in Red team" })).not.toBeInTheDocument();
  });

  it("models slots as taken or selected for preview, with no ownership state", () => {
    render(createElement(Harness));

    expect(screen.queryByText("Mine")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /mine/i })).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /Select .* for bid preview/ })).toHaveLength(8);
  });

  it("marks one slot taken by another buyer from the same row, and restores it", () => {
    render(createElement(Harness));

    expect(screen.queryByText("Edit availability")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Mark Blue taken by another buyer" }));

    expect(screen.queryByRole("button", { name: /mine/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Select Blue for bid preview" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Restore Blue" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getAllByText("Taken").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: "Restore Blue" }));
    expect(screen.getByRole("button", { name: "Select Blue for bid preview" })).toBeEnabled();
  });

  it("shows EV and MAX without a redundant zero minimum for every slot", () => {
    const { container } = render(createElement(Harness));

    // The candle is the whole point of this rail: eight slots, eight candles,
    // each keeping EV/MAX separate from probable-range geometry.
    expect(container.querySelectorAll(".slot-candle")).toHaveLength(8);
    expect(container.querySelectorAll(".slot-candle-values small")).toHaveLength(16);
    expect([...container.querySelectorAll(".slot-candle-values small")].map((label) => label.textContent)).not.toContain("MIN");
  });

  it("scales the probable range independently of numerical MIN and MAX", () => {
    const summary: DistributionSummary = { min: 0, p01: 2, p10: 5, p25: 10, median: 20, mean: 20, p75: 30, p90: 40, p99: 50, max: 10000, fingerprint: [] };
    const distributions = Object.fromEntries(SLOT_IDS.map(id => [id, summary])) as Record<SlotId, DistributionSummary>;
    const { container } = render(createElement(SlotRail, { result, auction: createAuction(), setAuction: () => {}, distributions }));
    expect(container.querySelector<HTMLElement>(".slot-candle-body")?.style.width).toBe("40%");
    expect(container.querySelector<HTMLElement>(".slot-candle-wick")?.style.left).toBe("4%");
    expect(container.querySelector(".slot-candle-values")?.textContent).toMatch(/MAX\$10(?:\.0)?K/);
  });

  it("keeps the rail free of mode buttons the buyer has to reason about", () => {
    render(createElement(Harness));

    expect(screen.queryByRole("button", { name: /Any remaining color/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /combined lot/ })).not.toBeInTheDocument();
  });
});

it("places one shared estimate note in the slot header, away from ownership buttons", () => {
  const { container } = render(createElement(Harness));
  expect(container.querySelectorAll(".buyer-slot-control .answer-note")).toHaveLength(1);
  expect(container.querySelector(".buyer-slot-control .step-heading .answer-note")).not.toBeNull();
  expect(container.querySelectorAll(".buyer-slot-row .answer-note")).toHaveLength(0);
});
