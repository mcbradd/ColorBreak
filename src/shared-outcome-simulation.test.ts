import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BreakAnalysis } from "./data/evaluate";
import { simulateOutcomes, type SimulationResult } from "./domain/simulation";
import { calculateBreak } from "./domain/valuation";

const mocks = vi.hoisted(() => ({ simulate: vi.fn() }));
vi.mock("./domain/simulation-client", () => ({ simulateOutcomesAsync: mocks.simulate }));
import { useOutcomeSimulation } from "./features/shared/OutcomeFeedback";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((onResolve, onReject) => { resolve = onResolve; reject = onReject; });
  return { promise, resolve, reject };
}

function analysis(version: string): BreakAnalysis {
  return {
    valuation: calculateBreak({ draws: [], prices: [], dataVersion: version }),
    outcomeModel: { cacheKey: version, complete: true, fixed: [], packs: [] },
    outcomeOmissions: [],
    priceAvailability: { status: "available", source: "snapshot", message: "Available" },
  };
}

const original = analysis("one box");
const updated = analysis("two boxes");
const firstResult = simulateOutcomes(original.outcomeModel, { seed: "first", remaining: ["W"], sampleCount: 1 });
const secondResult = simulateOutcomes(updated.outcomeModel, { seed: "second", remaining: ["W"], sampleCount: 1 });

describe("shared pull-range ownership", () => {
  beforeEach(() => mocks.simulate.mockReset());
  afterEach(() => { cleanup(); vi.useRealTimers(); });

  it("submits only the final model when quantity changes arrive during settling", async () => {
    vi.useFakeTimers();
    const final = analysis("three boxes");
    mocks.simulate.mockResolvedValue(secondResult);
    const { result, rerender } = renderHook(
      ({ value }) => useOutcomeSimulation(value, ["W"], undefined, 180),
      { initialProps: { value: original } },
    );
    expect(result.current.busy).toBe(true);
    expect(result.current.current).toBe(false);
    await act(async () => { await vi.advanceTimersByTimeAsync(120); });
    rerender({ value: updated });
    await act(async () => { await vi.advanceTimersByTimeAsync(120); });
    rerender({ value: final });
    await act(async () => { await vi.advanceTimersByTimeAsync(179); });
    expect(mocks.simulate).not.toHaveBeenCalled();
    expect(result.current.busy).toBe(true);
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(mocks.simulate).toHaveBeenCalledTimes(1);
    expect(mocks.simulate).toHaveBeenCalledWith(final.outcomeModel, expect.objectContaining({ sampleCount: 10_000, remaining: ["W"] }));
    expect(result.current.current).toBe(true);
    expect(result.current.busy).toBe(false);
  });

  it("does not submit a delayed simulation after its view unmounts", async () => {
    vi.useFakeTimers();
    mocks.simulate.mockResolvedValue(firstResult);
    const { unmount } = renderHook(() => useOutcomeSimulation(original, ["W"], undefined, 180));
    unmount();
    await act(async () => { await vi.advanceTimersByTimeAsync(180); });
    expect(mocks.simulate).not.toHaveBeenCalled();
  });

  it("immediately replaces a different mix with its analytic preview while sampling", async () => {
    const next = deferred<SimulationResult>();
    mocks.simulate.mockResolvedValueOnce(firstResult).mockReturnValueOnce(next.promise);
    const { result, rerender } = renderHook(({ value }) => useOutcomeSimulation(value, ["W"], undefined), { initialProps: { value: original } });
    await waitFor(() => expect(result.current.current).toBe(true));
    expect(result.current.result).toBe(firstResult);
    rerender({ value: updated });
    expect(result.current.current).toBe(false);
    expect(result.current.busy).toBe(true);
    expect(result.current.result?.sampleCount).toBe(0);
    expect(result.current.result?.remainingPool.preview).toBe(true);
    await act(async () => next.resolve(secondResult));
    expect(result.current.current).toBe(true);
    expect(result.current.busy).toBe(false);
    expect(result.current.result).toBe(secondResult);
  });

  it("ignores an obsolete result that finishes after the newer range", async () => {
    const old = deferred<SimulationResult>();
    const next = deferred<SimulationResult>();
    mocks.simulate.mockReturnValueOnce(old.promise).mockReturnValueOnce(next.promise);
    const { result, rerender } = renderHook(({ value }) => useOutcomeSimulation(value, ["W"], undefined), { initialProps: { value: original } });
    rerender({ value: updated });
    await act(async () => next.resolve(secondResult));
    await act(async () => old.resolve(firstResult));
    expect(result.current.result).toBe(secondResult);
    expect(result.current.current).toBe(true);
  });

  it("stops loading on failure and makes a retry noncurrent until its result arrives", async () => {
    const next = deferred<SimulationResult>();
    const retry = deferred<SimulationResult>();
    mocks.simulate.mockResolvedValueOnce(firstResult).mockReturnValueOnce(next.promise).mockReturnValueOnce(retry.promise);
    const { result, rerender } = renderHook(({ value }) => useOutcomeSimulation(value, ["W"], undefined), { initialProps: { value: original } });
    await waitFor(() => expect(result.current.current).toBe(true));
    rerender({ value: updated });
    await act(async () => next.reject(new Error("Worker unavailable")));
    expect(result.current.current).toBe(false);
    expect(result.current.busy).toBe(false);
    expect(result.current.error).toBe("Worker unavailable");
    expect(result.current.result?.remainingPool.mean).toBe(0);
    expect(result.current.result?.remainingPool.preview).toBe(true);
    act(() => result.current.retry());
    expect(result.current.current).toBe(false);
    expect(result.current.busy).toBe(true);
    expect(result.current.error).toBeUndefined();
    await act(async () => retry.resolve(secondResult));
    expect(result.current.current).toBe(true);
  });
  it("retains a sampled answer when retrying the same model fails", async () => {
    const retry = deferred<SimulationResult>();
    mocks.simulate.mockResolvedValueOnce(firstResult).mockReturnValueOnce(retry.promise);
    const { result } = renderHook(() => useOutcomeSimulation(original, ["W"], undefined));
    await waitFor(() => expect(result.current.current).toBe(true));
    act(() => result.current.retry());
    expect(result.current.result).toBe(firstResult);
    await act(async () => retry.reject(new Error("Offline")));
    expect(result.current.result).toBe(firstResult);
    expect(result.current.busy).toBe(false);
    expect(result.current.error).toBe("Offline");
  });

});
