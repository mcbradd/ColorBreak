import { createElement } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Tip } from "./App";

describe("info tooltip", () => {
  it("renders outside overflow-clipping panels when opened", () => {
    const { container } = render(
      createElement(
        "section",
        { className: "panel" },
        createElement(Tip, { text: "Complete explanatory copy" }),
      ),
    );
    const trigger = screen.getByLabelText("Complete explanatory copy");

    fireEvent.click(trigger);

    const tooltip = screen.getByRole("tooltip");
    expect(container.querySelector(".panel")!.contains(tooltip)).toBe(false);

    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("does not activate a numeric input when tapped inside its label", () => {
    const inputActivation = vi.fn();
    render(
      createElement(
        "label",
        null,
        "Ignore bulk under",
        createElement("input", { inputMode: "decimal", onClick: inputActivation }),
        createElement(Tip, { text: "Threshold explanation" }),
      ),
    );

    const defaultAllowed = fireEvent.click(
      screen.getByLabelText("Threshold explanation"),
    );

    expect(screen.getByRole("tooltip")).toBeInTheDocument();
    expect(defaultAllowed).toBe(false);
    expect(inputActivation).not.toHaveBeenCalled();
  });
});
