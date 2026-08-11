import { createElement } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Composition } from "./App";

describe("break composition", () => {
  it("explicitly removes the final line without overloading quantity controls", () => {
    const remove = vi.fn();
    render(createElement(Composition, {
      lines: [{
        id: "only-line",
        set: "TST",
        productKey: "box",
        productLabel: "Play Booster Box",
        quantity: 1,
      }],
      add: vi.fn(),
      update: vi.fn(),
      remove,
    }));

    expect(
      screen.getByRole("button", { name: "Decrease Play Booster Box quantity" }),
    ).toBeDisabled();
    fireEvent.click(
      screen.getByRole("button", { name: "Remove Play Booster Box from break" }),
    );
    expect(remove).toHaveBeenCalledWith("only-line");
  });
});
