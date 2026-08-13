import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { evaluateBreakAnalysis } from "./data/evaluate";
import { simulateOutcomes } from "./domain/simulation";

describe("FDN Play Booster Box pull range", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (/^https?:/.test(url)) return new Response("unavailable", { status: 503 });
      try {
        const data = await readFile(join(process.cwd(), url.replace(/^\.\//, "")));
        return new Response(data, { status: 200, headers: { "Content-Type": "application/json" } });
      } catch {
        return new Response("missing", { status: 404 });
      }
    }));
  });

  afterEach(() => vi.unstubAllGlobals());

  it("finishes the initial 10,000-sample range before the worker cutoff", async () => {
    const analysis = await evaluateBreakAnalysis([{
      id: "fdn-box",
      set: "FDN",
      productKey: "sealed:play-booster-box",
      productLabel: "Play Booster Box",
      quantity: 1,
      tcgId: 562118,
    }], 2);
    expect(analysis.outcomeModel.complete).toBe(true);
    const sheetStats = analysis.outcomeModel.packs.flatMap((pack) => Object.entries(pack.sheets).map(([name, sheet]) => ({
      name,
      count: pack.count,
      cards: sheet.cards.length,
      allowDuplicates: sheet.allowDuplicates === true,
      maxPicks: Math.max(...pack.variants.map((variant) => variant.picks[name] ?? 0)),
    })));
    expect(sheetStats.length).toBeGreaterThan(0);
    const started = performance.now();
    const result = simulateOutcomes(analysis.outcomeModel, {
      seed: "fdn-play-box-regression",
      sampleCount: 10_000,
      remaining: ["W", "U", "B", "R", "G", "M", "C", "L"],
    });
    const elapsed = performance.now() - started;

    expect(result.sampleCount).toBe(10_000);
    expect(elapsed * 3, `FDN initial pull range took ${Math.round(elapsed)}ms without mobile headroom`).toBeLessThan(12_000);
  }, 60_000);
});
