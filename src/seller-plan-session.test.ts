import { createElement } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { calculateBreak } from "./domain/valuation";
import type { BreakAnalysis } from "./data/evaluate";
import type { BreakLine } from "./domain/types";
import { defaultSellerPlanDraft, readSellerPlanDraft, sellerPlanOwner, writeSellerPlanDraft } from "./persistence";
import { SellerView } from "./features/seller/SellerView";

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
  quantity: 1, packCount: 1, tcgId: 1, marketCost: 100, myCost: 80,
}];

const view = (composition: BreakLine[], result = analysis) => createElement(SellerView, {
  analysis: result, lines: composition, transactionCount: 8,
  add: () => {}, update: () => {}, remove: () => {},
});

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

  it("keeps operating assumptions through ongoing mix edits and resets only composition targets", async () => {
    const original: BreakLine[] = [
      { ...lines[0], myCost: undefined },
      { ...lines[0], id: "removed-line", set: "OTHER", myCost: undefined },
    ];
    writeSellerPlanDraft({
      ...defaultSellerPlanDraft(), owner: sellerPlanOwner(original, analysis.valuation.dataVersion),
      buyerShipping: 4, packing: 3, postage: 2, shipments: 3, mailingMethod: "custom",
      commission: 7, processing: 3, processingFlat: .5, labor: 11,
      plannedBidOverride: 24, minimumAsk: 5, acceptedEstimateIds: original.map((line) => line.id),
      targetsApplied: true, lockedAsks: { W: 192 }, unsoldSlots: ["U"],
    });
    const mounted = render(view(original));
    const edited: BreakLine[] = [
      { ...original[0], id: "retained-copy", quantity: 3 },
      { ...original[1], id: "new-line", set: "NEW" },
    ];
    mounted.rerender(view(edited));

    await waitFor(() => expect(readSellerPlanDraft()).toMatchObject({
      owner: sellerPlanOwner(edited, analysis.valuation.dataVersion),
      buyerShipping: 4, packing: 3, postage: 2, shipments: 3, mailingMethod: "custom",
      commission: 7, processing: 3, processingFlat: .5, labor: 11,
      plannedBidOverride: 24, minimumAsk: 5, acceptedEstimateIds: ["retained-copy"],
      targetsApplied: false, lockedAsks: {}, unsoldSlots: [],
    }));
    expect(screen.queryByLabelText("Saved seller plan recovery")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Planned bid per spot")).toHaveValue("24");
  });

  it("keeps the plan and estimate choice when the same mix gets refreshed prices", async () => {
    const original = [{ ...lines[0], myCost: undefined }];
    writeSellerPlanDraft({
      ...defaultSellerPlanDraft(), owner: sellerPlanOwner(original, analysis.valuation.dataVersion),
      plannedBidOverride: 24, acceptedEstimateIds: [original[0].id],
      targetsApplied: true, lockedAsks: { W: 192 }, unsoldSlots: ["U"],
    });
    const mounted = render(view(original));
    const updatedAnalysis = { ...analysis, valuation: { ...analysis.valuation, dataVersion: "refreshed-prices" } };
    const updated = [{ ...original[0], marketCost: 120 }];
    mounted.rerender(view(updated, updatedAnalysis));

    await waitFor(() => expect(readSellerPlanDraft()).toMatchObject({
      owner: sellerPlanOwner(updated, "refreshed-prices"),
      plannedBidOverride: 24, acceptedEstimateIds: [original[0].id],
      targetsApplied: true, lockedAsks: { W: 192 }, unsoldSlots: ["U"],
    }));
    expect(screen.queryByLabelText("Saved seller plan recovery")).not.toBeInTheDocument();
    expect(screen.getByTitle("Unlock target")).toBeInTheDocument();
  });

  it("does not adopt another break's saved plan on mount or after editing that new break", async () => {
    const savedOwner = sellerPlanOwner(lines, analysis.valuation.dataVersion);
    writeSellerPlanDraft({ ...defaultSellerPlanDraft(), owner: savedOwner, plannedBidOverride: 24 });
    const anotherBreak = [{ ...lines[0], set: "OTHER" }];
    const mounted = render(view(anotherBreak));
    expect(screen.getByLabelText("Saved seller plan recovery")).toBeInTheDocument();

    mounted.rerender(view([{ ...anotherBreak[0], quantity: 2 }]));
    expect(screen.getByLabelText("Saved seller plan recovery")).toBeInTheDocument();
    expect(readSellerPlanDraft()).toMatchObject({ owner: savedOwner, plannedBidOverride: 24 });
  });

  it("keeps receipt-backed actuals bound to their original mix during in-session edits", async () => {
    const savedOwner = sellerPlanOwner(lines, analysis.valuation.dataVersion);
    const ledger = {
      version: 1 as const,
      orders: [{ id: "receipt-1", slotIds: ["W" as const], receiptCents: 4000, feeCents: 400, reference: "actual receipt" }],
      shipments: [],
    };
    writeSellerPlanDraft({ ...defaultSellerPlanDraft(), owner: savedOwner, plannedBidOverride: 24, actualLedger: ledger });
    const mounted = render(view(lines));
    mounted.rerender(view([{ ...lines[0], quantity: 2 }]));

    expect(screen.getByLabelText("Saved seller plan recovery")).toBeInTheDocument();
    expect(readSellerPlanDraft()).toMatchObject({ owner: savedOwner, actualLedger: ledger, plannedBidOverride: 24 });
    expect(screen.queryByText("actual receipt")).not.toBeInTheDocument();
  });
});

