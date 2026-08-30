import { createElement, useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SlotRail } from "./App";
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
    expect(screen.getByText("Green selected")).toBeInTheDocument();
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
});
