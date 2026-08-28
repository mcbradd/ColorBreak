import { describe, expect, it } from "vitest";
import snapshotIndex from "../../data/prices/index.json";
import { treatmentMetadata } from "./card-variant";

const catalog = snapshotIndex.treatmentCatalog;

describe("committed treatment catalog", () => {
  it("classifies every frame effect and promo type currently used by a valued printing", () => {
    for (const tag of catalog.frameEffects) {
      expect(treatmentMetadata({ frameEffects: [tag] }).unknownTags, `frame effect: ${tag}`).toEqual([]);
    }
    for (const tag of catalog.promoTypes) {
      expect(treatmentMetadata({ promoTypes: [tag] }).unknownTags, `promo type: ${tag}`).toEqual([]);
    }
  });

  it("uses only supported marketplace price classes", () => {
    expect(catalog.finishClasses).toEqual(["etched", "foil", "nonfoil"]);
  });
});
