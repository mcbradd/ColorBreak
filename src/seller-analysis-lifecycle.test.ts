import { createElement, useState } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BreakAnalysis } from "./data/evaluate";
import type { BreakLine } from "./domain/types";
import { calculateBreak } from "./domain/valuation";

const mocks = vi.hoisted(() => ({
  evaluate: vi.fn(),
  marketPrice: vi.fn(),
  apply: undefined as ((lines: BreakLine[]) => void) | undefined,
}));

const line: BreakLine = {
  id: "one", set: "TST", productKey: "sealed:play-box", productLabel: "Play Box", quantity: 1, tcgId: 1,
};

vi.mock("./data/evaluate", () => ({ evaluateBreakAnalysis: mocks.evaluate }));
vi.mock("./data/catalog", () => ({ productsForSet: vi.fn(async () => []) }));
vi.mock("./data/sealed-prices", () => ({ sealedMarketPrice: mocks.marketPrice }));
vi.mock("./persistence", () => ({
  cleanupLegacyStorage: () => false,
  readSessionDraft: () => ({ lines: [{ ...line }] }),
  writeSessionLines: vi.fn(),
}));
vi.mock("./features/shared/ProductBuilder", () => ({
  Builder: () => null,
}));
vi.mock("./features/shared/QuickBreakComposer", () => ({
  QuickBreakComposer: ({ lines, onChange }: { lines: BreakLine[]; onChange: (lines: BreakLine[]) => void }) => {
    mocks.apply = onChange;
    return createElement("section", { "aria-label": "Product composer" },
      createElement("p", null, lines.length ? `${lines[0].quantity} boxes in composer` : "Empty break"),
      createElement("button", { onClick: () => onChange(lines.map((row) => ({ ...row, quantity: row.quantity + 1 }))) }, "Increase quantity"),
    );
  },
}));
vi.mock("./features/seller/SellerGlance", () => ({
  SellerGlance: ({ current }: { current: boolean }) => createElement("output", { "aria-label": "Glance readiness" }, current ? "Current" : "Updating"),
}));
vi.mock("./features/seller/SellerView", () => ({
  SellerView: ({ analysis, lines, update }: {
    analysis: BreakAnalysis;
    lines: BreakLine[];
    update: (id: string, patch: Partial<BreakLine>) => void;
  }) => {
    const [note, setNote] = useState("");
    return createElement("section", { "aria-label": "Seller result" },
      createElement("output", null, analysis.valuation.dataVersion),
      createElement("input", { "aria-label": "Local seller note", value: note, onChange: (event) => setNote(event.currentTarget.value) }),
      createElement("input", {
        "aria-label": "My cost basis", value: lines[0]?.myCost ?? "",
        onChange: (event) => { if (lines[0]) update(lines[0].id, { myCost: Number(event.currentTarget.value) }); },
      }),
      createElement("span", null, `Market cost ${lines[0]?.marketCost ?? "pending"}`),
    );
  },
}));

import { SellerWorkspace } from "./features/seller/SellerWorkspace";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((onResolve, onReject) => { resolve = onResolve; reject = onReject; });
  return { promise, resolve, reject };
}

function analysis(version: string): BreakAnalysis {
  return {
    valuation: calculateBreak({ draws: [], prices: [], dataVersion: version }),
    outcomeModel: { cacheKey: version, complete: true, fixed: [], packs: [] },
    outcomeOmissions: [],
    priceAvailability: { status: "available", source: "snapshot", message: "Available" },
  };
}

