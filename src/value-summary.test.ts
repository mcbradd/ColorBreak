import { createElement } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ValueSummary } from "./App";
import { calculateBreak } from "./domain/valuation";

describe("filtered value summary", () => {
  it("shows ignored bulk as a positive reconciliation amount", () => {
    const result = calculateBreak({
      threshold: 2,
      prices: [
        { id: "kept", set: "TST", collectorNumber: "1", name: "Kept", slot: "G", nonfoil: 10, foil: null },
        { id: "bulk", set: "TST", collectorNumber: "2", name: "Bulk", slot: "G", nonfoil: 0.5, foil: null },
      ],
      draws: [
        { set: "TST", collectorNumber: "1", copies: 1, foil: false, source: "test" },
        { set: "TST", collectorNumber: "2", copies: 2, foil: false, source: "test" },
      ],
    });
    render(createElement(ValueSummary, { result }));

    const ignoredMetric = screen.getByText("Ignored as bulk").closest("div")!;
    expect(within(ignoredMetric).getByText("$1.00")).toBeInTheDocument();
    expect(ignoredMetric).not.toHaveTextContent("−$1.00");
    expect(result.marketEV).toBeCloseTo(result.sellableEV + 1);
    const rawMetric = screen.getByText("Before ignoring bulk").closest("div")!;
    expect(within(rawMetric).getByText("$11.00")).toBeInTheDocument();
    expect(screen.getByText("BREAK VALUE AFTER IGNORING BULK")).toBeInTheDocument();
    expect(screen.getByText("$11.00 all cards")).toBeInTheDocument();
    expect(screen.getByText("$1.00 ignored")).toBeInTheDocument();
    expect(screen.getByText("$10.00 used here")).toBeInTheDocument();
    const status = screen.getByRole("button", { name: /explain verified data status/i });
    expect(status).toHaveClass("tip-indicator", "status", "verified");
    fireEvent.click(status);
    expect(screen.getByRole("tooltip")).toHaveTextContent("Product contents, pack odds, card versions, and prices are ready.");
  });
});
