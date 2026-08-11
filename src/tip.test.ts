import { createElement } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
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
});
