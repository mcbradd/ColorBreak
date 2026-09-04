import { createElement, useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SlotRail } from "./features/buyer/BuyerVisuals";
import { createAuction } from "./domain/auction";
import type { AuctionState } from "./domain/auction";
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

  it("shows a low, expected and high value for every slot", () => {
    const { container } = render(createElement(Harness));

    // The candle is the whole point of this rail: eight slots, eight candles,
    // each carrying its own low/EV/high in words as well as in geometry.
    expect(container.querySelectorAll(".slot-candle")).toHaveLength(8);
    expect(container.querySelectorAll(".slot-candle-values small")).toHaveLength(24);
  });

  it("keeps the rail free of mode buttons the buyer has to reason about", () => {
    render(createElement(Harness));

    expect(screen.queryByRole("button", { name: /Any remaining color/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /combined lot/ })).not.toBeInTheDocument();
  });
});
