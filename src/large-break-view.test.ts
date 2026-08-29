import { createElement } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LargeBreakView } from "./App";
import type { BreakAnalysis } from "./data/evaluate";
import { calculateBreak } from "./domain/valuation";

describe("large break card list", () => {
  it("shows all variants of a character as one named character slot", () => {
    const valuation = calculateBreak({
      threshold: 0,
      prices: [
        { id: "jace-beleren", set: "TST", collectorNumber: "1", name: "Jace Beleren", typeLine: "Legendary Planeswalker — Jace", slot: "U", nonfoil: 10, foil: null },
        { id: "jace-architect", set: "TST", collectorNumber: "2", name: "Jace, Architect of Thought", typeLine: "Legendary Planeswalker — Jace", slot: "U", nonfoil: 20, foil: null },
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

    render(createElement(LargeBreakView, { analysis, lines: [], spots: 18 }));

    expect(screen.getByText("Jace")).toBeInTheDocument();
    expect(screen.getByText("Top-value spots").nextElementSibling).toHaveTextContent("1");
  });

  it("renders each residual category as one indivisible slot", () => {
    const valuation = calculateBreak({
      threshold: 0,
      prices: [
        { id: "named", set: "TST", collectorNumber: "1", name: "Named Dragon", typeLine: "Creature — Dragon", slot: "R", nonfoil: 50, foil: null },
        { id: "residual", set: "TST", collectorNumber: "2", name: "Bolt", typeLine: "Instant", slot: "R", nonfoil: 4, foil: null },
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

    render(createElement(LargeBreakView, { analysis, lines: [], spots: 18 }));

    expect(screen.getByText("Instant")).toBeInTheDocument();
    expect(screen.getByText("1 remaining card")).toBeInTheDocument();
    expect(screen.getByText("Slot EV")).toBeInTheDocument();
    expect(screen.queryByText("EV / spot")).not.toBeInTheDocument();
  });

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

    render(createElement(LargeBreakView, { analysis, lines: [], spots: 18 }));
    const entry = screen.getByRole("button", { name: "Open Named Dragon card details" });
    expect(entry).toHaveTextContent("$50.00 · Nonfoil · TST");
    fireEvent.click(entry);
    expect(screen.getByRole("dialog", { name: "Named Dragon" })).toBeInTheDocument();
  });

  it("explains why an unverifiable chase is excluded from Pull EV", () => {
    const valuation = calculateBreak({
      threshold: 2,
      prices: [{
        id: "sothera", set: "EOE", collectorNumber: "382", name: "Sothera, the Supervoid", slot: "M", nonfoil: null, foil: 1200,
        treatmentMetadata: {
          rawFrameEffects: [], rawPromoTypes: ["headliner"], finishClasses: ["foil"], styleTags: [], processTags: ["singularityfoil"],
          attributeTags: ["headliner"], unknownTags: [], fullArt: true, textless: true,
        },
      }],
      draws: [{ set: "EOE", collectorNumber: "382", copies: .002, pullProbability: .002, finish: "singularity", foil: true, source: "collector" }],
    });
    const analysis = {
      valuation,
      outcomeModel: { cacheKey: "test", complete: false, packs: [], fixed: [] },
      outcomeOmissions: valuation.omissions,
      priceAvailability: { status: "available", source: "snapshot" },
    } as BreakAnalysis;

    render(createElement(LargeBreakView, { analysis, lines: [], spots: 18 }));
    const excluded = screen.getByRole("button", { name: /Explain why Sothera.*excluded from Pull EV/i });
    expect(excluded).toHaveTextContent("Excluded");
    fireEvent.click(excluded);
    const explanation = screen.getByRole("dialog", { name: "Excluded from Pull EV" });
    expect(explanation).toHaveTextContent("exact pull chance");
    expect(explanation).toHaveTextContent("Rank by Price");
  });
});
