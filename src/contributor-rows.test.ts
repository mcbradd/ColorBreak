import { createElement } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CardMemberList } from "./features/shared/CardMemberList";
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
  it("aligns price, chance and added value and opens details from the thumbnail", () => {
    const inspect = vi.fn();
    render(createElement(CardMemberList, { rows: slot.contributors, onInspect: inspect }));

    expect(screen.getAllByRole("columnheader").map((node) => node.textContent)).toEqual(["Card", "Price", "Chance", "Adds"]);
    expect(screen.getByRole("columnheader", { name: /Price/ })).toHaveAttribute("aria-sort", "descending");

    const row = screen.getAllByRole("row")[1];
    expect(within(row).getByRole("cell", { name: "25.0% pull chance" })).toBeInTheDocument();
    expect(within(row).getByRole("cell", { name: "$12.00 market price" })).toBeInTheDocument();
    expect(row).toHaveTextContent("Nonfoil · TST #1");
    // Card art loads from the snapshot's own Scryfall URL; the initial-letter
    // tile is only the fallback when there is no image or it fails to load.
    expect(row.querySelector("img.card-thumbnail")).toHaveAttribute("src", "https://cards.scryfall.io/example.jpg");
    fireEvent.click(within(row).getByRole("button", { name: /Open Helpful Dragon/ }));
    expect(inspect).toHaveBeenCalledWith(contributor);
  });

  it("sorts every column in both directions using exact finish prices", () => {
    const rows: Contributor[] = [
      { ...contributor, sellableValue: 30 },
      { ...contributor, card: { ...contributor.card, id: "a", name: "Adept", nonfoil: 1, foil: 100 }, finish: "foil", sellablePullProbability: .02, sellableValue: 2 },
      { ...contributor, card: { ...contributor.card, id: "z", name: "Zealot", nonfoil: 50 }, sellablePullProbability: .5, sellableValue: 25 },
    ];
    render(createElement(CardMemberList, { rows, onInspect: vi.fn() }));
    const names = () => screen.getAllByRole("row").slice(1).map((row) => row.querySelector("strong")!.textContent);
    expect(names()).toEqual(["Adept", "Zealot", "Helpful Dragon"]);
    for (const [column, ascending, descending] of [
      ["Price", ["Helpful Dragon", "Zealot", "Adept"], ["Adept", "Zealot", "Helpful Dragon"]],
      ["Card", ["Adept", "Helpful Dragon", "Zealot"], ["Zealot", "Helpful Dragon", "Adept"]],
      ["Chance", ["Adept", "Helpful Dragon", "Zealot"], ["Zealot", "Helpful Dragon", "Adept"]],
      ["Adds", ["Adept", "Zealot", "Helpful Dragon"], ["Helpful Dragon", "Zealot", "Adept"]],
    ] as const) {
      fireEvent.click(screen.getByRole("button", { name: new RegExp(`Sort by ${column}`) }));
      const firstAscending = column === "Price" || column === "Card";
      expect(names()).toEqual(firstAscending ? ascending : descending);
      expect(screen.getByRole("columnheader", { name: new RegExp(column) })).toHaveAttribute("aria-sort", firstAscending ? "ascending" : "descending");
      fireEvent.click(screen.getByRole("button", { name: new RegExp(`Sort by ${column}`) }));
      expect(names()).toEqual(firstAscending ? descending : ascending);
    }
    expect(rows.map(row => row.card.name)).toEqual(["Helpful Dragon", "Adept", "Zealot"]);
  });
});

