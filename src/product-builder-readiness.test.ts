import { createElement } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
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

    expect(boxRow.textContent).toContain("Fresh estimate");
    expect(singleRow.textContent).toContain("Estimate may need an update");
  });

  it("has no readiness checkbox hiding products from the picker", async () => {
    render(createElement(Builder, { open: true, onClose: vi.fn(), lines: [], onApply: vi.fn() }));
    fireEvent.click(await screen.findByRole("button", { name: /Test Set/ }));
    await screen.findByRole("button", { name: /Collector Booster Box/ });

    // Filtering products by estimate freshness quietly removed real products
    // from the catalog and gave no clue why. Every product is listed; the
    // per-row wording carries the caveat.
    expect(screen.queryByRole("checkbox", { name: /Ready for bid check/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Single Card/ })).toBeInTheDocument();
  });

  it("shows the current break as the products in it, not a count of lines", async () => {
    render(createElement(Builder, { open: true, onClose: vi.fn(), lines: [], onApply: vi.fn() }));

    // Nothing added yet: no "0 product lines / 0 openings" to read past.
    expect(screen.queryByText("Current break")).not.toBeInTheDocument();

    fireEvent.click(await screen.findByRole("button", { name: /Test Set/ }));
    fireEvent.click(await screen.findByRole("button", { name: /Collector Booster Box/ }));

    expect(await screen.findByText("Current break")).toBeInTheDocument();
    const entries = [...document.querySelectorAll(".composer-draft-list li")].map((node) => node.textContent);
    expect(entries).toEqual(["TSTCollector Booster Box×1"]);
  });
});
