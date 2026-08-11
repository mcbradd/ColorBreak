import { createElement, useState } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CardInspector } from "./App";
import type { Contributor } from "./domain/types";

const card: Contributor = {
  card: {
    id: "card-1",
    set: "TST",
    collectorNumber: "1",
    name: "Mobile Chase",
    slot: "G",
    nonfoil: 24.5,
    foil: 61,
    image: "https://example.com/card.jpg",
  },
  copies: 0.42,
  sellableCopies: 0.42,
  marketValue: 10.29,
  sellableValue: 10.29,
  foilCopies: 0,
  sellableFoilCopies: 0,
  pullProbability: 0.36,
  sellablePullProbability: 0.36,
};

function Harness() {
  const [open, setOpen] = useState(false);
  return createElement(
    "div",
    null,
    createElement("button", { onClick: () => setOpen(true) }, "Mobile Chase"),
    createElement(CardInspector, {
      row: open ? card : null,
      status: "verified",
      threshold: 2,
      onClose: () => setOpen(false),
    }),
  );
}

describe("card inspector", () => {
  it("shows live card context and returns to the exact invoking position", async () => {
    Object.defineProperty(window, "scrollY", { configurable: true, value: 240 });
    const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    render(createElement(Harness));
    const opener = screen.getByRole("button", { name: "Mobile Chase" });
    opener.focus();
    fireEvent.click(opener);

    const dialog = screen.getByRole("dialog", { name: "Mobile Chase" });
    expect(screen.getByText("36.0%")).toBeInTheDocument();
    expect(screen.getByText("$24.50")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Mobile Chase card" })).toBeInTheDocument();

    fireEvent.pointerDown(dialog.parentElement!);

    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    expect(opener).toHaveFocus();
    expect(scrollTo).toHaveBeenCalledWith(0, 240);
  });
});
