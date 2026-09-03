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


function ClampedHarness() {
  const [value, setValue] = useState<number>(100);
  return createElement(
    "div",
    null,
    createElement(NumberField, {
      label: "Recovery",
      value,
      onChange: (next: number | undefined) => setValue(next ?? value),
      prefix: "%",
      max: 100,
    }),
    createElement("output", { "data-testid": "committed-value" }, value),
  );
}

describe("clearing a numeric field", () => {
  it("lets the keypad delete the last digit and accepts a single zero", () => {
    render(createElement(Harness));
    const input = screen.getByRole("textbox", { name: /Cost/ });
    input.focus();

    fireEvent.change(input, { target: { value: "10" } });
    fireEvent.change(input, { target: { value: "1" } });
    expect(input).toHaveValue("1");

    fireEvent.change(input, { target: { value: "" } });
    expect(input).toHaveValue("");

    fireEvent.change(input, { target: { value: "0" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(input).toHaveValue("0");
    expect(screen.getByTestId("committed-value")).toHaveTextContent("0");
  });

  it("restores the committed value when a cleared field is left empty", () => {
    render(createElement(ClampedHarness));
    const input = screen.getByRole("textbox", { name: /Recovery/ });
    input.focus();

    fireEvent.change(input, { target: { value: "" } });
    expect(input).toHaveValue("");

    fireEvent.blur(input);
    expect(input).toHaveValue("100");
    expect(screen.getByTestId("committed-value")).toHaveTextContent("100");
  });

  it("clamps an entry above the field maximum", () => {
    render(createElement(ClampedHarness));
    const input = screen.getByRole("textbox", { name: /Recovery/ });
    input.focus();

    fireEvent.change(input, { target: { value: "540" } });
    fireEvent.blur(input);

    expect(input).toHaveValue("100");
  });
});

describe("dismissing the numeric keypad", () => {
  it("offers a Done control only while the field is being edited", () => {
    render(createElement(Harness));
    const input = screen.getByRole("textbox", { name: /Cost/ });
    expect(screen.queryByRole("button", { name: /Done entering Cost/ })).toBeNull();

    fireEvent.focus(input);
    expect(screen.getByRole("button", { name: /Done entering Cost/ })).toBeInTheDocument();
  });

  it("commits the draft and releases focus when Done is pressed", () => {
    render(createElement(Harness));
    const input = screen.getByRole("textbox", { name: /Cost/ }) as HTMLInputElement;
    input.focus();
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "18.5" } });

    fireEvent.click(screen.getByRole("button", { name: /Done entering Cost/ }));

    expect(screen.getByTestId("committed-value")).toHaveTextContent("18.5");
    expect(input).not.toHaveFocus();
    expect(screen.queryByRole("button", { name: /Done entering Cost/ })).toBeNull();
  });
});
