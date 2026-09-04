import { createElement } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Composition } from "./features/buyer/BuyerVisuals";

describe("break composition", () => {
  it("removes the final line by stepping its quantity below one", async () => {
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

    // Quantity is the only removal control: a separate bin icon beside it was
    // a second control for the same job.
    expect(screen.queryByRole("button", { name: /Remove Play Booster Box from break/ })).toBe(
      screen.getByRole("button", { name: "Remove Play Booster Box from break" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Remove Play Booster Box from break" }));
    await waitFor(() => expect(remove).toHaveBeenCalledWith("only-line"));
  });
});

