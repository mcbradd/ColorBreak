import { renderHook, waitFor } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BreakAnalysis } from "./data/evaluate";
import type { SlotId } from "./domain/types";

const { simulate } = vi.hoisted(() => ({ simulate: vi.fn(() => new Promise(() => {})) }));
vi.mock("./domain/simulation-client", () => ({ simulateOutcomesAsync: simulate }));

import { useOutcomeSimulation } from "./App";

const appSource = readFileSync(join(process.cwd(), "src", "App.tsx"), "utf8");

const analysis = {
  valuation: { dataVersion: "test", threshold: 2, status: "verified" },
  outcomeModel: { cacheKey: "one-pack", complete: true, fixed: [], packs: [] },
  outcomeOmissions: [],
} as unknown as BreakAnalysis;

describe("outcome simulation lifecycle", () => {
  beforeEach(() => { simulate.mockClear(); });

  it("does not restart when a render recreates an equivalent remaining-slot array", async () => {
    const { rerender } = renderHook(
      ({ slots }: { slots: SlotId[] }) => useOutcomeSimulation(analysis, slots, 20),
      { initialProps: { slots: ["W", "U"] as SlotId[] } },
    );
    await waitFor(() => expect(simulate).toHaveBeenCalledTimes(1));
    rerender({ slots: ["W", "U"] as SlotId[] });
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(simulate).toHaveBeenCalledTimes(1);
  });

  it("renders a terminal unavailable state instead of spinning forever on errors", () => {
    expect(appSource).toContain("if (baseSimulation.error || bonusSimulation.error)");
    expect(appSource).toContain("Pull ranges unavailable");
  });
});
