import { simulateOutcomes } from "./simulation";
import type { PackOutcomeModel, SimulationOptions, SimulationResult } from "./simulation";

let nextId = 1;
let worker: Worker | null = null;
const pending = new Map<number, { resolve: (result: SimulationResult) => void; reject: (error: Error) => void }>();
const cache = new Map<string, Promise<SimulationResult>>();

function simulationWorker(): Worker | null {
  if (typeof Worker === "undefined") return null;
  if (!worker) {
    worker = new Worker(new URL("./simulation.worker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (event: MessageEvent<{ id: number; result?: SimulationResult; error?: string }>) => {
      const request = pending.get(event.data.id);
      if (!request) return;
      pending.delete(event.data.id);
      if (event.data.result) request.resolve(event.data.result);
      else request.reject(new Error(event.data.error ?? "Simulation failed"));
    };
    worker.onerror = () => {
      for (const request of pending.values()) request.reject(new Error("Distribution worker unavailable"));
      pending.clear();
      worker?.terminate();
      worker = null;
    };
  }
  return worker;
}

export function simulateOutcomesAsync(model: PackOutcomeModel, options: SimulationOptions): Promise<SimulationResult> {
  const cacheKey = `${options.seed}|${options.sampleCount}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;
  const request = (() => {
    const active = simulationWorker();
    if (!active) return Promise.resolve(simulateOutcomes(model, options));
    const id = nextId++;
    return new Promise<SimulationResult>((resolve, reject) => {
      pending.set(id, { resolve, reject });
      active.postMessage({ id, model, options });
    });
  })();
  cache.set(cacheKey, request);
  if (cache.size > 12) cache.delete(cache.keys().next().value!);
  request.catch(() => cache.delete(cacheKey));
  return request;
}
