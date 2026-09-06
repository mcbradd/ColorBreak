import { createElement, useState } from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BreakLine, ProductChoice } from "./domain/types";
import type { ProductSearchSet } from "./domain/product-search";

const loader = vi.hoisted(() => ({ index: vi.fn(), products: vi.fn() }));
vi.mock("./data/product-search", () => ({ loadProductSearchIndex: loader.index, quickProductsForSet: loader.products }));
import { QuickBreakComposer } from "./features/shared/QuickBreakComposer";

const sets: ProductSearchSet[] = [
  { code: "FIN", name: "Final Fantasy", released: "2025-06-13", type: "exact-sealed", hasSealed: true, products: [] },
  { code: "EOE", name: "Edge of Eternities", released: "2025-08-01", type: "exact-sealed", hasSealed: true, products: [] },
];
const products = (set: ProductSearchSet): ProductChoice[] => [
  { key: "collector-booster-box", sealedKey: "collector-booster-box", label: "Collector Booster Box", set: set.code, setName: set.name, category: "box", packCount: 12, status: "estimated" },
  { key: "play-booster-pack", sealedKey: "play-booster-pack", label: "Play Booster Pack", set: set.code, setName: set.name, category: "pack", packCount: 1, status: "estimated" },
];

function Harness({ initial = [], change = vi.fn() }: { initial?: BreakLine[]; change?: (lines: BreakLine[]) => void }) {
  const [lines, setLines] = useState(initial);
  return createElement(QuickBreakComposer, { lines, onChange: (next) => { change(next); setLines(next); }, onImport: vi.fn() });
}
const search = (query: string) => fireEvent.change(screen.getByRole("combobox"), { target: { value: query } });

beforeEach(() => {
  loader.index.mockReset().mockResolvedValue(sets);
  loader.products.mockReset().mockImplementation(async (set: ProductSearchSet) => products(set));
});

