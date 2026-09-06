import { createElement } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { calculateBreak } from "./domain/valuation";
import { answerFactors } from "./domain/answer-quality";
import { approximateOutcomes } from "./domain/approximate-outcomes";
import { simulateOutcomes } from "./domain/simulation";
import { quickOutcomes } from "./domain/quick-outcomes";
import { bestAvailableAnalysis, rememberAnswer } from "./data/answer-cache";
import { AnswerProvider, AnswerValue } from "./features/shared/Answer";
import type { BreakAnalysis } from "./data/evaluate";
import type { BreakLine } from "./domain/types";

function fixture(): BreakAnalysis {
  return {
    valuation: calculateBreak({ threshold: 0, dataVersion: "priced", prices: [{ id: "a", set: "CACHE", collectorNumber: "1", name: "Card", slot: "W", nonfoil: 20, foil: null }], draws: [{ set: "CACHE", collectorNumber: "1", copies: 1, foil: false, source: "fixed" }] }),
    outcomeModel: { complete: true, fixed: [{ id: "a", slot: "W", value: 20 }], packs: [] }, outcomeOmissions: [],
    priceAvailability: { source: "snapshot", status: "available", message: "Loaded" },
  };
}

describe("best available answers", () => {
  it("scales matching products instantly and never borrows another product's value", () => {
    const line: BreakLine = { id: "a", set: "CACHE", productKey: "sealed:a", productLabel: "A", quantity: 1 };
    rememberAnswer(line, 0, fixture());
    const next = bestAvailableAnalysis([{ ...line, quantity: 3 }], 0);
    expect(next.valuation.sellableEV).toBe(60);
    expect(next.outcomeModel.fixed[0].count).toBe(3);
    const changed = bestAvailableAnalysis([{ ...line, productKey: "sealed:b", quantity: 3 }], 0);
    expect(changed.valuation.sellableEV).toBe(0);
    expect(answerFactors(changed.valuation)).toContain("Products without loaded prices currently add $0 to the known total. This does not mean they are worthless.");
    expect(bestAvailableAnalysis([{ ...line, packCount: 24 }], 0).valuation.sellableEV).toBe(0);
  });

  it("keeps the loaded price when a refresh has no price source", () => {
    const line: BreakLine = { id: "b", set: "CACHE", productKey: "sealed:refresh", productLabel: "Refresh", quantity: 1 };
    rememberAnswer(line, 0, fixture());
    rememberAnswer(line, 0, { ...fixture(), valuation: calculateBreak({ draws: [], prices: [] }), priceAvailability: { source: "none", status: "unavailable", message: "Offline" } });
    expect(bestAvailableAnalysis([line], 0).valuation.sellableEV).toBe(20);
  });

  it("distinguishes instant analytic previews from sampled opening percentiles", () => {
    const answer = quickOutcomes(fixture().valuation, ["W", "U"], 5);
    expect(answer.remainingPool.mean).toBe(10);
    expect(answer.slotDistributions.W.mean).toBe(20);
    expect(answer.sampleCount).toBe(0);
    expect(answer.remainingPool.preview).toBe(true);
    expect(quickOutcomes(fixture().valuation, []).remainingPool.mean).toBe(0);
  });

  it("shows possible endpoints immediately, before sampling refines the median", () => {
    const analysis = fixture();
    const model = { ...analysis.outcomeModel, fixed: [], packs: [{ count: 1, variants: [{ weight: 1, picks: { choice: 1 } }], sheets: { choice: { totalWeight: 2, cards: [{ id: "blank", slot: "W" as const, value: 0 }, { id: "hit", slot: "W" as const, value: 100 }] } } }] };
    const preview = quickOutcomes(analysis.valuation, ["W"], undefined, model);
    expect(preview.sampleCount).toBe(0);
    expect(preview.slotDistributions.W.min).toBe(0);
    expect(preview.slotDistributions.W.max).toBe(100);
    expect(preview.remainingPool.max).toBe(100);
  });

  it("a disclosed independent-card model preserves analytic expected value", () => {
    const value = fixture().valuation;
    const model = approximateOutcomes(value);
    const sampled = simulateOutcomes(model, { seed: "approximation", sampleCount: 20_000, remaining: ["W"] });
    expect(model.complete).toBe(false);
    expect(sampled.remainingPool.mean).toBeCloseTo(value.sellableEV, 0);
    expect(sampled.remainingPool.p10).toBeLessThan(sampled.remainingPool.p90);
  });

  it("keeps values visible with concise, keyboard-operable explanations and no parent action", () => {
    const parent = vi.fn();
    render(createElement("div", { onClick: parent }, createElement(AnswerProvider, { value: ["Prices are older. Today's selling prices may differ."] }, createElement(AnswerValue, { value: 12, detail: "Shipping is assumed $0." }))));
    const note = screen.getByRole("button", { name: "What affects this estimate" });
    expect(screen.getByText("$12.00")).toBeInTheDocument();
    fireEvent.click(note);
    expect(parent).not.toHaveBeenCalled();
    expect(screen.getByRole("tooltip")).toHaveTextContent("Shipping is assumed $0.");
    expect(screen.getByRole("tooltip")).toHaveTextContent("Prices are older.");
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    expect(note).toHaveFocus();
    fireEvent.keyDown(note, { key: "Enter" });
    expect(screen.getByRole("tooltip")).toBeInTheDocument();
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("does not confuse an unknown value with a confirmed zero", () => {
    render(createElement(AnswerValue, { value: undefined }));
    expect(screen.getByText("$0.00")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "What affects this estimate" }));
    expect(screen.getByRole("tooltip")).toHaveTextContent("not a confirmed zero");
  });
  it("clamps its popover to a panned visual viewport and follows keyboard resizing", () => {
    const viewport = Object.assign(new EventTarget(), { width: 320, height: 220, offsetLeft: 0, offsetTop: 80 });
    vi.stubGlobal("visualViewport", viewport);
    const rectangles = vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
      return this.classList.contains("tip-popover")
        ? { x: 0, y: 0, left: 0, top: 0, right: 260, bottom: 130, width: 260, height: 130, toJSON() {} }
        : { x: 290, y: 270, left: 290, top: 270, right: 318, bottom: 298, width: 28, height: 28, toJSON() {} };
    });
    try {
      render(createElement(AnswerValue, { value: 10 }));
      fireEvent.click(screen.getByRole("button", { name: "What affects this estimate" }));
      const popup = screen.getByRole("tooltip");
      expect(Number.parseFloat(popup.style.left)).toBeGreaterThanOrEqual(12);
      expect(Number.parseFloat(popup.style.left) + 260).toBeLessThanOrEqual(308);
      expect(Number.parseFloat(popup.style.top)).toBeGreaterThanOrEqual(92);
      expect(Number.parseFloat(popup.style.top) + 130).toBeLessThanOrEqual(288);
      viewport.height = 190;
      fireEvent(viewport, new Event("resize"));
      expect(Number.parseFloat(popup.style.top) + 130).toBeLessThanOrEqual(258);
    } finally { rectangles.mockRestore(); vi.unstubAllGlobals(); }
  });

});
