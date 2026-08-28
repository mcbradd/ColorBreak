import { describe, expect, it } from "vitest";
// The generator is deliberately plain ESM so production data builds do not need TypeScript.
// @ts-expect-error JavaScript generator modules do not ship declaration files.
import { finishForSheet } from "../../tools/finish-normalization.mjs";

describe("sealed sheet finish normalization", () => {
  it.each([
    ["etched foil", "etched"], ["surge foil", "surge"], ["textured", "textured"],
    ["gilded", "gilded"], ["galaxy foil", "galaxy"], ["confetti foil", "confetti"],
    ["halo foil", "halo"], ["ripple foil-etched", "ripple"], ["fracture foil", "fracture"],
    ["raised foil", "raised"], ["neon ink", "neon-ink"], ["oil slick", "oil-slick"],
    ["step and compleat", "step-and-compleat"], ["double rainbow", "double-rainbow"],
    ["silver foil", "silver"], ["rainbow foil", "rainbow"], ["mana foil", "mana"],
    ["magnified", "magnified"], ["invisible ink", "invisible-ink"], ["glossy", "glossy"],
    ["first-place foil", "first-place"], ["dragon scale foil", "dragon-scale"],
    ["singularity foil", "singularity"], ["cosmic foil", "cosmic"],
    ["Chocobo track foil", "chocobo-track"], ["facet foil", "facet"],
    ["embossed foil", "embossed"],
    ["silver scroll foil", "silver-scroll"], ["gleaming-gold foil", "gleaming-gold"],
    ["serialized", "serialized"],
  ])("maps %s without collapsing it", (sheetName, expected) => {
    expect(finishForSheet(sheetName, { foil: true })).toBe(expected);
  });

  it("uses ordinary foil/nonfoil classes for unnamed sheets", () => {
    expect(finishForSheet("rare", { foil: true })).toBe("foil");
    expect(finishForSheet("rare", { foil: false })).toBe("nonfoil");
  });
});
