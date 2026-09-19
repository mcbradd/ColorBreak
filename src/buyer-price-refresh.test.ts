import { createElement } from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { BuyerWorkspace } from "./features/buyer/BuyerWorkspace";
import { calculateBreak } from "./domain/valuation";
import { rememberAnswer } from "./data/answer-cache";
import type { BreakAnalysis } from "./data/evaluate";
import type { PriceRefreshResult } from "./data/scryfall";

const { evaluateBreakAnalysis, refreshPublishedPrices } = vi.hoisted(() => ({
  evaluateBreakAnalysis: vi.fn(), refreshPublishedPrices: vi.fn(),
}));
vi.mock("./data/evaluate", () => ({ evaluateBreakAnalysis }));
vi.mock("./data/scryfall", async (importOriginal) => ({
  ...await importOriginal<typeof import("./data/scryfall")>(), refreshPublishedPrices,
}));
vi.mock("./data/catalog", () => ({ catalogSets: [], productsForSet: vi.fn().mockResolvedValue([]), readinessForProduct: vi.fn() }));

const line = { id: "refresh-line", set: "TST", productKey: "play-box", productLabel: "Play Booster Box", quantity: 1, tcgId: 1, marketCost: 100 };
function analysis(value: number, threshold = 2): BreakAnalysis {
  return {
    valuation: calculateBreak({
      prices: [{ id: "w", set: "TST", collectorNumber: "1", name: "White Card", slot: "W", nonfoil: value, foil: null }],
      draws: [{ set: "TST", collectorNumber: "1", copies: 1, foil: false, source: "fixed" }],
      threshold, pricedAt: new Date(Date.now() - 9 * 3600000).toISOString(), dataVersion: `prices:${value}`,
    }),
    outcomeModel: { complete: true, packs: [], fixed: [{ id: "w", slot: "W", value }] },
    outcomeOmissions: [], priceAvailability: { status: "available", source: "snapshot", message: "Loaded published prices." },
  };
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const whiteMembers = () => within(screen.getByRole("table", { name: "Cards in White team" }));
async function begin(prepareRefresh: () => void = () => {}) {
  render(createElement(BuyerWorkspace, { exit: () => {}, startFresh: false, startReady: false }));
  await screen.findByRole("button", { name: /Prices over 6 hours old/ });
  await waitFor(() => expect(screen.queryByText("Improving the estimate…")).not.toBeInTheDocument());
  prepareRefresh();
  fireEvent.click(screen.getByRole("button", { name: /Prices over 6 hours old/ }));
}
beforeEach(() => {
  evaluateBreakAnalysis.mockReset().mockResolvedValue(analysis(20));
  refreshPublishedPrices.mockReset().mockResolvedValue("updated");
  rememberAnswer(line, 2, analysis(20));
  sessionStorage.setItem("colorbreak:buyer:draft:v1", JSON.stringify([line]));
});

it("keeps refresh busy until the refreshed valuation is applied", async () => {
  const pending = deferred<BreakAnalysis>();
  await begin(() => evaluateBreakAnalysis.mockReturnValueOnce(pending.promise));
  expect(await screen.findByRole("button", { name: "Checking…" })).toBeDisabled();
  expect(screen.queryByText("Newer prices are in this estimate.")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Checking…" }));
  expect(refreshPublishedPrices).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole("button", { name: "Show cards in White team" }));
  expect(whiteMembers().getByLabelText("$20.00 market price")).toBeInTheDocument();
  await act(async () => pending.resolve(analysis(40)));
  expect(screen.getByRole("button", { name: "Updated" })).toBeEnabled();
  expect(whiteMembers().getByLabelText("$40.00 market price")).toBeInTheDocument();
  expect(screen.getByText("Newer prices are in this estimate.")).toBeInTheDocument();
});

it("offers retry and preserves the prior estimate if recalculation fails", async () => {
  const pending = deferred<BreakAnalysis>();
  await begin(() => evaluateBreakAnalysis.mockReturnValueOnce(pending.promise));
  await screen.findByRole("button", { name: "Checking…" });
  await act(async () => pending.reject(new Error("Price evaluation failed")));
  expect(screen.getByRole("button", { name: "Retry", exact: true })).toBeEnabled();
  expect(screen.queryByText("Newer prices are in this estimate.")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Show cards in White team" }));
  expect(whiteMembers().getByLabelText("$20.00 market price")).toBeInTheDocument();
});

it.each(["publication", "assessment"])("ignores a completed %s from a previous threshold", async (phase) => {
  const publication = deferred<PriceRefreshResult>();
  const assessment = deferred<BreakAnalysis>();
  if (phase === "publication") refreshPublishedPrices.mockReturnValueOnce(publication.promise);
  await begin(() => { if (phase === "assessment") evaluateBreakAnalysis.mockReturnValueOnce(assessment.promise); });
  await screen.findByRole("button", { name: phase === "publication" ? "Searching…" : "Checking…" });
  evaluateBreakAnalysis.mockResolvedValue(analysis(30, 0));
  fireEvent.click(screen.getByRole("switch", { name: /Bulk filter/ }));
  await waitFor(() => expect(screen.getByRole("button", { name: /Prices over 6 hours old/ })).toBeEnabled());
  await act(async () => { publication.resolve("updated"); assessment.resolve(analysis(99)); });
  expect(screen.queryByRole("button", { name: "Updated" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Show cards in White team" }));
  expect(whiteMembers().getByLabelText("$30.00 market price")).toBeInTheDocument();
});
