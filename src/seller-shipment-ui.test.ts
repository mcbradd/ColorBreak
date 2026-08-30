import { createElement } from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { SellerView } from "./App";
import { calculateBreak } from "./domain/valuation";
import type { BreakAnalysis } from "./data/evaluate";

const analysis: BreakAnalysis = {
  valuation: calculateBreak({
    prices: [{ id: "white", set: "EOE", collectorNumber: "1", name: "White", slot: "W", nonfoil: 20, foil: null }],
    draws: [{ set: "EOE", collectorNumber: "1", copies: 1, foil: false, source: "fixed" }], threshold: 0,
  }),
  outcomeModel: { complete: true, packs: [], fixed: [{ id: "white", slot: "W", value: 20 }] }, outcomeOmissions: [],
};
const lines = [{ id: "eoe-play-box", set: "EOE", productKey: "play-booster-box", productLabel: "EOE Play Booster Box", quantity: 1, tcgId: 1, myCost: 30 }];
const view = () => createElement(SellerView, { analysis, lines, transactionCount: 8, add: () => {}, update: () => {}, remove: () => {} });

describe("Seller shipment reconciliation through public controls", () => {
  afterEach(() => { cleanup(); sessionStorage.clear(); });

  it("persists one shipment, derives reconciliation from it, and restores the missing blocker when removed", async () => {
    const first = render(view());
    fireEvent.click(screen.getByLabelText("White"));
    fireEvent.change(screen.getByLabelText("Receipt total"), { target: { value: "30" } });
    fireEvent.change(screen.getByLabelText("Actual fee from receipt or statement"), { target: { value: "3" } });
    fireEvent.change(screen.getByLabelText("Receipt reference"), { target: { value: "DEMO-RECEIPT-001" } });
    fireEvent.click(screen.getByRole("button", { name: "Record order" }));
    const order = await screen.findByRole("option", { name: "DEMO-RECEIPT-001" });
    fireEvent.change(screen.getByLabelText("Order to fulfill"), { target: { value: order.getAttribute("value") } });
    fireEvent.change(screen.getByLabelText("Actual postage"), { target: { value: "5" } });
    fireEvent.change(screen.getByLabelText("Actual packing"), { target: { value: "1" } });
    const submit = screen.getByRole("button", { name: "Record shipment" });
    expect(submit).toBeEnabled();
    fireEvent.click(submit);
    await waitFor(() => expect(screen.getByRole("list", { name: "Recorded shipments" })).toHaveTextContent("DEMO-RECEIPT-001 · $5.00 postage · $1.00 packing · $6.00 fulfillment"));
    expect(document.querySelector(".actual-result")).toHaveTextContent("0 order shipment missing");
    expect(document.querySelector(".actual-result")).toHaveTextContent("Actual profit / loss: -$9.00");
    first.unmount();

    render(view());
    expect(await screen.findByRole("list", { name: "Recorded shipments" })).toHaveTextContent("$6.00 fulfillment");
    fireEvent.click(within(screen.getByRole("list", { name: "Recorded shipments" })).getByRole("button", { name: "Remove / correct" }));
    await waitFor(() => expect(document.querySelector(".actual-result")).toHaveTextContent("1 order shipment missing"));
    expect(document.querySelector(".actual-result")).toHaveTextContent("Actual result unavailable");
  });
});
