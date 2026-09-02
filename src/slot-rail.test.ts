import { createElement, useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SlotRail } from "./features/buyer/BuyerVisuals";
import { createAuction } from "./domain/auction";
import type { AuctionState } from "./domain/auction";
import type { AssignmentMode } from "./domain/share-url";
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
  const [assignmentMode, setAssignmentMode] = useState<AssignmentMode>("pick");
  return createElement(SlotRail, {
    result,
    auction,
    setAuction,
    assignmentMode,
    setAssignmentMode,
    selectedSlots,
    setSelectedSlots,
  });
}

describe("buyer color controls", () => {
  it("selects a single slot with the checkmark control", () => {
    render(createElement(Harness));

    fireEvent.click(screen.getByRole("button", { name: "Add Green to the slots you’re considering" }));

    expect(screen.getByText("Green selected")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove Green from the slots you’re considering" })).toHaveAttribute("aria-pressed", "true");
  });

  it("selects multiple slots without leaving the screen or switching modes", () => {
    render(createElement(Harness));

    fireEvent.click(screen.getByRole("button", { name: "Add Green to the slots you’re considering" }));
    fireEvent.click(screen.getByRole("button", { name: "Add Blue to the slots you’re considering" }));

    expect(screen.getByText("2 colors selected: Green, Blue")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove Green from the slots you’re considering" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Remove Blue from the slots you’re considering" })).toHaveAttribute("aria-pressed", "true");
  });

  it("marks one slot taken immediately from the same row, no separate editing screen", () => {
    render(createElement(Harness));

    expect(screen.queryByText("Edit availability")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Mark Blue taken" }));

    expect(screen.getByRole("button", { name: "Add Blue to the slots you’re considering" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Restore Blue slot" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Taken")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Restore Blue slot" }));
    expect(screen.getByRole("button", { name: "Add Blue to the slots you’re considering" })).toBeEnabled();
  });

  it("drops a slot from consideration the moment it is marked taken", () => {
    render(createElement(Harness));

    fireEvent.click(screen.getByRole("button", { name: "Add Blue to the slots you’re considering" }));
    expect(screen.getByText("Blue selected")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Mark Blue taken" }));
    expect(screen.getByText("No slot selected · choose a color to continue")).toBeInTheDocument();
  });

  it("marks a combined lot of several slots taken as one atomic unit", () => {
    render(createElement(Harness));

    fireEvent.click(screen.getByRole("button", { name: "Mark several as one combined lot…" }));
    fireEvent.click(screen.getByRole("button", { name: "Add Colorless to the combined taken group" }));
    fireEvent.click(screen.getByRole("button", { name: "Add Lands to the combined taken group" }));
    expect(screen.getByText("2 slots staged")).toBeInTheDocument();

    // Neither slot is actually taken until the combined action commits.
    expect(screen.getByRole("button", { name: "Add Colorless to the slots you’re considering" })).toBeEnabled();

    fireEvent.click(screen.getByRole("button", { name: "Mark 2 taken" }));

    expect(screen.getByRole("button", { name: "Restore Colorless slot" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Restore Lands slot" })).toHaveAttribute("aria-pressed", "true");
    // The combine bar closes itself after committing.
    expect(screen.getByRole("button", { name: "Mark several as one combined lot…" })).toBeInTheDocument();
  });

  it("switches out of random mode and picks the tapped color when a checkmark is used", () => {
    render(createElement(Harness));

    fireEvent.click(screen.getByRole("button", { name: "Any remaining color (random)" }));
    expect(screen.getByText("Any of the 8 remaining colors")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Add Red to the slots you’re considering" }));
    expect(screen.getByText("Red selected")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Any remaining color (random)" })).toHaveAttribute("aria-pressed", "false");
  });
});
