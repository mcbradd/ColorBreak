import { createElement as h } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { AnswerGroup, AnswerNote, AnswerProvider, AnswerValue } from "./features/shared/Answer";

it("collects repeated value caveats once and removes evidence for unmounted values", () => {
  const view = (show: boolean) => h(AnswerGroup, null,
    h(AnswerNote, { primary: true, detail: "Prices change." }),
    h(AnswerValue, { value: 10, detail: "Prices change." }),
    show && h(AnswerValue, { value: 20, detail: "This topper has no price." }));
  const { rerender } = render(view(true));
  expect(screen.getAllByRole("button")).toHaveLength(1);
  fireEvent.click(screen.getByRole("button"));
  expect(screen.getByRole("tooltip").textContent).toBe("Prices change.\n\nThis topper has no price.");
  fireEvent.keyDown(document, { key: "Escape" });
  rerender(view(false));
  fireEvent.click(screen.getByRole("button"));
  expect(screen.getByRole("tooltip")).not.toHaveTextContent("topper");
});

it("keeps nested card explanations independent and prioritizes named gaps over repeated math", () => {
  render(h(AnswerProvider, { value: ["The bonus pack has no price."] }, h(AnswerGroup, null,
    h(AnswerNote, { primary: true, label: "Section evidence" }),
    ...Array.from({ length: 12 }, (_, i) => h(AnswerValue, { key: i, value: i, detail: `Value ${i} is an average across possible openings.` })),
    h(AnswerGroup, null,
      h(AnswerNote, { primary: true, label: "Card evidence", detail: "This card uses a foil price estimate." }),
      h(AnswerValue, { value: 40, detail: "This treatment has no observed price." })))));
  expect(screen.getAllByRole("button")).toHaveLength(2);
  fireEvent.click(screen.getByRole("button", { name: "Section evidence" }));
  expect(screen.getByRole("tooltip")).toHaveTextContent("The bonus pack has no price.");
  expect(screen.getByRole("tooltip")).not.toHaveTextContent("This treatment");
  expect(screen.getByRole("tooltip").textContent!.split(/\s+/).length).toBeLessThanOrEqual(65);
  fireEvent.keyDown(document, { key: "Escape" });
  fireEvent.click(screen.getByRole("button", { name: "Card evidence" }));
  expect(screen.getByRole("tooltip")).toHaveTextContent("This treatment has no observed price.");
} );
