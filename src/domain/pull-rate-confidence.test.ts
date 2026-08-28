import { describe, expect, it } from "vitest";
import { pullRateEvidenceFor, pullRateOmissions } from "./pull-rate-confidence";
import type { CardPrice, ExpectedDraw } from "./types";

const card = (set: string, collectorNumber: string, name: string, tags: string[] = []): CardPrice => ({
  id: `${set}-${collectorNumber}`,
  set,
  collectorNumber,
  name,
  slot: "C",
  nonfoil: 100,
  foil: 100,
  treatmentMetadata: {
    rawFrameEffects: [], rawPromoTypes: [], finishClasses: ["foil"], styleTags: [], processTags: [],
    attributeTags: tags, unknownTags: [], fullArt: false, textless: false,
  },
});

describe("pull-rate confidence", () => {
  it("distinguishes published per-card rates from published bounds without inventing precision", () => {
    expect(pullRateEvidenceFor(card("HOC", "96", "Mox Amber"))?.status).toBe("unverifiable");
    expect(pullRateEvidenceFor(card("HOB", "275", "Gleaming Splendor"))?.status).toBe("unverifiable");
    expect(pullRateEvidenceFor(card("EOE", "382", "Sothera", ["headliner"]))?.status).toBe("unverifiable");
    expect(pullRateEvidenceFor(card("HOB", "249", "Smaug", ["headliner"]))?.status).toBe("unverifiable");
    expect(pullRateEvidenceFor(card("LTC", "408", "Sol Ring"))?.status).toBe("unverifiable");
  });

  it("names the affected printing, selected-break estimate, published fact, and impact", () => {
    const prices = [card("EOE", "382", "Sothera, the Supervoid", ["headliner"])];
    const draws: ExpectedDraw[] = [{
      set: "EOE", collectorNumber: "382", copies: 0.002, pullProbability: 0.002,
      finish: "singularity", foil: true, source: "collector/foilBoosterfun",
    }];

    const omissions = pullRateOmissions(draws, prices);

    expect(omissions).toHaveLength(1);
    expect(omissions[0]).toEqual(expect.objectContaining({
      code: "unverifiable-pull-rate",
      dedupeKey: "pull-rate:EOE|382|singularity",
      material: true,
    }));
    expect(omissions[0].message).toMatch(/Sothera.*less than 1%.*0\.20%.*excluded from expected value/i);
  });
});
