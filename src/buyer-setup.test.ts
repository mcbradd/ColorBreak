import { createElement } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BuyerSetup } from "./App";
import { createAuction } from "./domain/auction";
import type { BreakLine, ValuationResult } from "./domain/types";

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
  it("puts break contents, color controls, and bid options in auction order", () => {
    const { container } = render(createElement(BuyerSetup, {
      lines,
      add: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
      result,
      auction: createAuction(),
      setAuction: vi.fn(),
      assignmentMode: "pick",
      setAssignmentMode: vi.fn(),
      selected: "W",
      setSelected: vi.fn(),
      bulkEnabled: true,
      bulkThreshold: 2,
      setBulkEnabled: vi.fn(),
      setBulkThreshold: vi.fn(),
    }));
    const setup = container.querySelector(".buyer-setup")!;
    const directSections = Array.from(setup.children);

    expect(directSections[0]).toHaveClass("composition");
    expect(directSections[1]).toHaveClass("buyer-slot-control");
    expect(directSections[2]).toHaveClass("buyer-options-heading");
    expect(directSections[3]).toHaveClass("bulk-filter-control");
    expect(screen.getByText("1 · BREAK CONTENTS")).toBeInTheDocument();
    expect(screen.getByText("2 · COLOR")).toBeInTheDocument();
    expect(screen.getByText("3 · BID OPTIONS")).toBeInTheDocument();
  });
});
