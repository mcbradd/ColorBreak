import { createElement as h } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { expect, it } from "vitest";
import { CommandPanel } from "./features/shared/CommandPanel";

it("reveals and focuses the exact field addressed by a panel link", async () => {
  render(h(CommandPanel, { panels: [{ id: "products", label: "Break", target: "products" }, { id: "plan", label: "Plan", target: "plan" }] },
    h("div", { id: "products", "data-command-panel": "products", tabIndex: -1 }, h("a", { href: "#actual-cost" }, "Enter your cost")),
    h("div", { id: "plan", "data-command-panel": "plan", tabIndex: -1 }, h("input", { id: "actual-cost", "aria-label": "Actual cost" }))));
  fireEvent.click(screen.getByRole("link", { name: "Enter your cost" }));
  await waitFor(() => expect(screen.getByRole("textbox", { name: "Actual cost" })).toHaveFocus());
  expect(screen.getByRole("button", { name: "Plan panel" })).toHaveAttribute("aria-pressed", "true");
});

it("returns to an available panel when the selected format removes Teams", () => {
  const panels = [{ id: "products", label: "Break", target: "products" }, { id: "teams", label: "Teams", target: "teams" }];
  const { rerender, container } = render(h(CommandPanel, { panels, children: "Panels" }));
  fireEvent.click(screen.getByRole("button", { name: "Teams panel" }));
  rerender(h(CommandPanel, { panels: panels.slice(0, 1), children: "Panels" }));
  expect(screen.getByRole("button", { name: "Break panel" })).toHaveAttribute("aria-pressed", "true");
  expect(container.querySelector(".command-panels")).toHaveAttribute("data-active-panel", "products");
});
