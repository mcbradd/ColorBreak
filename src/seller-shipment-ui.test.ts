import { createElement } from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SellerView } from "./App";
import { calculateBreak } from "./domain/valuation";
import type { BreakAnalysis } from "./data/evaluate";
import { sellerPlanKey } from "./persistence";

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
    expect(screen.getByLabelText("Confirm shipment removal")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Confirm remove and correct" }));
    await waitFor(() => expect(document.querySelector(".actual-result")).toHaveTextContent("1 order shipment missing"));
    expect(document.querySelector(".actual-result")).toHaveTextContent("Actual result unavailable");
    cleanup();
    render(view());
    expect(await screen.findByRole("option", { name: "DEMO-RECEIPT-001" })).toBeInTheDocument();
    expect(document.querySelector(".actual-result")).toHaveTextContent("1 order shipment missing");
  });

  it("removes a persisted order transactionally with its shipment and restores the slot", async () => {
    const first = render(view());
    fireEvent.click(screen.getByLabelText("White"));
    fireEvent.change(screen.getByLabelText("Receipt total"), { target: { value: "40" } });
    fireEvent.change(screen.getByLabelText("Actual fee from receipt or statement"), { target: { value: "5" } });
    fireEvent.change(screen.getByLabelText("Receipt reference"), { target: { value: "L16-TEST-ORDER-001" } });
    fireEvent.click(screen.getByRole("button", { name: "Record order" }));
    const order = await screen.findByRole("option", { name: "L16-TEST-ORDER-001" });
    fireEvent.change(screen.getByLabelText("Order to fulfill"), { target: { value: order.getAttribute("value") } });
    fireEvent.change(screen.getByLabelText("Actual postage"), { target: { value: "6" } });
    fireEvent.change(screen.getByLabelText("Actual packing"), { target: { value: "2" } });
    fireEvent.click(screen.getByRole("button", { name: "Record shipment" }));
    await screen.findByRole("list", { name: "Recorded shipments" });
    fireEvent.click(within(screen.getAllByRole("list")[0]).getByRole("button", { name: "Remove / correct" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm remove and correct" }));
    await waitFor(() => expect(screen.queryByRole("list", { name: "Recorded shipments" })).toBeNull());
    expect(screen.getByLabelText("White")).not.toBeDisabled();
    expect(document.querySelector(".actual-result")).toHaveTextContent("0 sold and receipt-linked");
    first.unmount();
    render(view());
    expect(screen.queryByText("L16-TEST-ORDER-001")).toBeNull();
    expect(screen.getByLabelText("White")).not.toBeDisabled();
  });

  it("keeps the committed ledger and user draft intact when session persistence fails", async () => {
    render(view());
    fireEvent.click(screen.getByLabelText("White"));
    fireEvent.change(screen.getByLabelText("Receipt total"), { target: { value: "40" } });
    fireEvent.change(screen.getByLabelText("Actual fee from receipt or statement"), { target: { value: "5" } });
    fireEvent.change(screen.getByLabelText("Receipt reference"), { target: { value: "L16-TEST-WRITE-FAIL" } });
    const originalSetItem = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (key: string, value: string) {
      if (key === sellerPlanKey) throw new DOMException("quota", "QuotaExceededError");
      return originalSetItem.call(this, key, value);
    });
    fireEvent.click(screen.getByRole("button", { name: "Record order" }));
    expect(screen.getByRole("alert")).toHaveTextContent("could not save the reconciliation record");
    expect(screen.getByLabelText("White")).not.toBeDisabled();
    expect(screen.getByLabelText("Receipt total")).toHaveValue(40);
    expect(screen.getByLabelText("Receipt reference")).toHaveValue("L16-TEST-WRITE-FAIL");
    expect(JSON.parse(sessionStorage.getItem(sellerPlanKey)!).actualLedger).toEqual({ version: 1, orders: [], shipments: [] });
    vi.restoreAllMocks();
  });
});
