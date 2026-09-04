import { createElement } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BuyerSetup } from "./features/buyer/BuyerSetup";
import { createAuction, markSlotsTaken } from "./domain/auction";
import type { BreakLine, ValuationResult } from "./domain/types";
import { DEFAULT_BUYER_COSTS } from "./domain/bid-ceiling";

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
    add: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    result,
    setAuction: vi.fn(),
    setAssignmentMode: vi.fn(),
    setSelectedSlots: vi.fn(),
    bulkEnabled: true,
    bulkThreshold: 2,
    setBulkEnabled: vi.fn(),
    setBulkThreshold: vi.fn(),
    costs: DEFAULT_BUYER_COSTS,
    setCosts: vi.fn(),
    largeSpots: 120,
    setLargeSpots: vi.fn(),
  };

  afterEach(cleanup);

  it("asks the format question first, then contents, then the slot", () => {
    const { container } = render(createElement(BuyerSetup, {
      ...baseProps,
      auction: createAuction(),
      assignmentMode: "random",
      selectedSlots: ["W"],
    }));
    const setup = container.querySelector(".buyer-setup")!;
    const directSections = Array.from(setup.children);

    expect(directSections[0]).toHaveClass("break-format-choice");
    expect(directSections[1]).toHaveClass("composition");
    expect(directSections[2]).toHaveClass("buyer-slot-control");
    expect(directSections[3].tagName).toBe("DETAILS");
    expect(screen.getByText("1 · TYPE OF BREAK")).toBeInTheDocument();
    expect(screen.getByText("2 · WHAT’S IN IT")).toBeInTheDocument();
    expect(screen.getByText("3 · MY SLOTS")).toBeInTheDocument();
    expect(screen.getByText("Adjust assumptions")).toBeInTheDocument();
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
    expect(screen.getByRole("group", { name: "Type of break" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Color slots" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Large break" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.queryByRole("group", { name: "Color slots" })).toBeNull();

    // The difference between the two formats is one tap away, in a popover,
    // rather than a paragraph of standing explanation nobody reads.
    fireEvent.click(screen.getByRole("button", { name: "What the two break types mean" }));
    const explanation = screen.getByRole("tooltip");
    expect(explanation).toHaveTextContent(/standard prize wheel/);
    expect(explanation).toHaveTextContent(/many random spots/i);
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

    fireEvent.click(screen.getByRole("button", { name: "Large break" }));
    expect(setAssignmentMode).toHaveBeenCalledWith("large");
  });

  it("replaces the color-slot step with the large-break spot count", () => {
    render(createElement(BuyerSetup, {
      ...baseProps,
      auction: createAuction(),
      assignmentMode: "large",
      selectedSlots: [],
    }));

    expect(screen.getByRole("button", { name: "Large break" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByLabelText("Large break spot count")).toHaveValue("120");
    // No color-slot step in this format, so costs are step 3.
    expect(screen.queryByText("3 · MY SLOTS")).toBeNull();
    expect(screen.getByText("3 · MY COSTS")).toBeInTheDocument();
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
    expect(screen.getByText("2 · WHAT’S IN IT")).toBeInTheDocument();
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
