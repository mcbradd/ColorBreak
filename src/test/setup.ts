import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach } from "vitest";

beforeEach(() => {
  if (typeof history !== "undefined") history.replaceState(null, "", "/");
  if (typeof sessionStorage !== "undefined") sessionStorage.clear();
  if (typeof localStorage !== "undefined") localStorage.clear();
  if (typeof window !== "undefined") Object.defineProperty(window, "scrollTo", { configurable: true, value: () => undefined });
});
afterEach(cleanup);
