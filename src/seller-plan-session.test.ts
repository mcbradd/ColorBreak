import { createElement } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { calculateBreak } from "./domain/valuation";
import type { BreakAnalysis } from "./data/evaluate";
import { readSellerPlanDraft, sellerCompositionFingerprint, sellerPlanKeyFor } from "./persistence";
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
const fingerprint = sellerCompositionFingerprint(lines, analysis.valuation.dataVersion);

describe("mounted seller operating plan", () => {
  afterEach(() => { cleanup(); sessionStorage.clear(); });

  it("keeps target locks and actual asks in the private session plan across a remount", async () => {
    const first = render(createElement(SellerView, {
      analysis, lines, transactionCount: 8, add: () => {}, update: () => {}, remove: () => {},
    }));

    const planned = await screen.findByLabelText("Planned bid per spot");
    fireEvent.change(planned, { target: { value: "24" } });
    fireEvent.blur(planned);
    fireEvent.click(screen.getByTitle("Lock target"));
    const actual = screen.getByLabelText("Actual White sale price");
    fireEvent.change(actual, { target: { value: "25" } });
    fireEvent.blur(actual);

    await waitFor(() => expect(readSellerPlanDraft(fingerprint)).toMatchObject({
      plannedBidOverride: 24, lockedAsks: { W: 192 }, actualAsks: { W: 25 },
    }));
    first.unmount();

    render(createElement(SellerView, {
      analysis, lines, transactionCount: 8, add: () => {}, update: () => {}, remove: () => {},
    }));
    expect(await screen.findByLabelText("Planned bid per spot")).toHaveValue("24");
    expect(screen.getByLabelText("Actual White sale price")).toHaveValue("25");
    expect(screen.getByTitle("Unlock target")).toBeInTheDocument();
  });

  it("does not create a plan until edited, and discard does not resurrect it", async () => {
    render(createElement(SellerView, {
      analysis, lines, transactionCount: 8, add: () => {}, update: () => {}, remove: () => {},
    }));
    expect(sessionStorage.getItem(sellerPlanKeyFor(fingerprint))).toBeNull();

    fireEvent.change(await screen.findByLabelText("Planned bid per spot"), { target: { value: "24" } });
    fireEvent.blur(screen.getByLabelText("Planned bid per spot"));
    await waitFor(() => expect(sessionStorage.getItem(sellerPlanKeyFor(fingerprint))).not.toBeNull());

    fireEvent.click(screen.getByRole("button", { name: "Discard this seller plan" }));
    await waitFor(() => expect(sessionStorage.getItem(sellerPlanKeyFor(fingerprint))).toBeNull());
  });
});
