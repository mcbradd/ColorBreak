import { describe, expect, it } from "vitest";
import {
  createSellerOperationalRun,
  lockSellerSpot,
  realizedSellerProfit,
  recordSellerSpotActual,
} from "./seller-workflow";

const basis = { kind: "cash" as const, amount: 80, source: "receipt" };
const measuredCosts = [{ id: "labor", label: "Labor", state: { kind: "measured" as const, amount: 10 } }];

describe("seller operational workflow", () => {
  it("moves a seller spot from target to locked to actual without mutating the prior run", () => {
    const target = createSellerOperationalRun("plan-r1", [{ id: "W", targetRevenue: 20 }]);
    const locked = lockSellerSpot(target, "W", "2026-08-29T19:00:00Z");
    const actual = recordSellerSpotActual(locked, "W", 22, "2026-08-29T19:01:00Z");
    expect(target.spots[0].state.kind).toBe("target");
    expect(locked.spots[0].state.kind).toBe("locked");
    expect(actual.spots[0].state).toMatchObject({ kind: "actual", actualRevenue: 22 });
    expect(actual.planRevision).toBe("plan-r1");
  });

  it("hides realized profit until every target is actual", () => {
    let run = createSellerOperationalRun("plan-r1", [
      { id: "W", targetRevenue: 20 }, { id: "U", targetRevenue: 20 },
    ]);
    run = lockSellerSpot(run, "W", "2026-08-29T19:00:00Z");
    run = recordSellerSpotActual(run, "W", 22, "2026-08-29T19:01:00Z");
    expect(realizedSellerProfit(run, basis, measuredCosts)).toEqual({ kind: "hidden", reason: "spots-incomplete" });
  });

  it("shows realized profit only with reconciled actual revenue and measured costs", () => {
    let run = createSellerOperationalRun("plan-r1", [{ id: "W", targetRevenue: 20 }]);
    run = lockSellerSpot(run, "W", "2026-08-29T19:00:00Z");
    run = recordSellerSpotActual(run, "W", 100, "2026-08-29T19:01:00Z");
    expect(realizedSellerProfit(run, basis, measuredCosts)).toEqual({ kind: "actual", amount: 10 });
    expect(realizedSellerProfit(run, basis, [
      { id: "labor", label: "Labor", state: { kind: "estimated", amount: 10 } },
    ])).toEqual({ kind: "hidden", reason: "costs-incomplete" });
  });
});
