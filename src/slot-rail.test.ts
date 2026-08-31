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
  const [selected, setSelected] = useState<SlotId>("W");
  const [auction, setAuction] = useState<AuctionState>(() => createAuction());
  const [assignmentMode, setAssignmentMode] = useState<"pick" | "random">("pick");
  return createElement(SlotRail, {
    result,
    auction,
    setAuction,
    assignmentMode,
    setAssignmentMode,
    selected,
    setSelected,
  });
}

describe("buyer color controls", () => {
  it("selects a color for pick mode", () => {
    render(createElement(Harness));

    fireEvent.click(screen.getByRole("button", { name: "Green slot" }));

    expect(screen.getByRole("button", { name: "Pick a color" })).toHaveClass("active");
    expect(screen.getByText("Selected: Green")).toBeInTheDocument();
  });

  it("changes availability only in the separate deliberate editing mode", () => {
    render(createElement(Harness));

    expect(screen.queryByRole("button", { name: "Mark Blue taken" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Edit availability" }));
    fireEvent.click(screen.getByRole("button", { name: "Mark Blue taken" }));
    expect(screen.getByRole("button", { name: "Random remaining" })).toHaveClass("active");
    expect(screen.getByRole("button", { name: "Blue slot" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Restore Blue slot" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("7 colors remain in the random pool")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Restore Blue slot" }));
    expect(screen.getByRole("button", { name: "Blue slot" })).toBeEnabled();
    expect(screen.getByText("8 colors remain in the random pool")).toBeInTheDocument();
  });

  it("tapping a color swatch in random remaining mode marks it taken, matching the mode's own copy", () => {
    render(createElement(Harness));

    fireEvent.click(screen.getByRole("button", { name: "Random remaining" }));
    expect(screen.getByText("Mark colors already taken")).toBeInTheDocument();
    expect(screen.getByText("8 colors remain in the random pool")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Blue slot" }));

    // The heading says "Mark colors already taken" — a tap must mark the
    // color taken from the random pool, not silently flip the toggle back
    // to Pick a color (the bug this test guards against).
    expect(screen.getByRole("button", { name: "Random remaining" })).toHaveClass("active");
    expect(screen.getByRole("button", { name: "Pick a color" })).not.toHaveClass("active");
    expect(screen.getByRole("button", { name: "Blue slot" })).toBeDisabled();
    expect(screen.getByText("7 colors remain in the random pool")).toBeInTheDocument();
  });
});