describe("fast inline break composition", () => {
  it("adds, edits quantities, then adds another set without leaving the screen or losing costs", async () => {
    const change = vi.fn();
    render(createElement(Harness, { change, initial: [{ id: "paid", set: "FIN", productKey: "sealed:collector-booster-box", productLabel: "Collector Booster Box", quantity: 1, packCount: 12, myCost: 180, marketCost: 210 }] }));
    await screen.findByRole("button", { name: "FIN Final Fantasy" });
    expect(loader.products).not.toHaveBeenCalled();
    search("final fan col");
    fireEvent.click(await screen.findByRole("option", { name: "Add Final Fantasy (FIN) Collector Booster Box" }));
    expect(screen.getByRole("combobox")).toHaveValue("");
    expect(screen.getByRole("combobox")).toHaveFocus();
    expect(screen.getByLabelText("FIN Collector Booster Box quantity", { selector: "input" })).toHaveValue("2");
    fireEvent.click(screen.getByRole("button", { name: "Increase FIN Collector Booster Box quantity" }));
    const quantity = screen.getByLabelText("FIN Collector Booster Box quantity", { selector: "input" });
    fireEvent.change(quantity, { target: { value: "7" } });
    fireEvent.blur(quantity);
    search("eoe collector");
    fireEvent.click(await screen.findByRole("option", { name: "Add Edge of Eternities (EOE) Collector Booster Box" }));
    const final = change.mock.lastCall![0] as BreakLine[];
    expect(final).toHaveLength(2);
    expect(final[0]).toMatchObject({ id: "paid", set: "FIN", quantity: 7, myCost: 180, marketCost: 210 });
    expect(final[1]).toMatchObject({ set: "EOE", productKey: "sealed:collector-booster-box", quantity: 1 });
    expect(document.querySelectorAll(".quick-break-line")).toHaveLength(2);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("supports keyboard selection and immediately starts the next product search", async () => {
    const change = vi.fn();
    render(createElement(Harness, { change }));
    await screen.findByRole("button", { name: "FIN Final Fantasy" });
    search("fin");
    await screen.findByRole("option", { name: "Add Final Fantasy (FIN) Collector Booster Box" });
    fireEvent.keyDown(screen.getByRole("combobox"), { key: "ArrowDown" });
    fireEvent.keyDown(screen.getByRole("combobox"), { key: "Enter" });
    // Packs lead the list; ArrowDown selects the following box.
    expect(change.mock.lastCall![0][0]).toMatchObject({ productKey: "sealed:collector-booster-box" });
    expect(screen.getByRole("combobox")).toHaveFocus();
    search("eoe play");
    await screen.findByRole("option", { name: "Add Edge of Eternities (EOE) Play Booster Pack" });
    fireEvent.keyDown(screen.getByRole("combobox"), { key: "Enter" });
    expect(change.mock.lastCall![0]).toHaveLength(2);
  });

  it("allows replacing a quantity and undoing removal without dropping other lines", async () => {
    const change = vi.fn();
    render(createElement(Harness, { change }));
    await screen.findByRole("button", { name: "FIN Final Fantasy" });
    search("fin play");
    fireEvent.click(await screen.findByRole("option", { name: "Add Final Fantasy (FIN) Play Booster Pack" }));
    const input = screen.getByLabelText("FIN Play Booster Pack quantity", { selector: "input" });
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "" } });
    expect(document.querySelectorAll(".quick-break-line")).toHaveLength(1);
    fireEvent.blur(input);
    expect(input).toHaveValue("1");
    fireEvent.click(screen.getByRole("button", { name: "Remove FIN Play Booster Pack from break" }));
    search("eoe play");
    fireEvent.click(await screen.findByRole("option", { name: "Add Edge of Eternities (EOE) Play Booster Pack" }));
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(change.mock.lastCall![0].map((line: BreakLine) => [line.set, line.quantity])).toEqual([["FIN", 1], ["EOE", 1]]);
  });

  it("ignores a slow prior query when another set finishes first", async () => {
    let resolveFirst: (rows: ProductChoice[]) => void = () => undefined;
    loader.products.mockImplementation((set: ProductSearchSet) => set.code === "FIN" ? new Promise<ProductChoice[]>((resolve) => { resolveFirst = resolve; }) : Promise.resolve(products(set)));
    render(createElement(Harness));
    await screen.findByRole("button", { name: "FIN Final Fantasy" });
    search("fin");
    await waitFor(() => expect(loader.products).toHaveBeenCalled());
    search("eoe");
    await screen.findByRole("option", { name: "Add Edge of Eternities (EOE) Collector Booster Box" });
    resolveFirst(products(sets[0]));
    await waitFor(() => expect(within(screen.getByRole("listbox")).getAllByRole("option")).toHaveLength(2));
    expect(screen.queryByRole("option", { name: /Final Fantasy/ })).not.toBeInTheDocument();
  });

  it("keeps the current break usable and retries failed catalog and exact-product requests", async () => {
    loader.index.mockRejectedValueOnce(new Error("offline"));
    loader.products.mockRejectedValueOnce(new Error("offline"));
    render(createElement(Harness));
    fireEvent.click(await screen.findByRole("button", { name: "Retry catalog" }));
    await screen.findByRole("button", { name: "FIN Final Fantasy" });
    search("fin play");
    fireEvent.click(await screen.findByRole("button", { name: "Retry products" }));
    expect(await screen.findByRole("option", { name: "Add Final Fantasy (FIN) Play Booster Pack" })).toBeEnabled();
  });

  it("keeps a visible Done control usable while editing quantity with a phone keypad", async () => {
    render(createElement(Harness, { initial: [{ id: "fin", set: "FIN", productKey: "sealed:play-booster-pack", productLabel: "Play Booster Pack", quantity: 1, packCount: 1 }] }));
    const input = screen.getByLabelText("FIN Play Booster Pack quantity", { selector: "input" });
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "18" } });
    const done = screen.getByRole("button", { name: "Done entering FIN Play Booster Pack quantity" });
    fireEvent.pointerDown(done);
    fireEvent.click(done);
    expect(input).toHaveValue("18");
    expect(screen.queryByRole("button", { name: "Done entering FIN Play Booster Pack quantity" })).not.toBeInTheDocument();
  });
});
