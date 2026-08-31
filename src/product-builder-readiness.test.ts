import { createElement } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const catalogSets = vi.hoisted(() => vi.fn().mockResolvedValue([
  { code: "TST", name: "Test Set", released: "2020-01-01", type: "expansion" },
]));
const productsForSet = vi.hoisted(() => vi.fn().mockResolvedValue([
  { key: "tst-box", label: "Collector Booster Box", set: "TST", setName: "Test Set", category: "box", packCount: 12, status: "verified" },
  { key: "tst-single", label: "Single Card", set: "TST", setName: "Test Set", category: "common", packCount: 0, status: "verified" },
]));
vi.mock("./data/catalog", () => ({ catalogSets, productsForSet, readinessForProduct: vi.fn() }));

const prepareProductSelection = vi.hoisted(() => vi.fn(async (lines: Array<{ productLabel: string }>) => {
  const last = lines[lines.length - 1];
  const presentation = last.productLabel === "Collector Booster Box" ? "eligible" : "stale";
  return {
    lines,
    assessment: { presentation },
    compositionFingerprint: "fp",
    evidenceFingerprint: "ef",
  };
}));
vi.mock("./domain/decision-evidence", () => ({ prepareProductSelection }));

import { Builder } from "./features/shared/ProductBuilder";

describe("Add to Break product picker", () => {
  it("shows a distinct, real per-row readiness signal instead of a constant label on every row", async () => {
    render(createElement(Builder, { open: true, onClose: vi.fn(), lines: [], onApply: vi.fn() }));
    fireEvent.click(await screen.findByRole("button", { name: /Test Set/ }));

    const boxRow = await screen.findByRole("button", { name: /Collector Booster Box/ });
    const singleRow = await screen.findByRole("button", { name: /Single Card/ });

    // The old bug rendered the literal, non-informative "Ready to add" on
    // every row regardless of actual per-product readiness. It must be gone.
    expect(screen.queryByText(/Ready to add/)).not.toBeInTheDocument();

    // Rows with different underlying eligibility must show different text —
    // this is the real signal the "Ready for bid check" checkbox summarizes.
    expect(boxRow.textContent).toContain("Fresh estimate");
    expect(singleRow.textContent).toContain("Estimate may need an update");

    // The readiness count reflects genuine per-product data: exactly one of
    // the two products in this fixture is eligible.
    const readyCount = await screen.findByText("1 ready in this snapshot");
    expect(readyCount).toBeInTheDocument();

    // The filter actually filters: checking it hides the non-eligible row.
    fireEvent.click(screen.getByRole("checkbox", { name: /Ready for bid check/ }));
    await waitFor(() => expect(screen.queryByRole("button", { name: /Single Card/ })).not.toBeInTheDocument());
    expect(screen.getByRole("button", { name: /Collector Booster Box/ })).toBeInTheDocument();
  });

  it("gives the current-break stat tiles clear number/caption separation instead of gluing the label to the digit", async () => {
    render(createElement(Builder, { open: true, onClose: vi.fn(), lines: [], onApply: vi.fn() }));
    fireEvent.click(await screen.findByRole("button", { name: /Test Set/ }));
    fireEvent.click(await screen.findByRole("button", { name: /Collector Booster Box/ }));

    // "Current break" is a single shared label, not duplicated per tile.
    expect(screen.getAllByText("Current break")).toHaveLength(1);

    // Each stat tile keeps its number and its unit caption in separate
    // nodes (number first, caption below) rather than one run-on text node
    // like "Current break1".
    const tiles = document.querySelectorAll(".stat-tile");
    expect(tiles).toHaveLength(2);
    tiles.forEach((tile) => {
      expect(tile.querySelector("b")).not.toBeNull();
      expect(tile.querySelector("small")).not.toBeNull();
    });
    expect(tiles[0].querySelector("b")?.textContent).toBe("1");
    expect(tiles[0].textContent).not.toMatch(/break1/i);
  });
});
