import { describe, expect, it } from "vitest";
import { cardDisplayName, cardTreatmentLabel } from "./card-label";
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

  it("shows every combined variant once", () => {
    expect(cardDisplayName({ ...card, treatments: ["Borderless", "Fracture Foil"] }, "fracture"))
      .toBe("Nut Collector (Borderless, Fracture Foil)");
  });

  it("does not append generic foil after a named foil process", () => {
    expect(cardDisplayName({ ...card, treatments: ["Borderless", "Surge Foil"] }, "foil"))
      .toBe("Nut Collector (Borderless, Surge Foil)");
  });

  it("describes the exact treatment independently from the card name", () => {
    expect(cardTreatmentLabel(card, "nonfoil")).toBe("Nonfoil");
    expect(cardTreatmentLabel({ ...card, treatments: ["Borderless", "Surge Foil"] }, "foil"))
      .toBe("Borderless, Surge Foil");
  });
});
