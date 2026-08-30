import { createElement } from "react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ChaseConstellation } from "./features/buyer/BuyerDetails";
import type { Contributor, SlotValuation } from "./domain/types";

const contributor = (id: string, price: number, probability: number, value: number): Contributor => ({
  card: { id, set: "TST", collectorNumber: id, name: `Card ${id}`, slot: "G", nonfoil: price, foil: null },
  finish: "nonfoil",
  marketPrice: price,
  copies: value / price,
  sellableCopies: value / price,
  marketValue: value,
  sellableValue: value,
  foilCopies: 0,
  sellableFoilCopies: 0,
  pullProbability: probability,
  sellablePullProbability: probability,
});

describe("Chase Map presentation", () => {
  it("keeps numbered points readable when cards share the same chart coordinates", () => {
    const contributors = Array.from({ length: 2 }, (_, index) =>
      contributor(`cluster-${index + 1}`, 20, .1, 2),
    );
    const slot: SlotValuation = {
      id: "G", name: "Green", marketEV: 24, sellableEV: 24, knownEV: 24,
      contributors, chaseShare: 1, withoutChase: 0,
    };
    const { container } = render(createElement(ChaseConstellation, { slot, onInspect: vi.fn() }));
    const points = Array.from(container.querySelectorAll<HTMLElement>(".chase-point"))
      .map((point) => ({
        x: Number.parseFloat(point.style.left) / 100 * 320,
        y: Number.parseFloat(point.style.top) / 100 * 300,
        diameter: Number.parseFloat(point.style.width),
      }));

    expect(points).toHaveLength(2);
    for (let first = 0; first < points.length; first += 1) {
      for (let second = first + 1; second < points.length; second += 1) {
        const distance = Math.hypot(
          points[first].x - points[second].x,
          points[first].y - points[second].y,
        );
        expect(distance).toBeGreaterThanOrEqual(
          (points[first].diameter + points[second].diameter) / 2 + 2,
        );
      }
    }
  });

  it("labels the x-axis with the highest displayed chance and explains dot size", () => {
    const contributors = [
      contributor("one", 8.41, .0083, 1),
      contributor("two", 5.58, .28, 2),
    ];
    const slot: SlotValuation = {
      id: "G", name: "Green", marketEV: 3, sellableEV: 3, knownEV: 3,
      contributors, chaseShare: 2 / 3, withoutChase: 1,
    };
    const { container } = render(createElement(ChaseConstellation, { slot, onInspect: vi.fn() }));

    expect(container.querySelector(".plot-odds-high")).toHaveTextContent("28.0%");
    expect(container.querySelector(".plot-odds-high")).not.toHaveTextContent("100%");
    expect(container.querySelector(".chase-size-legend")).toHaveTextContent("Larger dot adds more to average value");
    expect(container.querySelector(".chase-chart-key")).toHaveTextContent("X Chance to pull");
    expect(container.querySelector(".chase-chart-key")).toHaveTextContent("Y Market price");
    expect(container.querySelector(".chase-axis-overlay")).not.toBeInTheDocument();
    expect(container.querySelector("summary .disclosure-arrow")).toBeInTheDocument();
    expect(container.firstElementChild).toHaveClass("rollout");
    expect(container.firstElementChild).not.toHaveClass("panel");
    expect(container.querySelector(".chase-pointers")).not.toBeInTheDocument();
    expect(container.querySelectorAll(".chase-point")).toHaveLength(2);
  });

  it("uses a stable flat chart background without an animated fading layer", () => {
    const css = readFileSync(join(process.cwd(), "src", "supplemental.css"), "utf8");
    expect(css).not.toContain("chase-grid-drift");
    expect(css).not.toContain(".chase-plot::after");
    expect(css).not.toContain(".chase-pointers");
  });
});

