import { createElement } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LargeBreakView } from "./App";
import type { BreakAnalysis } from "./data/evaluate";
import { calculateBreak } from "./domain/valuation";

describe("large break card list", () => {
  it("opens the shared card information panel from a named-card entry", () => {
    const valuation = calculateBreak({
      threshold: 2,
      prices: [
        { id: "named", set: "TST", collectorNumber: "1", name: "Named Dragon", slot: "R", nonfoil: 50, foil: null, image: "https://example.com/dragon.jpg" },
        { id: "residual", set: "TST", collectorNumber: "2", name: "Residual Card", slot: "U", nonfoil: 3, foil: null },
      ],
      draws: [
        { set: "TST", collectorNumber: "1", copies: 1, foil: false, source: "test" },
        { set: "TST", collectorNumber: "2", copies: 1, foil: false, source: "test" },
      ],
    });
    const analysis = {
      valuation,
      outcomeModel: { cacheKey: "test", complete: true, packs: [], fixed: [] },
      outcomeOmissions: [],
      priceAvailability: { status: "available", source: "snapshot" },
    } as BreakAnalysis;

    render(createElement(LargeBreakView, { analysis, lines: [], spots: 4 }));
    const entry = screen.getByRole("button", { name: "Open Named Dragon card details" });
    expect(entry).toHaveTextContent("$50.00 · Nonfoil · TST");
    fireEvent.click(entry);
    expect(screen.getByRole("dialog", { name: "Named Dragon" })).toBeInTheDocument();
  });
});