describe("seller calculation lifecycle", () => {
  beforeEach(() => {
    mocks.evaluate.mockReset(); mocks.marketPrice.mockReset(); mocks.apply = undefined;
    mocks.marketPrice.mockResolvedValue(undefined);
    history.replaceState(null, "", "/#seller");
  });
  afterEach(cleanup);

  it("keeps typing, local controls, and analysis intact when costs and market metadata change", async () => {
    const market = deferred<number>();
    mocks.marketPrice.mockReturnValue(market.promise);
    mocks.evaluate.mockResolvedValue(analysis("original"));
    render(createElement(SellerWorkspace, { exit: vi.fn() }));
    const cost = await screen.findByLabelText("My cost basis");
    fireEvent.change(screen.getByLabelText("Local seller note"), { target: { value: "keep open" } });
    cost.focus();
    fireEvent.change(cost, { target: { value: "85" } });
    expect(document.activeElement).toBe(cost);
    expect(screen.getByLabelText("Local seller note")).toHaveValue("keep open");
    expect(mocks.evaluate).toHaveBeenCalledTimes(1);
    await act(async () => market.resolve(120));
    expect(screen.getByText("Market cost 120")).toBeInTheDocument();
    expect(document.activeElement).toBe(cost);
    expect(mocks.evaluate).toHaveBeenCalledTimes(1);
  });

  it("ignores display-only edits but recalculates quantities and legacy pack counts", async () => {
    mocks.evaluate.mockResolvedValue(analysis("ready"));
    render(createElement(SellerWorkspace, { exit: vi.fn() }));
    await screen.findByText("ready");
    act(() => mocks.apply!([{ ...line, id: "renamed", productLabel: "New display label", marketCost: 120 }]));
    expect(mocks.evaluate).toHaveBeenCalledTimes(1);
    act(() => mocks.apply!([{ ...line, quantity: 3 }]));
    await waitFor(() => expect(mocks.evaluate).toHaveBeenCalledTimes(2));
    act(() => mocks.apply!([{ ...line, quantity: 3, packCount: 36 }]));
    await waitFor(() => expect(mocks.evaluate).toHaveBeenCalledTimes(3));
    expect(mocks.evaluate.mock.calls.at(-1)?.[0]).toMatchObject([{ quantity: 3, packCount: 36 }]);
  });

  it("prevents a slower old quantity from replacing the latest calculation", async () => {
    const older = deferred<BreakAnalysis>();
    const latest = deferred<BreakAnalysis>();
    mocks.evaluate.mockResolvedValueOnce(analysis("one box")).mockReturnValueOnce(older.promise).mockReturnValueOnce(latest.promise);
    render(createElement(SellerWorkspace, { exit: vi.fn() }));
    const note = await screen.findByLabelText("Local seller note");
    fireEvent.change(note, { target: { value: "keep my plan" } });
    fireEvent.click(screen.getByRole("button", { name: "Increase quantity" }));
    expect(screen.getByText("one box")).toBeInTheDocument();
    expect(note).toBeDisabled();
    expect(screen.getByLabelText("Glance readiness")).toHaveTextContent("Updating");
    const increment = screen.getByRole("button", { name: "Increase quantity" });
    expect(increment).not.toBeDisabled();
    fireEvent.click(increment);
    expect(screen.getByText("3 boxes in composer")).toBeInTheDocument();
    await act(async () => latest.resolve(analysis("three boxes")));
    expect(screen.getByText("three boxes")).toBeInTheDocument();
    expect(screen.getByLabelText("Local seller note")).toBe(note);
    expect(note).toHaveValue("keep my plan");
    expect(note).not.toBeDisabled();
    await act(async () => older.resolve(analysis("two boxes")));
    expect(screen.getByText("three boxes")).toBeInTheDocument();
    expect(screen.queryByText("two boxes")).not.toBeInTheDocument();
    expect(screen.queryByText("one box")).not.toBeInTheDocument();
  });

  it.each(["success", "failure"])("ignores a late %s after the final product is removed", async (outcome) => {
    const pending = deferred<BreakAnalysis>();
    mocks.evaluate.mockReturnValue(pending.promise);
    render(createElement(SellerWorkspace, { exit: vi.fn() }));
    act(() => mocks.apply!([]));
    await act(async () => {
      if (outcome === "success") pending.resolve(analysis("removed break"));
      else pending.reject(new Error("Removed request failed"));
    });
    expect(screen.getByText("Empty break")).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Seller result" })).not.toBeInTheDocument();
    expect(screen.queryByText("Removed request failed")).not.toBeInTheDocument();
  });

  it("does not present a previous calculation as current after an edit fails, and can retry", async () => {
    const changed = deferred<BreakAnalysis>();
    mocks.evaluate.mockResolvedValueOnce(analysis("old result")).mockReturnValueOnce(changed.promise).mockResolvedValueOnce(analysis("retried result"));
    render(createElement(SellerWorkspace, { exit: vi.fn() }));
    await screen.findByText("old result");
    act(() => mocks.apply!([{ ...line, quantity: 2 }]));
    expect(screen.getByText("old result")).toBeInTheDocument();
    expect(screen.getByLabelText("My cost basis")).toBeDisabled();
    expect(screen.getByLabelText("Glance readiness")).toHaveTextContent("Updating");
    await act(async () => changed.reject(new Error("Snapshot unavailable")));
    expect(screen.getByLabelText("My cost basis")).toBeDisabled();
    expect(screen.getByText("Retry analysis to update seller economics.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry analysis" }));
    expect(await screen.findByText("retried result")).toBeInTheDocument();
  });
});
