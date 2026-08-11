/// <reference lib="webworker" />
import { simulateOutcomes } from "./simulation";
import type { PackOutcomeModel, SimulationOptions } from "./simulation";

self.onmessage = (event: MessageEvent<{ id: number; model: PackOutcomeModel; options: SimulationOptions }>) => {
  const { id, model, options } = event.data;
  try {
    self.postMessage({ id, result: simulateOutcomes(model, options) });
  } catch (error) {
    self.postMessage({ id, error: error instanceof Error ? error.message : String(error) });
  }
};

export {};
