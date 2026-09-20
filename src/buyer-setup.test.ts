import { createElement } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BuyerSetup } from "./features/buyer/BuyerSetup";
import { createAuction, markSlotsTaken } from "./domain/auction";
import type { BreakLine, ValuationResult } from "./domain/types";
import { resolveCosts } from "./domain/cost-assumptions";

const lines: BreakLine[] = [{
  id: "line-1",
  set: "TST",
  productKey: "play-box",
  productLabel: "Play Booster Box",
  quantity: 1,
}];

const result = {
  marketEV: 36,
  sellableEV: 36,
  knownEV: 36,
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

describe("Check a Bid setup order", () => {
  const baseProps = {
    lines,
    onImport: vi.fn(),
    onChange: vi.fn(),
    result,
    setAuction: vi.fn(),
    setAssignmentMode: vi.fn(),
    setSelectedSlots: vi.fn(),
    bulkEnabled: true,
    bulkThreshold: 2,
    setBulkEnabled: vi.fn(),
    setBulkThreshold: vi.fn(),
    costs: { ...resolveCosts({}, 420, 8, 0, "UTC"), update: vi.fn() },
    largeSpots: 120,
    setLargeSpots: vi.fn(),
  };

  afterEach(cleanup);

  it("keeps the break setup compact and places slot selection in the Break panel", () => {
    const { container } = render(createElement(BuyerSetup, {
      ...baseProps,
      auction: createAuction(),
      assignmentMode: "random",
      selectedSlots: ["W"],
    }));
    const setup = container.querySelector(".buyer-setup")!;
    const directSections = Array.from(setup.querySelector(".buyer-entry-panel")!.children);

    expect(directSections[0]).toHaveClass("break-format-choice");
    expect(directSections[1]).toHaveClass("quick-break-composer");
    expect(setup.querySelector(".buyer-team-panel .buyer-slot-control")).toBeInTheDocument();
    expect(directSections).toHaveLength(2);
    expect(screen.queryByText("Break type")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Add products" })).toBeInTheDocument();
    expect(screen.queryByText(/\d+ ·/)).not.toBeInTheDocument();
    expect(screen.queryByText("Adjust assumptions")).not.toBeInTheDocument();
  });

  it("offers both formats before a single product exists", () => {
    render(createElement(BuyerSetup, {
      ...baseProps,
      lines: [],
      auction: createAuction(),
      assignmentMode: "random",
      selectedSlots: [],
    }));

    // The format question is the whole point of leading with it: a buyer
    // looking for a large break must not have to build a break to find it.
    expect(screen.getByRole("group", { name: "Break format" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Standard (8 Slots)" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Custom" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.queryByRole("group", { name: "Color slots" })).toBeNull();

    // The difference between the two formats is one tap away, in a popover,
    // rather than a paragraph of standing explanation nobody reads.
    fireEvent.click(screen.getByRole("button", { name: "How break formats work" }));
    const explanation = screen.getByRole("tooltip");
    expect(explanation).toHaveTextContent(/one slot for each color/i);
    expect(explanation).toHaveTextContent(/500 products/i);
  });

  it("switches to a large break from the format step without a product", () => {
    const setAssignmentMode = vi.fn();
    render(createElement(BuyerSetup, {
      ...baseProps,
      lines: [],
      auction: createAuction(),
      assignmentMode: "random",
      selectedSlots: [],
      setAssignmentMode,
    }));

    fireEvent.click(screen.getByRole("button", { name: "Custom" }));
    expect(setAssignmentMode).toHaveBeenCalledWith("large");
  });

  it("replaces the color-slot step with the large-break spot count", () => {
    render(createElement(BuyerSetup, {
      ...baseProps,
      auction: createAuction(),
      assignmentMode: "large",
      selectedSlots: [],
    }));

    expect(screen.getByRole("button", { name: "Custom" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByLabelText("Custom entry count")).toHaveValue("120");
    // Large breaks omit slots; assumptions live in the workspace header.
    expect(screen.queryByText(/\d+ ·/)).toBeNull();
    expect(screen.queryByRole("group", { name: "Color slots" })).toBeNull();
  });

  it("keeps the break contents when the format changes", () => {
    const colorFormat = render(createElement(BuyerSetup, {
      ...baseProps,
      auction: createAuction(),
      assignmentMode: "random",
      selectedSlots: ["W"],
    }));
    expect(screen.getByText("Play Booster Box")).toBeInTheDocument();
    colorFormat.unmount();

    render(createElement(BuyerSetup, {
      ...baseProps,
      auction: createAuction(),
      assignmentMode: "large",
      selectedSlots: ["W"],
    }));
    expect(screen.getByText("Play Booster Box")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Add products" })).toBeInTheDocument();
  });

  it("names the color-slot choices a large break cannot use instead of dropping them silently", () => {
    render(createElement(BuyerSetup, {
      ...baseProps,
      auction: markSlotsTaken(createAuction(), ["R"]),
      assignmentMode: "large",
      selectedSlots: ["W", "U"],
    }));

    const notice = screen.getByRole("status", { name: "Color-slot choices a large break does not use" });
    expect(notice).toHaveTextContent("Kept, but not used by a large break");
    expect(notice).toHaveTextContent("the White, Blue slots you marked as yours");
    expect(notice).toHaveTextContent("the Red slot you marked taken");
    expect(notice).toHaveTextContent("Nothing was deleted");
  });

  it("stays quiet when a large break has nothing set aside", () => {
    render(createElement(BuyerSetup, {
      ...baseProps,
      auction: createAuction(),
      assignmentMode: "large",
      selectedSlots: [],
    }));

    expect(screen.queryByRole("status", { name: "Color-slot choices a large break does not use" })).toBeNull();
  });
});
