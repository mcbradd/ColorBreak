import { createElement as h } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { expect, it } from "vitest";
import { AnswerGroup, AnswerNote, AnswerProvider, AnswerValue } from "./features/shared/Answer";
import { InformationButton } from "./features/shared/InformationLayer";
import { Tip } from "./features/shared/Primitives";

it("opens an amount with its exact value and evidence, then restores its caller", async () => {
  render(h(AnswerProvider, { value: ["The bonus pack has no price."] }, h(AnswerGroup, null,
    h(AnswerNote, { primary: true, detail: "Uses weighted pack outcomes." }),
    h(AnswerValue, { value: 1234.56, compact: true, detail: "Expected card value across openings." }))));
  const amount = screen.getByRole("button", { name: /Value details/ });
  fireEvent.click(amount);
  const dialog = screen.getByRole("dialog", { name: "Value details" });
  expect(dialog).toHaveTextContent("$1,234.56");
  expect(dialog).toHaveTextContent("Expected card value across openings.");
  expect(dialog).toHaveTextContent("The bonus pack has no price.");
  fireEvent.keyDown(document, { key: "Escape" });
  await waitFor(() => expect(amount).toHaveFocus());
  expect(screen.queryByRole("dialog")).toBeNull();
});

it.each(["close", "Escape", "outside"])("returns from nested information with %s, preserving both scroll axes and focus", async (method) => {
  render(h("div", { id: "root" }, h("div", { "data-testid": "scroll", style: { overflow: "auto" } },
    h(InformationButton, { title: "Product details", children: "Product name", content: h(AnswerValue, { value: 25, detail: "Latest observed sealed price." }) }))));
  const scroller = screen.getByTestId("scroll");
  scroller.scrollTop = 136; scroller.scrollLeft = 42;
  const product = screen.getByRole("button", { name: "Product details" });
  fireEvent.click(product);
  const price = screen.getByRole("button", { name: /Value details/ });
  fireEvent.click(price);
  expect(screen.getByRole("dialog", { name: "Value details" })).toBeInTheDocument();
  expect(document.getElementById("root")).toHaveAttribute("inert");
  if (method === "close") fireEvent.click(screen.getByRole("button", { name: "Close Value details" }));
  else if (method === "Escape") fireEvent.keyDown(document, { key: "Escape" });
  else fireEvent.click(screen.getByRole("dialog", { name: "Value details" }).parentElement!);
  await waitFor(() => expect(price).toHaveFocus());
  expect(screen.getByRole("dialog", { name: "Product details" })).toBeInTheDocument();
  expect(document.getElementById("root")).toHaveAttribute("inert");
  scroller.scrollTop = 0; scroller.scrollLeft = 0;
  fireEvent.click(screen.getByRole("button", { name: "Close Product details" }));
  await waitFor(() => expect(product).toHaveFocus());
  expect(scroller.scrollTop).toBe(136);
  expect(scroller.scrollLeft).toBe(42);
  expect(document.getElementById("root")).not.toHaveAttribute("inert");
});

it("dismisses help before its owning information layer", () => {
  render(h(InformationButton, { title: "Break details", children: "Break", content: h(Tip, { label: "Calculation help", text: "Uses known cards." }) }));
  fireEvent.click(screen.getByRole("button", { name: "Break details" }));
  fireEvent.click(screen.getByRole("button", { name: "Calculation help" }));
  fireEvent.keyDown(document, { key: "Escape" });
  expect(screen.queryByRole("tooltip")).toBeNull();
  expect(screen.getByRole("dialog", { name: "Break details" })).toBeInTheDocument();
});
