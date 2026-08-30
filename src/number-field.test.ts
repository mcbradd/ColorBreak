import { createElement, useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { NumberField } from "./features/shared/Primitives";

function Harness() {
  const [value, setValue] = useState<number>();
  return createElement(
    "div",
    null,
    createElement(NumberField, {
      label: "Cost",
      value,
      onChange: setValue,
    }),
    createElement("output", { "data-testid": "committed-value" }, value),
  );
}

describe("mobile numeric entry", () => {
  it("preserves a decimal draft and commits it with Enter", () => {
    render(createElement(Harness));
    const input = screen.getByRole("textbox", { name: /Cost/ });
    input.focus();

    fireEvent.change(input, { target: { value: "12." } });
    expect(input).toHaveValue("12.");
    expect(screen.getByTestId("committed-value")).toBeEmptyDOMElement();

    fireEvent.change(input, { target: { value: "12.5" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(input).toHaveValue("12.5");
    expect(screen.getByTestId("committed-value")).toHaveTextContent("12.5");
    expect(input).not.toHaveFocus();
  });

  it("accepts a locale decimal comma and normalizes it on blur", () => {
    render(createElement(Harness));
    const input = screen.getByRole("textbox", { name: /Cost/ });
    input.focus();

    fireEvent.change(input, { target: { value: "7,25" } });
    fireEvent.blur(input);

    expect(input).toHaveValue("7.25");
    expect(screen.getByTestId("committed-value")).toHaveTextContent("7.25");
  });

  it("commits with Enter even when the browser does not deliver a blur event", () => {
    render(createElement(Harness));
    const input = screen.getByRole("textbox", { name: /Cost/ }) as HTMLInputElement;
    input.focus();
    const blur = vi.spyOn(input, "blur").mockImplementation(() => undefined);

    fireEvent.change(input, { target: { value: "12.50" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(blur).toHaveBeenCalledOnce();
    expect(screen.getByTestId("committed-value")).toHaveTextContent("12.5");
  });
});

