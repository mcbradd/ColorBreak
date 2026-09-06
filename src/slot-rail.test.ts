import { createElement, useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SlotRail } from "./features/buyer/BuyerVisuals";
import { createAuction } from "./domain/auction";
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
  const [selectedSlots, setSelectedSlots] = useState<SlotId[]>([]);
  const [auction, setAuction] = useState<AuctionState>(() => createAuction());
  return createElement(SlotRail, {
    result,
    auction,
    setAuction,
    selectedSlots,
    setSelectedSlots,
  });
}

describe("buyer color controls", () => {
  it("marks a slot the buyer already owns and takes it out of the remaining pool", () => {
    render(createElement(Harness));

    fireEvent.click(screen.getByRole("button", { name: "Mark Green as mine" }));

    expect(screen.getByRole("button", { name: "Green is mine — undo" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Mine")).toBeInTheDocument();
    // A slot the buyer owns is no longer available to another buyer, so the
    // taken control for that row is closed off rather than double-counting it.
    expect(screen.getByRole("button", { name: "Mark Green taken by another buyer" })).toBeDisabled();
  });

  it("marks several owned slots without leaving the screen", () => {
    render(createElement(Harness));

    fireEvent.click(screen.getByRole("button", { name: "Mark Green as mine" }));
    fireEvent.click(screen.getByRole("button", { name: "Mark Blue as mine" }));

    expect(screen.getByRole("button", { name: "Green is mine — undo" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Blue is mine — undo" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getAllByText("Mine")).toHaveLength(2);
  });

  it("marks one slot taken by another buyer from the same row, and restores it", () => {
    render(createElement(Harness));

    expect(screen.queryByText("Edit availability")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Mark Blue taken by another buyer" }));

    expect(screen.getByRole("button", { name: "Mark Blue as mine" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Restore Blue" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Taken")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Restore Blue" }));
    expect(screen.getByRole("button", { name: "Mark Blue as mine" })).toBeEnabled();
  });

  it("shows MIN, expected and MAX value for every slot", () => {
    const { container } = render(createElement(Harness));

    // The candle is the whole point of this rail: eight slots, eight candles,
    // each keeping numerical MIN/EV/MAX separate from probable-range geometry.
    expect(container.querySelectorAll(".slot-candle")).toHaveLength(8);
    expect(container.querySelectorAll(".slot-candle-values small")).toHaveLength(24);
  });

  it("scales the probable range independently of numerical MIN and MAX", () => {
    const summary: DistributionSummary = { min: 0, p01: 2, p10: 5, p25: 10, median: 20, mean: 20, p75: 30, p90: 40, p99: 50, max: 10000, fingerprint: [] };
    const distributions = Object.fromEntries(SLOT_IDS.map(id => [id, summary])) as Record<SlotId, DistributionSummary>;
    const { container } = render(createElement(SlotRail, { result, auction: createAuction(), setAuction: () => {}, selectedSlots: [], setSelectedSlots: () => {}, distributions }));
    expect(container.querySelector<HTMLElement>(".slot-candle-body")?.style.width).toBe("40%");
    expect(container.querySelector<HTMLElement>(".slot-candle-wick")?.style.left).toBe("4%");
    expect(container.querySelector(".slot-candle-values")?.textContent).toContain("MAX$10K");
  });

  it("keeps the rail free of mode buttons the buyer has to reason about", () => {
    render(createElement(Harness));

    expect(screen.queryByRole("button", { name: /Any remaining color/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /combined lot/ })).not.toBeInTheDocument();
  });
});
