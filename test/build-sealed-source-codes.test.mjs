import { describe, expect, it } from "vitest";
import { sourceSetCandidates } from "../tools/sealed-source-resolution.mjs";

describe("sealed booster source-set resolution", () => {
  it("uses MTGJSON sourceSetCodes for unresolved sheet UUIDs", () => {
    const data = {
      code: "DMU",
      booster: {
        collector: { sourceSetCodes: ["DMC", "DMU", "LEG"] },
        set: { sourceSetCodes: ["DMC", "DMU", "PLST", "SLX"] },
      },
    };
    const refs = [
      { booster: "collector", sheet: "lostLegends", uuid: "one" },
      { booster: "set", sheet: "theList", uuid: "two" },
    ];

    expect(sourceSetCandidates(data, refs)).toEqual(["DMC", "LEG", "PLST", "SLX"]);
  });
});
