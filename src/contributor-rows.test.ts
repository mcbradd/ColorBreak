import { createElement } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ContributorRows } from "./App";
import type { Contributor, SlotValuation } from "./domain/types";

const contributor: Contributor = {
  card: {
    id: "card-1",
    set: "TST",
    collectorNumber: "1",
    name: "Helpful Dragon",
    slot: "R",
    nonfoil: 12,
    foil: null,
    image: "https://cards.scryfall.io/example.jpg",
  },
  copies: 0.25,
  sellableCopies: 0.25,
  marketValue: 3,
  sellableValue: 3,
  foilCopies: 0,
  sellableFoilCopies: 0,
  pullProbability: 0.25,
  sellablePullProbability: 0.25,
};

const slot: SlotValuation = {
  id: "R",
  name: "Red",
  marketEV: 3,
  sellableEV: 3,
  knownEV: 3,
  contributors: [contributor],
  chaseShare: 1,
  withoutChase: 0,
};

describe("shared contributor rows", () => {
  it("shows pull odds before average contribution and opens from the whole card row", () => {
    const inspect = vi.fn();
    const { container } = render(createElement(ContributorRows, { slot, onInspect: inspect }));

    const headers = [...container.querySelectorAll(".contributor-columns > span")].map((node) => node.textContent);
    expect(headers).toEqual(["Card and exact printing", "Pull odds", "Adds to average"]);

    const row = screen.getByRole("button", { name: /Open Helpful Dragon/ });
    expect(row).toHaveTextContent("25.0%");
    expect(row).toHaveTextContent("$12.00 · Nonfoil · TST");
    expect(row.querySelector(".card-thumbnail")).toHaveTextContent("H");
    fireEvent.click(row);
    expect(inspect).toHaveBeenCalledWith(contributor);
  });
});
