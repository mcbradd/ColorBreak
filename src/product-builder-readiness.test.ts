import { createElement } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
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

const refreshPublishedPrices = vi.hoisted(() => vi.fn(async (_progress: (phase: "searching" | "updating") => void) => "stale"));
vi.mock("./data/scryfall", () => ({ refreshPublishedPrices }));

import { Builder } from "./features/shared/ProductBuilder";

describe("Add to Break product picker", () => {
  it("puts one optional estimate refresh action in the fixed picker header instead of repeating freshness on each product", async () => {
    render(createElement(Builder, { open: true, onClose: vi.fn(), lines: [], onApply: vi.fn() }));
    fireEvent.click(await screen.findByRole("button", { name: /Test Set/ }));

    const boxRow = await screen.findByRole("button", { name: /Collector Booster Box/ });
    const singleRow = await screen.findByRole("button", { name: /Single Card/ });

    // Product selection is about choosing a product. Freshness is a break-wide
    // concern, so it appears once as an optional action rather than resizing
    // every row with repeated labels.
    expect(screen.queryByText(/Ready to add/)).not.toBeInTheDocument();
    expect(boxRow.textContent).not.toMatch(/Fresh estimate|may need an update/);
    expect(singleRow.textContent).not.toMatch(/Fresh estimate|may need an update/);
    expect(screen.getAllByRole("button", { name: "Estimates may be outdated. Refresh now" })).toHaveLength(1);

    const initialCalls = prepareProductSelection.mock.calls.length;
    fireEvent.click(screen.getByRole("button", { name: "Estimates may be outdated. Refresh now" }));
    expect(screen.getByRole("button", { name: /Searching/ })).toHaveTextContent("Searching…");
    await vi.waitFor(() => expect(prepareProductSelection.mock.calls.length).toBeGreaterThan(initialCalls));
  });

  it("shows real progress, keeps its terminal result, and allows retry after failure", async () => {
    let progress!: (phase: "searching" | "updating") => void;
    let finish!: (result: string) => void;
    refreshPublishedPrices.mockImplementationOnce((report) => { progress = report; return new Promise(resolve => { finish = resolve; }); });
    const { rerender } = render(createElement(Builder, { open: true, onClose: vi.fn(), lines: [], onApply: vi.fn() }));
    fireEvent.click(await screen.findByRole("button", { name: /Test Set/ }));
    fireEvent.click(await screen.findByRole("button", { name: /Refresh now/ }));
    const button = screen.getByRole("button", { name: /Searching/ });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(button.querySelector(".refresh-spinner")).not.toBeNull();
    rerender(createElement(Builder, { open: true, onClose: vi.fn(), lines: [], onApply: vi.fn() }));
    expect(button).toHaveTextContent("Searching…");
    act(() => progress("updating"));
    expect(button).toHaveTextContent("Updating…");
    let finishChecking!: () => void;
    const originalPreparation = prepareProductSelection.getMockImplementation()!;
    prepareProductSelection.mockImplementationOnce(async (lines) => {
      await new Promise<void>(resolve => { finishChecking = resolve; });
      return originalPreparation(lines);
    });
    await act(async () => finish("stale"));
    expect(button).toHaveTextContent("Checking…");
    expect(button.querySelector(".refresh-spinner")).not.toBeNull();
    await act(async () => finishChecking());
    expect(await screen.findByRole("button", { name: "No newer data" })).toBeEnabled();
    expect(button.querySelector(".refresh-spinner")).toBeNull();
    refreshPublishedPrices.mockRejectedValueOnce(new Error("offline"));
    fireEvent.click(button);
    expect(await screen.findByRole("button", { name: "Retry" })).toBeEnabled();
    expect(screen.getByRole("button", { name: /Collector Booster Box/ })).toBeInTheDocument();
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

  it("keeps the product list in place after a selection", async () => {
    render(createElement(Builder, { open: true, onClose: vi.fn(), lines: [], onApply: vi.fn() }));

    // The picker itself makes selection obvious. A current-break panel would
    // appear only after the first tap and shove every product row downward.
    expect(screen.queryByText("Current break")).not.toBeInTheDocument();

    fireEvent.click(await screen.findByRole("button", { name: /Test Set/ }));
    fireEvent.click(await screen.findByRole("button", { name: /Collector Booster Box/ }));

    expect(await screen.findByRole("group", { name: "Selected Collector Booster Box" })).toBeInTheDocument();
    expect(screen.queryByText("Current break")).not.toBeInTheDocument();
  });
});
