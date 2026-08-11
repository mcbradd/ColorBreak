import { createElement } from "react";
import { render, screen, within } from "@testing-library/react";
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

    const ignoredMetric = screen.getByText("Bulk excluded").closest("div")!;
    expect(within(ignoredMetric).getByText("$1.00")).toBeInTheDocument();
    expect(ignoredMetric).not.toHaveTextContent("−$1.00");
    expect(result.marketEV).toBeCloseTo(result.sellableEV + 1);
    const rawMetric = screen.getByText("Raw modeled EV").closest("div")!;
    expect(within(rawMetric).getByText("$11.00")).toBeInTheDocument();
    expect(screen.getByText("BREAK EV AFTER BULK FILTER")).toBeInTheDocument();
    expect(screen.getByText("$11.00 raw")).toBeInTheDocument();
    expect(screen.getByText("$1.00 bulk")).toBeInTheDocument();
    expect(screen.getByText("$10.00 counted")).toBeInTheDocument();
    expect(
      screen.getByLabelText(/Counted EV \(\$10\.00\) plus bulk excluded \(\$1\.00\) equals raw modeled EV \(\$11\.00\).*not a loss or negative value/),
    ).toBeInTheDocument();
  });
});
