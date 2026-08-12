import { createElement } from "react";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Tip, ValueSummary } from "./App";
import { calculateBreak } from "./domain/valuation";

describe("help hierarchy", () => {
  it("does not add a second question-mark icon inside informational pills", () => {
    const { container } = render(
      createElement(Tip, { text: "Explanation" }, createElement("span", null, "Verified")),
    );
    expect(container.querySelector(".tip-help-icon")).not.toBeInTheDocument();
  });

  it("keeps narrow value metrics free of separate question-mark columns", () => {
    const result = calculateBreak({
      threshold: 2,
      prices: [{ id: "card", set: "TST", collectorNumber: "1", name: "Card", slot: "W", nonfoil: 5, foil: null }],
      draws: [{ set: "TST", collectorNumber: "1", copies: 1, foil: false, source: "test" }],
    });
    const { container } = render(createElement(ValueSummary, { result }));
    expect(container.querySelectorAll(".metric-row .tip-icon")).toHaveLength(0);
    expect(container.querySelector(".panel-heading")).toBeInTheDocument();
  });
});
