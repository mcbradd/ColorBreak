import { describe, expect, it } from "vitest";
import {
  actualNetProfit,
  decisionBasisForOwnedInventory,
  modeledContributionProfit,
  plannedNetProfit,
  summarizeCostLedger,
  type CostLine,
} from "./seller-economics";

const completeLines: CostLine[] = [
  { id: "labor", label: "Labor", state: { kind: "measured", amount: 25 } },
  { id: "refund", label: "Refund allowance", state: { kind: "measured", amount: 15 } },
];

describe("V2 seller cost ledger", () => {
  it("chooses the highest credible owned-inventory opportunity cost without adding cash cost", () => {
    expect(decisionBasisForOwnedInventory([
      { amount: 150, source: "replacement quote" },
      { amount: 180, source: "sealed sale net" },
    ])).toMatchObject({ amount: 180, source: "sealed sale net" });

    expect(modeledContributionProfit(
      { kind: "seller-hammer-hypothesis", amount: 170 },
      decisionBasisForOwnedInventory([{ amount: 180, source: "sealed sale net" }]),
      [],
    )).toMatchObject({ label: "Modeled contribution profit", amount: -10 });
  });

  it("subtracts every resolved leaf for planned net and flips the target fixture", () => {
    expect(plannedNetProfit(
      { kind: "seller-hammer-hypothesis", amount: 100 },
      { kind: "decision", ownership: "committed-acquisition", amount: 0, source: "invoice" },
      completeLines,
    )).toMatchObject({ label: "Planned net profit", amount: 60 });
  });

  it("keeps a blank required leaf unknown while explicit zero is complete", () => {
    const basis = { kind: "decision" as const, ownership: "committed-acquisition" as const, amount: 0, source: "invoice" };
    expect(plannedNetProfit({ kind: "seller-hammer-hypothesis", amount: 100 }, basis, [
      { id: "labor", label: "Labor", state: { kind: "unknown" } },
    ])).toMatchObject({ label: "Modeled contribution profit", ledger: { unknown: ["labor"] } });
    expect(plannedNetProfit({ kind: "seller-hammer-hypothesis", amount: 100 }, basis, [
      { id: "labor", label: "Labor", state: { kind: "measured", amount: 0 } },
    ])).toMatchObject({ label: "Planned net profit", amount: 100 });
  });

  it("counts included costs only through their ancestor and rejects inclusion cycles", () => {
    expect(summarizeCostLedger([
      { id: "postage", label: "Postage", state: { kind: "measured", amount: 12 } },
      { id: "packing", label: "Packing", state: { kind: "included-in", lineId: "postage" } },
    ])).toMatchObject({ total: 12 });
    expect(() => summarizeCostLedger([
      { id: "a", label: "A", state: { kind: "included-in", lineId: "b" } },
      { id: "b", label: "B", state: { kind: "included-in", lineId: "a" } },
    ])).toThrow("cycle");
  });

  it("does not let a required included leaf hide an unknown ancestor", () => {
    expect(summarizeCostLedger([
      { id: "postage", label: "Postage", required: false, state: { kind: "unknown" } },
      { id: "packing", label: "Packing", state: { kind: "included-in", lineId: "postage" } },
    ])).toMatchObject({ unknown: ["packing"] });
  });

  it("refuses to call estimated costs actual net and does not treat a start as revenue", () => {
    const basis = { kind: "cash" as const, amount: 80, source: "receipt" };
    expect(actualNetProfit({ kind: "actual-hammer", amount: 120 }, basis, [
      { id: "labor", label: "Labor", state: { kind: "estimated", amount: 10 } },
    ])).toMatchObject({ label: "Provisional actuals", amount: 30 });
    expect(modeledContributionProfit({ kind: "start", amount: 20 }, basis, [])).toMatchObject({ label: "No conditional profit status" });
  });
});
