import { simulateOutcomes } from "./simulation";
import type { PackOutcomeModel, SimulationOptions, SimulationResult } from "./simulation";

let nextId = 1;
let worker: Worker | null = null;
const WORKER_TIMEOUT_MS = 12_000;
const pending = new Map<number, { resolve: (result: SimulationResult) => void; reject: (error: Error) => void; timeout: ReturnType<typeof setTimeout> }>();
const cache = new Map<string, Promise<SimulationResult>>();

function failWorker(error: Error): void {
  for (const request of pending.values()) {
    clearTimeout(request.timeout);
    request.reject(error);
  }
  pending.clear();
  worker?.terminate();
  worker = null;
}

function simulationWorker(): Worker | null {
  if (typeof Worker === "undefined") return null;
  if (!worker) {
    worker = new Worker(new URL("./simulation.worker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (event: MessageEvent<{ id: number; result?: SimulationResult; error?: string }>) => {
      const request = pending.get(event.data.id);
      if (!request) return;
      pending.delete(event.data.id);
      clearTimeout(request.timeout);
      if (event.data.result) request.resolve(event.data.result);
      else request.reject(new Error(event.data.error ?? "Simulation failed"));
    };
    worker.onerror = () => failWorker(new Error("Distribution worker unavailable"));
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
      const timeout = setTimeout(() => failWorker(new Error("Pull-range calculation took too long and was stopped.")), WORKER_TIMEOUT_MS);
      pending.set(id, { resolve, reject, timeout });
      try {
        active.postMessage({ id, model, options });
      } catch (error) {
        failWorker(error instanceof Error ? error : new Error(String(error)));
      }
    });
  })();
  cache.set(cacheKey, request);
  if (cache.size > 12) cache.delete(cache.keys().next().value!);
  request.catch(() => cache.delete(cacheKey));
  return request;
}
