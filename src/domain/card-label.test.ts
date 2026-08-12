import { describe, expect, it } from "vitest";
import { cardDisplayName } from "./card-label";
import type { CardPrice } from "./types";

const card: CardPrice = {
  id: "one", set: "TST", collectorNumber: "1", name: "Nut Collector",
  slot: "G", nonfoil: 8.41, foil: 5.58,
};

describe("card display identity", () => {
  it("leaves a base nonfoil name unqualified", () => {
    expect(cardDisplayName(card, "nonfoil")).toBe("Nut Collector");
  });

  it("qualifies every non-base treatment consistently", () => {
    expect(cardDisplayName(card, "foil")).toBe("Nut Collector (Foil)");
    expect(cardDisplayName({ ...card, treatment: "Showcase" }, "nonfoil"))
      .toBe("Nut Collector (Showcase)");
    expect(cardDisplayName({ ...card, treatment: "Showcase" }, "foil"))
      .toBe("Nut Collector (Showcase, Foil)");
  });
});
