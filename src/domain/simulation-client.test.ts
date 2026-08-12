import { afterEach, describe, expect, it, vi } from "vitest";
import type { PackOutcomeModel } from "./simulation";

class SilentWorker {
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  terminate = vi.fn();
  postMessage = vi.fn();
}

const model: PackOutcomeModel = { cacheKey: "timeout-test", complete: true, fixed: [], packs: [] };

describe("simulation worker safety", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("rejects and terminates a worker that never answers", async () => {
    vi.useFakeTimers();
    const instance = new SilentWorker();
    function WorkerStub() { return instance; }
    vi.stubGlobal("Worker", WorkerStub);
    const { simulateOutcomesAsync } = await import("./simulation-client");
    const request = simulateOutcomesAsync(model, { seed: "timeout", sampleCount: 10_000, remaining: ["W"] });
    const rejection = expect(request).rejects.toThrow("took too long");
    await vi.advanceTimersByTimeAsync(12_000);
    await rejection;
    expect(instance.terminate).toHaveBeenCalledOnce();
  });
});
