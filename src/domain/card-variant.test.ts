import { describe, expect, it } from "vitest";
import { printingVariants, PROMO_VARIANT_LABELS, treatmentMetadata } from "./card-variant";

describe("printing variant normalization", () => {
  it("preserves combined frame, showcase, and foil treatments", () => {
    expect(printingVariants({
      borderColor: "borderless",
      frameEffects: ["showcase"],
      promoTypes: ["fracturefoil"],
    })).toEqual(["Borderless", "Showcase", "Fracture Foil"]);
  });

  it("recognizes universal retro frames and Phyrexian-language variants", () => {
    expect(printingVariants({ frame: "1997", language: "ph" }))
      .toEqual(["Retro Frame", "Phyrexian Language"]);
  });

  it("labels fictional-script chase printings as treatments rather than foreign cards", () => {
    expect(printingVariants({ set: "HOC", collectorNumber: "96", language: "dw" }))
      .toContain("Dwarvish Script");
    expect(printingVariants({ set: "LTC", collectorNumber: "408", language: "qya" }))
      .toContain("Elven Ring Script");
    expect(printingVariants({ set: "LTC", collectorNumber: "409", language: "qya" }))
      .toContain("Dwarven Ring Script");
    expect(printingVariants({ set: "LTC", collectorNumber: "410", language: "qya" }))
      .toContain("Human Ring Script");
    expect(printingVariants({ set: "LTC", collectorNumber: "409z", language: "qya" }))
      .toContain("Dwarven Ring Script");
  });

  it("covers every registered special appearance and foiling process", () => {
    for (const [key, label] of Object.entries(PROMO_VARIANT_LABELS)) {
      expect(printingVariants({ promoTypes: [key] }), key).toContain(label);
    }
  });

  it("surfaces unfamiliar future variants with a readable label", () => {
    expect(printingVariants({ promoTypes: ["prismaticwavefoil"] }))
      .toEqual(["Prismaticwave Foil"]);
    expect(printingVariants({ frameEffects: ["future_frame"] }))
      .toEqual(["Future Frame"]);
  });

  it("retains raw facets and classifies process, style, scarcity, and unknown tags independently", () => {
    expect(treatmentMetadata({
      frameEffects: ["showcase"],
      promoTypes: ["japanshowcase", "fracturefoil", "serialized", "futureprocess"],
      finishes: ["foil"],
      variationOf: "related-id",
    })).toMatchObject({
      rawFrameEffects: ["showcase"],
      rawPromoTypes: ["japanshowcase", "fracturefoil", "serialized", "futureprocess"],
      finishClasses: ["foil"],
      styleTags: ["showcase", "japanshowcase"],
      processTags: ["fracturefoil"],
      attributeTags: ["serialized"],
      unknownTags: ["futureprocess"],
      variationOf: "related-id",
    });
  });

  it("does not mislabel rules frames or sales channels as treatments", () => {
    expect(printingVariants({
      frameEffects: ["legendary", "convertdfc"],
      promoTypes: ["prerelease", "bundle", "promopack"],
    })).toEqual([]);
  });
});
