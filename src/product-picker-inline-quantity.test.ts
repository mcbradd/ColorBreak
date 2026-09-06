import { createElement } from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const catalogSets = vi.hoisted(() => vi.fn().mockResolvedValue([
  { code: "TST", name: "Test Set", released: "2020-01-01", type: "expansion" },
]));
const productsForSet = vi.hoisted(() => vi.fn().mockResolvedValue([
  { key: "tst-box", label: "Collector Booster Box", set: "TST", setName: "Test Set", category: "box", packCount: 12, status: "verified" },
  { key: "tst-pack", label: "Play Booster Pack", set: "TST", setName: "Test Set", category: "pack", packCount: 1, status: "verified" },
]));
vi.mock("./data/catalog", () => ({ catalogSets, productsForSet, readinessForProduct: vi.fn() }));

const prepareProductSelection = vi.hoisted(() => vi.fn(async (lines: Array<{ productLabel: string }>) => ({
  lines,
  assessment: { presentation: "eligible" },
  compositionFingerprint: "fp",
  evidenceFingerprint: "ef",
})));
vi.mock("./domain/decision-evidence", () => ({ prepareProductSelection }));

import { Builder } from "./features/shared/ProductBuilder";

describe("Add to Break product picker — single-screen add/remove/quantity", () => {
  it("adds a product on tap, adjusts its quantity, and removes it — all on the same product-list screen", async () => {
    render(createElement(Builder, { open: true, onClose: vi.fn(), lines: [], onApply: vi.fn() }));
    fireEvent.click(await screen.findByRole("button", { name: /Test Set/ }));

    // Before adding, the row is a single tappable control with no separate
    // quantity affordance — tapping it is the entire add action.
    const boxRow = await screen.findByRole("button", { name: /Collector Booster Box/ });
    expect(within(boxRow).queryByLabelText(/quantity/i)).not.toBeInTheDocument();

    fireEvent.click(boxRow);

    // Selection shows the editable quantity; only focusing it opens the keypad.
    const selectedRow = await screen.findByRole("group", { name: "Selected Collector Booster Box" });
    const quantityOutput = within(selectedRow).getByLabelText("Collector Booster Box quantity in products", { selector: "input" });
    expect(quantityOutput).toHaveValue("1");
    expect(within(selectedRow).getByRole("textbox")).toHaveAttribute("inputmode", "numeric");
    expect(within(selectedRow).queryByRole("spinbutton")).not.toBeInTheDocument();

    const increase = screen.getByRole("button", { name: /Increase Collector Booster Box quantity/i });
    fireEvent.click(increase);
    expect(quantityOutput).toHaveValue("2");

    // Stepping the quantity below one is the removal control: there is no
    // second bin icon doing the same job.
    fireEvent.click(screen.getByRole("button", { name: /Decrease Collector Booster Box quantity/i }));
    fireEvent.click(screen.getByRole("button", { name: /Remove Collector Booster Box from break/i }));
    // The row is back to its unselected, single-tap-to-add state.
    expect(await screen.findByRole("button", { name: /Collector Booster Box/ })).toBeInTheDocument();
    expect(screen.queryByLabelText("Collector Booster Box quantity in products")).not.toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Selected Collector Booster Box" })).not.toBeInTheDocument();
  });

  it("edits a quantity with the numeric keypad and commits using the field Done action", async () => {
    const onApply = vi.fn();
    render(createElement(Builder, { open: true, onClose: vi.fn(), lines: [], onApply }));
    fireEvent.click(await screen.findByRole("button", { name: /Test Set/ }));
    fireEvent.click(await screen.findByRole("button", { name: /Play Booster Pack/ }));
    const quantity = screen.getByRole("textbox", { name: "Play Booster Pack quantity in openings" });
    expect(quantity).toHaveValue("1");
    fireEvent.focus(quantity);
    fireEvent.change(quantity, { target: { value: "" } });
    expect(quantity).toHaveValue("");
    fireEvent.change(quantity, { target: { value: "24" } });
    expect(quantity).toHaveValue("24");
    fireEvent.change(quantity, { target: { value: "2.5" } });
    expect(quantity).toHaveValue("24");
    fireEvent.click(screen.getByRole("button", { name: "Done entering Play Booster Pack quantity in openings" }));
    expect(quantity).toHaveValue("24");
    fireEvent.click(screen.getByRole("button", { name: "Done", exact: true }));
    await waitFor(() => expect(onApply).toHaveBeenCalled());
    expect(onApply.mock.calls[0][0][0].quantity).toBe(24);
  });

  it("keeps each product row's add/remove/quantity state independent", async () => {
    render(createElement(Builder, { open: true, onClose: vi.fn(), lines: [], onApply: vi.fn() }));
    fireEvent.click(await screen.findByRole("button", { name: /Test Set/ }));

    fireEvent.click(await screen.findByRole("button", { name: /Collector Booster Box/ }));
    fireEvent.click(await screen.findByRole("button", { name: /Play Booster Pack/ }));

    await screen.findByRole("group", { name: "Selected Collector Booster Box" });
    await screen.findByRole("group", { name: "Selected Play Booster Pack" });

    // Removing just the box leaves the pack's own line and quantity intact.
    fireEvent.click(screen.getByRole("button", { name: /Remove Collector Booster Box from break/i }));
    expect(screen.queryByRole("group", { name: "Selected Collector Booster Box" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Play Booster Pack quantity in openings")).toHaveValue("1");
  });

  it("commits the in-screen additions to the break when the picker is finished", async () => {
    const onApply = vi.fn();
    render(createElement(Builder, { open: true, onClose: vi.fn(), lines: [], onApply }));
    fireEvent.click(await screen.findByRole("button", { name: /Test Set/ }));
    fireEvent.click(await screen.findByRole("button", { name: /Collector Booster Box/ }));
    fireEvent.click(screen.getByRole("button", { name: /Increase Collector Booster Box quantity/i }));

    fireEvent.click(screen.getByRole("button", { name: "Done", exact: true }));

    await waitFor(() => expect(onApply).toHaveBeenCalled());
    const [appliedLines] = onApply.mock.calls[0];
    expect(appliedLines).toHaveLength(1);
    expect(appliedLines[0]).toMatchObject({ productLabel: "Collector Booster Box", quantity: 2 });
  });

  it("keeps Done available after the last removal and commits the empty break", async () => {
    const onApply = vi.fn();
    const onClose = vi.fn();
    render(createElement(Builder, {
      open: true, onClose, onApply,
      lines: [{ id: "only-box", set: "TST", productKey: "tst-box", productLabel: "Collector Booster Box", quantity: 1, packCount: 12 }],
    }));
    fireEvent.click(await screen.findByRole("button", { name: /Test Set/ }));
    const selectedRow = await screen.findByRole("group", { name: "Selected Collector Booster Box" });
    fireEvent.click(within(selectedRow).getByRole("button", { name: "Remove Collector Booster Box from break" }));

    expect(screen.queryByRole("group", { name: "Selected Collector Booster Box" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Done", exact: true }));
    await waitFor(() => expect(onApply).toHaveBeenCalledTimes(1));
    expect(onApply.mock.calls[0][0]).toEqual([]);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("disables the plus button at the supported quantity maximum", async () => {
    render(createElement(Builder, {
      open: true, onClose: vi.fn(), onApply: vi.fn(),
      lines: [{ id: "max-box", set: "TST", productKey: "tst-box", productLabel: "Collector Booster Box", quantity: 999, packCount: 12 }],
    }));
    fireEvent.click(await screen.findByRole("button", { name: /Test Set/ }));
    const selectedRow = await screen.findByRole("group", { name: "Selected Collector Booster Box" });
    expect(within(selectedRow).getByLabelText("Collector Booster Box quantity in products")).toHaveValue("999");
    expect(within(selectedRow).getByRole("button", { name: "Increase Collector Booster Box quantity" })).toBeDisabled();
    expect(within(selectedRow).getByRole("button", { name: "Decrease Collector Booster Box quantity" })).toBeEnabled();
  });
});
