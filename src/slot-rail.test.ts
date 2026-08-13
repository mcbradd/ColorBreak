import { createElement, useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SlotRail } from "./App";
import type { SlotId, ValuationResult } from "./domain/types";

const result = {
  marketEV: 9,
  sellableEV: 9,
  knownEV: 9,
  threshold: 2,
  status: "verified",
  statusReason: "Complete",
  omissions: [],
  slots: ["W", "U", "B", "R", "G", "M", "C", "L"].map((id, index) => ({
    id,
    name: id,
    marketEV: index + 1,
    sellableEV: index + 1,
    knownEV: index + 1,
    contributors: [],
    chaseShare: 0,
    withoutChase: index + 1,
  })),
} as ValuationResult;

function Harness() {
  const [selected, setSelected] = useState<SlotId>("W");
  return createElement(SlotRail, { result, selected, setSelected });
}

describe("color slot inspector rail", () => {
  afterEach(() => vi.restoreAllMocks());

  it("keeps the rail at the same viewport position when selection-dependent content changes height", () => {
    let top = 240;
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(() => ({
      top,
      bottom: top + 80,
      left: 0,
      right: 320,
      width: 320,
      height: 80,
      x: 0,
      y: top,
      toJSON: () => ({}),
    }));
    const scrollBy = vi.spyOn(window, "scrollBy").mockImplementation(() => {});
    render(createElement(Harness));

    const blue = screen.getByRole("tab", { name: "U slot" });
    fireEvent.pointerDown(blue);
    top = 96;
    fireEvent.click(blue);

    expect(scrollBy).toHaveBeenCalledWith({ behavior: "instant", top: -144 });
  });
});
