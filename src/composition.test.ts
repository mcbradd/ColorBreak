import { createElement } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { QuickBreakComposer } from "./features/shared/QuickBreakComposer";

describe("break composition", () => {
  it("removes the final line by stepping its quantity below one", async () => {
    const remove = vi.fn();
    render(createElement(QuickBreakComposer, {
      lines: [{
        id: "only-line",
        set: "TST",
        productKey: "box",
        productLabel: "Play Booster Box",
        quantity: 1,
      }],
      onImport: vi.fn(),
      onChange: remove,
    }));

    // Quantity is the only removal control: a separate bin icon beside it was
    // a second control for the same job.
    expect(screen.queryByRole("button", { name: /Remove TST Play Booster Box from break/ })).toBe(
      screen.getByRole("button", { name: "Remove TST Play Booster Box from break" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Remove TST Play Booster Box from break" }));
    await waitFor(() => expect(remove).toHaveBeenCalledWith([]));
  });
});

