import { createElement, useState } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { calculateBreak } from "./domain/valuation";
import type { SurpriseSetCard } from "./domain/surprise-set";
import type { BreakAnalysis } from "./data/evaluate";
import { SurpriseSetEditor } from "./features/seller/SurpriseSetEditor";

function analysis(): BreakAnalysis {
  const valuation = calculateBreak({
    prices: [{ id: "w", set: "TST", collectorNumber: "1", name: "White Card", slot: "W", nonfoil: 10, foil: null }],
    draws: [{ set: "TST", collectorNumber: "1", copies: 1, foil: false, source: "fixed" }],
    threshold: 0,
  });
  return {
    valuation,
    outcomeModel: { cacheKey: "seller-surprise-test", complete: true, packs: [], fixed: [] },
    outcomeOmissions: [],
    priceAvailability: { status: "available", source: "snapshot", message: "Available" },
  };
}

describe("seller Surprise Set editor", () => {
  it("lets the seller edit card names and values under each color team", () => {
    const onChange = vi.fn();
    function Harness() {
      const [cards, setCards] = useState<SurpriseSetCard[]>([]);
      const update = (next: typeof cards) => { onChange(next); setCards(next); };
      return createElement(SurpriseSetEditor, { cards, analysis: analysis(), onChange: update });
    }
    render(createElement(Harness));
    fireEvent.click(screen.getByText("Configure Surprise Set contents"));
    const white = screen.getByRole("group", { name: /White/ });
    fireEvent.click(within(white).getByRole("button", { name: "Add card to White" }));

    const name = within(white).getByLabelText("Card name");
    fireEvent.change(name, { target: { value: "Example card" } });
    expect(onChange).toHaveBeenLastCalledWith([expect.objectContaining({ slot: "W", name: "Example card", value: 0 })]);
  });

  it("offers autofill and assigns modeled cards to their printed color teams", () => {
    const onChange = vi.fn();
    render(createElement(SurpriseSetEditor, { cards: [], analysis: analysis(), onChange }));
    fireEvent.click(screen.getByText("Configure Surprise Set contents"));
    fireEvent.click(screen.getByRole("button", { name: "Autofill standard 8 color teams" }));

    expect(onChange).toHaveBeenCalledWith([expect.objectContaining({ slot: "W", name: "White Card", value: 10 })]);
    expect(screen.getByRole("status")).toHaveTextContent("Added 1 modeled cards to their matching color teams.");
  });
});
