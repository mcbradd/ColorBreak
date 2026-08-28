import { describe, expect, it, vi } from "vitest";
import { addTcgListingFallbacks } from "../tools/tcg-listing-prices.mjs";

describe("TCG listing price fallback", () => {
  it("adds a foil listing when the market feeds omit a required premium finish", async () => {
    const card = {
      set: "tmc",
      collector_number: "70",
      tcgplayer_id: 679628,
      prices: { usd: "0.26", usd_foil: null, usd_etched: null },
      tcgplayer: { observedAt: "2026-08-28T00:00:00.000Z", prices: { nonfoil: { market: 0.26, listed: 0.15 } } },
    };
    const lookup = vi.fn().mockResolvedValue(28.3959);

    const added = await addTcgListingFallbacks(
      [card],
      new Map([["TMC|70", { finishes: new Set(["surge"]) }]]),
      { lookup, observedAt: "2026-08-28T01:00:00.000Z" },
    );

    expect(lookup).toHaveBeenCalledWith(679628, "foil");
    expect(added).toBe(1);
    expect(card.tcgplayer.prices.foil).toEqual({ market: null, listed: 28.4 });
  });

  it("does not query listings when an exact foil price is already available", async () => {
    const card = {
      set: "tmc",
      collector_number: "70",
      tcgplayer_id: 679628,
      prices: { usd: "0.26", usd_foil: null, usd_etched: null },
      tcgplayer: { observedAt: "2026-08-28T00:00:00.000Z", prices: { foil: { market: null, listed: 4.25 } } },
    };
    const lookup = vi.fn();

    const added = await addTcgListingFallbacks(
      [card],
      new Map([["TMC|70", { finishes: new Set(["surge"]) }]]),
      { lookup, observedAt: "2026-08-28T01:00:00.000Z" },
    );

    expect(lookup).not.toHaveBeenCalled();
    expect(added).toBe(0);
  });
});
