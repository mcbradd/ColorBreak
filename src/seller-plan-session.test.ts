import { createElement } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { calculateBreak } from "./domain/valuation";
import type { BreakAnalysis } from "./data/evaluate";
import { readSellerPlanDraft } from "./persistence";
import { SellerView } from "./App";

const analysis: BreakAnalysis = {
  valuation: calculateBreak({
    prices: [{ id: "white", set: "TST", collectorNumber: "1", name: "White", slot: "W", nonfoil: 20, foil: null }],
    draws: [{ set: "TST", collectorNumber: "1", copies: 1, foil: false, source: "fixed" }],
    threshold: 2,
  }),
  outcomeModel: { complete: true, packs: [], fixed: [{ id: "white", slot: "W", value: 20 }] },
  outcomeOmissions: [],
};

const lines = [{
  id: "line-1", set: "TST", productKey: "box", productLabel: "Test Box",
  quantity: 1, tcgId: 1, marketCost: 100, myCost: 80,
}];

describe("mounted seller operating plan", () => {
  afterEach(() => { cleanup(); sessionStorage.clear(); });

  it("keeps target locks private without turning a plan into an actual result", async () => {
    const first = render(createElement(SellerView, {
      analysis, lines, transactionCount: 8, add: () => {}, update: () => {}, remove: () => {},
    }));

    const planned = await screen.findByLabelText("Planned bid per spot");
    fireEvent.change(planned, { target: { value: "24" } });
    fireEvent.blur(planned);
    fireEvent.click(screen.getByTitle("Lock target"));
    await waitFor(() => expect(readSellerPlanDraft()).toMatchObject({
      plannedBidOverride: 24, lockedAsks: { W: 192 },
    }));
    expect(screen.getByText("Reconciliation in progress")).toBeInTheDocument();
    expect(screen.queryByLabelText("Actual White sale price")).toBeNull();
    first.unmount();

    render(createElement(SellerView, {
      analysis, lines, transactionCount: 8, add: () => {}, update: () => {}, remove: () => {},
    }));
    expect(await screen.findByLabelText("Planned bid per spot")).toHaveValue("24");
    expect(screen.getByTitle("Unlock target")).toBeInTheDocument();
  });
});
