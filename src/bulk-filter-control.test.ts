import { createElement } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BulkFilterControl } from "./features/buyer/BuyerDetails";
import { calculateBreak } from "./domain/valuation";

const result = calculateBreak({
  threshold: 2,
  prices: [{ id: "w", set: "TST", collectorNumber: "1", name: "White", slot: "W", nonfoil: 3, foil: null }],
  draws: [{ set: "TST", collectorNumber: "1", copies: 1, foil: false, source: "test" }],
});

describe("combined bulk filter control", () => {
  it("makes the toggle, editable value, help, and details available together", () => {
    const onToggle = vi.fn();
    const onThreshold = vi.fn();
    render(createElement(BulkFilterControl, { enabled: true, threshold: 2, result, onToggle, onThreshold }));
    fireEvent.click(screen.getByRole("switch", { name: /Bulk filter/ }));
    expect(onToggle).toHaveBeenCalledWith(false);
    const input = screen.getByLabelText("Bulk filter dollar amount");
    fireEvent.change(input, { target: { value: "1.5" } });
    fireEvent.blur(input);
    expect(onThreshold).toHaveBeenCalledWith(1.5);
    expect(screen.getByRole("button", { name: "Explain the current bulk filter setting" })).toBeInTheDocument();
    fireEvent.click(screen.getByText("See what the filter changes"));
    expect(screen.getByText("All priced card value")).toBeInTheDocument();
    expect(screen.getByText("Value used by ColorBreak")).toBeInTheDocument();
  });
});

