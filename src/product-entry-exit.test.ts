import { createElement } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
vi.mock("./data/catalog", () => ({
  catalogSets: async () => [{ code: "EOE", name: "Edge of Eternities", released: "2025-08-01", type: "expansion" }],
  productsForSet: async () => [{ key: "pack", set: "EOE", setName: "Edge of Eternities", label: "Play Booster Pack", category: "pack", packCount: 1 }],
}));
vi.mock("./domain/decision-evidence", () => ({ prepareProductSelection: () => new Promise(() => {}) }));
import { Builder } from "./features/shared/ProductBuilder";
afterEach(cleanup);

it.each(["Done", "Close", "Escape"])("%s closes immediately with selected products while price preparation is unresolved", async (exit) => {
  const onClose = vi.fn(), onApply = vi.fn();
  render(createElement(Builder, { open: true, lines: [], onClose, onApply }));
  fireEvent.click(await screen.findByRole("button", { name: /Edge of Eternities/ }));
  fireEvent.click(await screen.findByRole("button", { name: "Play Booster Pack", exact: true }));
  if (exit === "Escape") fireEvent.keyDown(document, { key: "Escape" });
  else fireEvent.click(screen.getByRole("button", { name: exit, exact: true }));
  expect(onClose).toHaveBeenCalledOnce();
  expect(onApply.mock.calls[0][0][0]).toMatchObject({ set: "EOE", quantity: 1 });
});
