import { createElement } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { OutcomeRange } from "./features/buyer/BuyerVisuals";

const zeroDistribution = {
  min: 0, p01: 0, p10: 0, p25: 0, median: 0, mean: 2,
  p75: 0, p90: 5, p99: 20, max: 40, fingerprint: [],
};

const nonzeroDistribution = {
  min: 0, p01: 0, p10: 4, p25: 8, median: 12, mean: 14,
  p75: 18, p90: 24, p99: 30, max: 30, fingerprint: [],
};

describe("OutcomeRange zero-median explanation", () => {
  it("explains a legitimate $0 typical/outcome band directly on the outcome strip", () => {
    render(createElement(OutcomeRange, { summary: zeroDistribution }));
    expect(screen.getByText(/Usually no card above the bulk filter — most openings land at \$0\./)).toBeInTheDocument();
  });

  it("explains it on the compact strip too, where the live buyer decision actually shows it", () => {
    render(createElement(OutcomeRange, { summary: zeroDistribution, compact: true }));
    expect(screen.getByText(/Usually no card above the bulk filter — most openings land at \$0\./)).toBeInTheDocument();
  });

  it("stays silent when the typical result is not zero", () => {
    render(createElement(OutcomeRange, { summary: nonzeroDistribution }));
    expect(screen.queryByText(/Usually no card above the bulk filter/)).not.toBeInTheDocument();
  });
});
