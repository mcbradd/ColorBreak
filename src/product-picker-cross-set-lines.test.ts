import { createElement } from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

/**
 * Two real sets ship a product whose sealed key is identical: MSH and EOE both
 * publish `play-booster-pack`. Sealed product keys are unique inside a set and
 * nowhere else, so every lookup that reaches for "the line for this product"
 * has to carry the set with it.
 */
const catalogSets = vi.hoisted(() => vi.fn().mockResolvedValue([
  { code: "MSH", name: "Marvel Super Heroes", released: "2025-09-26", type: "expansion" },
  { code: "EOE", name: "Edge of Eternities", released: "2025-08-01", type: "expansion" },
]));
const productsForSet = vi.hoisted(() => vi.fn(async (set: string) => {
  const code = set.toUpperCase();
  const name = code === "MSH" ? "Marvel Super Heroes" : "Edge of Eternities";
  return [
    { key: "play-booster-pack", sealedKey: "play-booster-pack", label: "Play Booster Pack", set: code, setName: name, category: "pack", packCount: 1, status: "verified" },
    { key: "collector-booster-pack", sealedKey: "collector-booster-pack", label: "Collector Booster Pack", set: code, setName: name, category: "pack", packCount: 1, status: "verified" },
  ];
}));
vi.mock("./data/catalog", () => ({ catalogSets, productsForSet, readinessForProduct: vi.fn() }));

const prepareProductSelection = vi.hoisted(() => vi.fn(async (lines: Array<{ productLabel: string }>) => ({
  lines,
  assessment: { presentation: "eligible" },
  compositionFingerprint: "fp",
  evidenceFingerprint: "ef",
})));
vi.mock("./domain/decision-evidence", () => ({ prepareProductSelection }));

import { Builder } from "./features/shared/ProductBuilder";

const statLines = () => document.querySelectorAll(".stat-tile")[0].querySelector("b");
const statOpenings = () => document.querySelectorAll(".stat-tile")[1].querySelector("b");
const openSet = async (name: RegExp) => fireEvent.click(await screen.findByRole("button", { name }));
const back = () => fireEvent.click(screen.getByRole("button", { name: "Back" }));

describe("Add to Break product picker — same product name in two sets", () => {
  it("keeps MSH and EOE Play Booster Packs as two independent break lines", async () => {
    const onApply = vi.fn();
    render(createElement(Builder, { open: true, onClose: vi.fn(), lines: [], onApply }));

    await openSet(/Marvel Super Heroes/);
    fireEvent.click(await screen.findByRole("button", { name: /Play Booster Pack/ }));
    await waitFor(() => expect(statLines()).toHaveTextContent("1"));
    fireEvent.click(screen.getByRole("button", { name: /Increase Play Booster Pack quantity/i }));
    fireEvent.click(screen.getByRole("button", { name: /Increase Play Booster Pack quantity/i }));
    expect(screen.getByLabelText("Play Booster Pack quantity in openings")).toHaveValue(3);
    await waitFor(() => expect(statOpenings()).toHaveTextContent("3"));

    back();
    await openSet(/Edge of Eternities/);

    // EOE's own row must read as un-added: MSH's quantity is not EOE's.
    const eoeRow = await screen.findByRole("button", { name: /Play Booster Pack/ });
    expect(within(eoeRow).queryByLabelText(/quantity/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Play Booster Pack quantity in openings")).not.toBeInTheDocument();

    fireEvent.click(eoeRow);

    // Two distinct product lines, four openings total.
    await waitFor(() => expect(statLines()).toHaveTextContent("2"));
    expect(statOpenings()).toHaveTextContent("4");
    expect(screen.getByLabelText("Play Booster Pack quantity in openings")).toHaveValue(1);

    // Stepping EOE up moves EOE only.
    fireEvent.click(screen.getByRole("button", { name: /Increase Play Booster Pack quantity/i }));
    await waitFor(() => expect(statOpenings()).toHaveTextContent("5"));
    expect(statLines()).toHaveTextContent("2");

    fireEvent.click(screen.getByRole("button", { name: /Add to break/i }));
    await waitFor(() => expect(onApply).toHaveBeenCalled());
    const [appliedLines] = onApply.mock.calls[0];
    expect(appliedLines.map((line: { set: string; productKey: string; quantity: number }) =>
      [line.set, line.productKey, line.quantity])).toEqual([
        ["MSH", "sealed:play-booster-pack", 3],
        ["EOE", "sealed:play-booster-pack", 2],
      ]);
  });

  it("shows an existing line's quantity only on its own set's row", async () => {
    render(createElement(Builder, {
      open: true,
      onClose: vi.fn(),
      onApply: vi.fn(),
      lines: [{ id: "msh-play", set: "MSH", productKey: "sealed:play-booster-pack", productLabel: "Play Booster Pack", quantity: 3, packCount: 1 }],
    }));

    await openSet(/Edge of Eternities/);
    expect(await screen.findByRole("button", { name: /Play Booster Pack/ })).toBeInTheDocument();
    expect(screen.queryByLabelText("Play Booster Pack quantity in openings")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Remove Play Booster Pack from break/i })).not.toBeInTheDocument();

    back();
    await openSet(/Marvel Super Heroes/);
    await waitFor(() => expect(screen.getByLabelText("Play Booster Pack quantity in openings")).toHaveValue(3));
  });

  it("removes only the set whose row was tapped", async () => {
    const onApply = vi.fn();
    render(createElement(Builder, {
      open: true,
      onClose: vi.fn(),
      onApply,
      lines: [
        { id: "msh-play", set: "MSH", productKey: "sealed:play-booster-pack", productLabel: "Play Booster Pack", quantity: 3, packCount: 1 },
        { id: "eoe-play", set: "EOE", productKey: "sealed:play-booster-pack", productLabel: "Play Booster Pack", quantity: 1, packCount: 1 },
      ],
    }));

    await openSet(/Edge of Eternities/);
    await waitFor(() => expect(screen.getByLabelText("Play Booster Pack quantity in openings")).toHaveValue(1));
    fireEvent.click(screen.getByRole("button", { name: /Remove Play Booster Pack from break/i }));

    await waitFor(() => expect(statLines()).toHaveTextContent("1"));
    expect(statOpenings()).toHaveTextContent("3");

    fireEvent.click(screen.getByRole("button", { name: /Add to break/i }));
    await waitFor(() => expect(onApply).toHaveBeenCalled());
    const [appliedLines] = onApply.mock.calls[0];
    expect(appliedLines.map((line: { set: string; quantity: number }) => [line.set, line.quantity])).toEqual([["MSH", 3]]);
  });
});
