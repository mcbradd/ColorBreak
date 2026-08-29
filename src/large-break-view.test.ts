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
    expect(screen.getByText("Named assignments").nextElementSibling).toHaveTextContent("1");
    expect(document.querySelector(".assignment-rules")).toHaveTextContent("each card belongs to one assignment only");
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

    fireEvent.click(screen.getByRole("button", { name: /Show all \d+ category assignments/ }));
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

    const { container } = render(createElement(LargeBreakView, { analysis, lines: [], spots: 18 }));
    const slot = screen.getByRole("button", { name: "Show cards in Named Dragon slot" });
    expect(slot).toHaveTextContent("$50.00 · Nonfoil · TST");
    fireEvent.click(slot);
    const entry = screen.getByRole("button", { name: "Open Named Dragon card details" });
    expect(entry).toHaveTextContent("$50.00 · Nonfoil · TST");
    expect(container.querySelector(".large-break-slot-cards .card-thumbnail")).toBeEmptyDOMElement();
    fireEvent.click(entry);
    expect(screen.getByRole("dialog", { name: "Named Dragon" })).toBeInTheDocument();
  });

  it("shows the compact-list price in the card details panel when it comes from a listed-price fallback", () => {
    const valuation = calculateBreak({
      threshold: 2,
      prices: [{
        id: "listed-foil", set: "TST", collectorNumber: "1", name: "Listed Foil", slot: "R",
        nonfoil: null, foil: null, prices: { foil: null }, listedPrices: { foil: 18.25 },
      }],
      draws: [{ set: "TST", collectorNumber: "1", copies: 1, finish: "foil", foil: true, source: "test" }],
    });
    const analysis = {
      valuation,
      outcomeModel: { cacheKey: "test", complete: true, packs: [], fixed: [] },
      outcomeOmissions: [],
      priceAvailability: { status: "available", source: "snapshot" },
    } as BreakAnalysis;

    render(createElement(LargeBreakView, { analysis, lines: [], spots: 18 }));
    fireEvent.click(screen.getByRole("button", { name: "Show cards in Listed Foil slot" }));
    const compactCard = screen.getByRole("button", { name: "Open Listed Foil (Foil) card details" });
    expect(compactCard).toHaveTextContent("$18.25 · Foil · TST");
    fireEvent.click(compactCard);

    const dialog = screen.getByRole("dialog", { name: "Listed Foil (Foil)" });
    expect(dialog).toHaveTextContent("Selected finish price$18.25");
  });

  it("lists every named slot and opens every card assigned to a selected slot", () => {
    const prices = Array.from({ length: 14 }, (_, index) => ({
      id: `card-${index}`,
      set: "TST",
      collectorNumber: String(index + 1),
      name: `Card ${String(index + 1).padStart(2, "0")}`,
      typeLine: "Artifact",
      slot: "C" as const,
      nonfoil: 100 - index,
      foil: null,
    }));
    prices.push({ id: "jace-one", set: "TST", collectorNumber: "20", name: "Jace Beleren", typeLine: "Legendary Planeswalker — Jace", slot: "U", nonfoil: 200, foil: null });
    prices.push({ id: "jace-two", set: "TST", collectorNumber: "21", name: "Jace, Architect of Thought", typeLine: "Legendary Planeswalker — Jace", slot: "U", nonfoil: 190, foil: null });
    const valuation = calculateBreak({
      threshold: 0,
      prices,
      draws: prices.map((card) => ({ set: card.set, collectorNumber: card.collectorNumber, copies: 1, foil: false, source: "test" })),
    });
    const analysis = {
      valuation,
      outcomeModel: { cacheKey: "test", complete: true, packs: [], fixed: [] },
      outcomeOmissions: [],
      priceAvailability: { status: "available", source: "snapshot" },
    } as BreakAnalysis;

    render(createElement(LargeBreakView, { analysis, lines: [], spots: 32 }));

    fireEvent.click(screen.getByRole("button", { name: /more named assignments/ }));
    expect(screen.getByRole("button", { name: "Show cards in Card 14 slot" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Show cards in Jace slot" }));
    expect(screen.getByRole("button", { name: "Open Jace Beleren card details" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open Jace, Architect of Thought card details" })).toBeInTheDocument();
  });

  it("lists residual-slot cards and opens them in the shared card panel", () => {
    const valuation = calculateBreak({
      threshold: 0,
      prices: [{ id: "bolt", set: "TST", collectorNumber: "1", name: "Lightning Bolt", typeLine: "Instant", slot: "R", nonfoil: 4, foil: null }],
      draws: [{ set: "TST", collectorNumber: "1", copies: 1, foil: false, source: "test" }],
    });
    const analysis = {
      valuation,
      outcomeModel: { cacheKey: "test", complete: true, packs: [], fixed: [] },
      outcomeOmissions: [],
      priceAvailability: { status: "available", source: "snapshot" },
    } as BreakAnalysis;

    render(createElement(LargeBreakView, { analysis, lines: [], spots: 17 }));

    fireEvent.click(screen.getByRole("button", { name: /Show all \d+ category assignments/ }));
    fireEvent.click(screen.getByRole("button", { name: "Show cards in Instant slot" }));
    const card = screen.getByRole("button", { name: "Open Lightning Bolt card details" });
    fireEvent.click(card);
    expect(screen.getByRole("dialog", { name: "Lightning Bolt" })).toBeInTheDocument();
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
    fireEvent.click(screen.getByRole("button", { name: /Review all \d+ model blockers/i }));
    expect(document.querySelector(".incomplete-data-technical")).toHaveAttribute("open");
    expect(document.querySelector(".incomplete-data-technical")).toHaveTextContent("1 issue");
    fireEvent.click(screen.getByRole("button", { name: "Price" }));
    const excluded = screen.getByRole("button", { name: /Explain why Sothera.*excluded from Pull EV/i });
    expect(excluded).toHaveTextContent("Excluded");
    fireEvent.click(excluded);
    const explanation = screen.getByRole("dialog", { name: "Excluded from Pull EV" });
    expect(explanation).toHaveTextContent("exact pull chance");
    expect(explanation).toHaveTextContent("Rank by Price");
  });
});
