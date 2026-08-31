import { describe, expect, it } from "vitest";
import {
  compareNextBid,
  empiricalValueTarget,
  recommendBid,
  solveFinancialCap,
  updateActiveCeiling,
} from "./buyer-treatment";

describe("V2 buyer treatment", () => {
  it("solves the highest safe hammer when tax depends on hammer", () => {
    const result = solveFinancialCap({
      valueTarget: 24,
      acceptedAmounts: Array.from({ length: 30 }, (_, index) => index + 1),
      addedCost: (hammer) => 3 + hammer * .1,
    });

    expect(result).toEqual({ kind: "cap", amount: 19, allInAtCap: 23.9 });
  });

  it("distinguishes unknown cost from an empty feasible bid domain", () => {
    expect(solveFinancialCap({
      valueTarget: 24,
      acceptedAmounts: [1, 2, 3],
    })).toEqual({ kind: "unknown-cost" });
    expect(solveFinancialCap({
      valueTarget: 3.5,
      acceptedAmounts: [1, 2, 3],
      addedCost: () => 3,
    })).toEqual({ kind: "no-room" });
  });

  it("uses deterministic observed order statistics", () => {
    const samples = [0, 10, 20, 40];
    expect(empiricalValueTarget(samples, { kind: "median" })).toEqual({ value: 10, coverage: .75 });
    expect(empiricalValueTarget(samples, { kind: "coverage", coverage: .75 })).toEqual({ value: 10, coverage: .75 });
    expect(empiricalValueTarget(samples, { kind: "coverage", coverage: .9 })).toEqual({ value: 0, coverage: 1 });
    expect(empiricalValueTarget(samples, { kind: "average" })).toEqual({ value: 17.5, coverage: .5 });
  });

  it("compares the next total bid with mutually exclusive states", () => {
    expect(compareNextBid(23, 24)).toEqual({ kind: "under", difference: 1 });
    expect(compareNextBid(24, 24)).toEqual({ kind: "at", difference: 0 });
    expect(compareNextBid(25, 24)).toEqual({ kind: "over", difference: 1 });
  });

  it("never raises an accepted cap without adoption and invalidates it on refusal", () => {
    const saved = { amount: 24, revision: "R1" };
    expect(updateActiveCeiling(saved, { kind: "cap", amount: 27, allInAtCap: 27 }, "R2"))
      .toEqual({ saved, active: { amount: 24, revision: "R2" } });
    expect(updateActiveCeiling(saved, { kind: "cap", amount: 21, allInAtCap: 21 }, "R3"))
      .toEqual({ saved, active: { amount: 21, revision: "R3" } });
    expect(updateActiveCeiling(saved, { kind: "unknown-cost" }, "R4"))
      .toEqual({ saved, active: undefined });
  });

  it("turns the cap comparison into one fast auction action", () => {
    expect(recommendBid(undefined, { kind: "cap", amount: 18, allInAtCap: 22 }))
      .toEqual({ action: "enter-bid", tone: "neutral" });
    expect(recommendBid(12, { kind: "cap", amount: 18, allInAtCap: 22 }))
      .toEqual({ action: "bid", tone: "positive", room: 6 });
    expect(recommendBid(18, { kind: "cap", amount: 18, allInAtCap: 22 }))
      .toEqual({ action: "stop", tone: "warning", room: 0 });
    expect(recommendBid(19, { kind: "cap", amount: 18, allInAtCap: 22 }))
      .toEqual({ action: "pass", tone: "negative", room: -1 });
    expect(recommendBid(12, { kind: "unknown-cost" }))
      .toEqual({ action: "unknown-cost", tone: "neutral" });
    expect(recommendBid(12, { kind: "no-room" }))
      .toEqual({ action: "no-room", tone: "negative" });
  });

  it("treats a resolved no-room cap as distinct from a genuinely unknown one", () => {
    // Shipping alone meets or exceeds the modeled value: fully resolved, not missing data.
    const noRoom = solveFinancialCap({ valueTarget: 5, acceptedAmounts: [1, 2, 3], addedCost: () => 5 });
    expect(noRoom).toEqual({ kind: "no-room" });
    expect(recommendBid(undefined, noRoom)).toEqual({ action: "no-room", tone: "negative" });
    // No cost function at all: genuinely unknown, must not collapse to the same state.
    const unknown = solveFinancialCap({ valueTarget: 5, acceptedAmounts: [1, 2, 3] });
    expect(unknown).toEqual({ kind: "unknown-cost" });
    expect(recommendBid(undefined, unknown)).toEqual({ action: "unknown-cost", tone: "neutral" });
  });
});
