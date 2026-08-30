import { createElement, useState } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { calculateBreak } from "./domain/valuation";
import type { BreakAnalysis } from "./data/evaluate";
import type { BreakLine } from "./domain/types";

import { SellerView } from "./features/seller/SellerView";

const valuation = calculateBreak({
  prices: [{ id: "w", set: "TST", collectorNumber: "1", name: "White", slot: "W", nonfoil: 20, foil: null }],
  draws: [{ set: "TST", collectorNumber: "1", copies: 1, foil: false, source: "fixed" }],
  threshold: 0,
});

const analysis: BreakAnalysis = {
  valuation,
  outcomeModel: { cacheKey: "seller-command", complete: true, packs: [], fixed: [{ id: "w", slot: "W", value: 20 }] },
  outcomeOmissions: [],
};

const startingLines: BreakLine[] = [{
  id: "line-1",
  set: "TST",
  productKey: "play-box",
  productLabel: "Play Booster Box",
  quantity: 1,
  tcgId: 1,
  marketCost: 100,
}];

function Harness() {
  const [lines, setLines] = useState(startingLines);
  return createElement(SellerView, {
    analysis,
    lines,
    transactionCount: 8,
    add: vi.fn(),
    remove: (id: string) => setLines((current) => current.filter((line) => line.id !== id)),
    update: (id: string, patch: Partial<BreakLine>) => setLines((current) => current.map((line) => line.id === id ? { ...line, ...patch } : line)),
  });
}

describe("Seller Studio command center", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("products.json")) return { ok: true, status: 200, json: async () => ({ sets: { TST: { name: "Test", released: "2025-01-01", groupId: 1, products: [] } } }) };
      return { ok: false, status: 404, json: async () => ({}) };
    }));
  });

  it("turns one entered bid into immediate full and partial-fill profit scenarios", () => {
    render(createElement(Harness));

    fireEvent.click(screen.getByRole("button", { name: "Use 1 market estimates" }));

    const studio = screen.getByRole("region", { name: "Seller break economics" });
    expect(within(studio).getByText("$16.77")).toBeInTheDocument();
    const plannedBid = within(studio).getByLabelText("Planned bid per spot");
    fireEvent.change(plannedBid, { target: { value: "20" } });

    expect(within(screen.getByText("8 / 8 sold").parentElement!).getByText("Profit $23.00")).toBeInTheDocument();
    expect(within(screen.getByText("6 / 8 sold").parentElement!).getByText("Loss $7.75")).toBeInTheDocument();
    expect(within(screen.getByText("4 / 8 sold").parentElement!).getByText("Loss $38.50")).toBeInTheDocument();
  });

  it("uses market price only after the seller explicitly accepts it as an estimate", () => {
    render(createElement(Harness));

    expect(screen.getByText("Current market").parentElement).toHaveTextContent("$100.00");
    expect(screen.getByRole("region", { name: "Seller break economics" })).toHaveTextContent("Choose cost basis");
    fireEvent.click(screen.getByRole("button", { name: "Use 1 market estimates" }));
    expect(screen.getByRole("region", { name: "Seller break economics" })).toHaveTextContent("$16.77");
    const cost = screen.getByLabelText("My cost basis");
    fireEvent.change(cost, { target: { value: "80" } });
    expect(screen.getByRole("region", { name: "Seller break economics" })).toHaveTextContent("$13.97");
  });

  it("accepts a stale market estimate in one deliberate rehearsal action", () => {
    render(createElement(SellerView, {
      analysis: { ...analysis, priceAvailability: { status: "stale", source: "sealed snapshot", observedAt: "2025-01-01T00:00:00.000Z", message: "Old snapshot" } },
      lines: startingLines,
      transactionCount: 8,
      add: vi.fn(), remove: vi.fn(), update: vi.fn(),
    }));

    fireEvent.click(screen.getByRole("button", { name: "Use 1 market estimates" }));
    expect(screen.getAllByText("Estimated cost basis ready for rehearsal")).not.toHaveLength(0);
    expect(screen.getByRole("region", { name: "Seller break economics" })).toHaveTextContent("$16.77");
    expect(screen.queryByRole("button", { name: "Accept for rehearsal only" })).not.toBeInTheDocument();
    expect(screen.getByText("Rehearsal economics only — verify actual cost.")).toBeInTheDocument();
  });

  it("keeps overhead optional and removes buyer-specific analysis from Seller Studio", () => {
    render(createElement(Harness));

    const costs = screen.getByText("Costs & platform fees").closest("details");
    expect(costs).not.toBeNull();
    expect(costs).not.toHaveAttribute("open");
    expect(screen.getByRole("region", { name: "Enticement" })).toBeInTheDocument();
    expect(screen.getByLabelText("Bid threshold")).toBeInTheDocument();
    expect(screen.queryByText(/Buyer card value/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Color slots" })).not.toBeInTheDocument();
  });

  it("links a missing product cost to that product's cost field", () => {
    const missingCostLines = [{ ...startingLines[0], marketCost: undefined }];
    render(createElement(SellerView, {
      analysis,
      lines: missingCostLines,
      transactionCount: 8,
      add: vi.fn(),
      remove: vi.fn(),
      update: vi.fn(),
    }));

    const link = screen.getByRole("link", { name: "Enter your cost for Play Booster Box" });
    expect(link).toHaveAttribute("href", "#seller-cost-line-1");
    expect(screen.getByLabelText("My cost basis")).toHaveAttribute("id", "seller-cost-line-1");
    const warning = link.closest("details")!;
    expect(warning).not.toHaveAttribute("open");
    expect(link.closest("summary")).toHaveTextContent("Needed to calculate break-even and profit");
    fireEvent.click(link.closest("summary")!);
    expect(warning).toHaveTextContent("No sealed-market price is available");
  });

  it("inherits a 100-spot break and uses 100, 85, and 70 sold scenarios", () => {
    render(createElement(SellerView, {
      analysis,
      lines: [{ ...startingLines[0], myCost: 100 }],
      transactionCount: 100,
      add: vi.fn(),
      remove: vi.fn(),
      update: vi.fn(),
    }));

    const studio = screen.getByRole("region", { name: "Seller break economics" });
    expect(studio).toHaveTextContent("per spot · all 100 sold");
    expect(studio).toHaveTextContent("100 / 100 sold");
    expect(studio).toHaveTextContent("85 / 100 sold");
    expect(studio).toHaveTextContent("70 / 100 sold");
  });
});

