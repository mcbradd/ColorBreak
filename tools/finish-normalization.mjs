// @pure
export function finishForSheet(name, sheet) {
  const normalized = name.toLowerCase();
  const namedFinishes = [
    [/serialized/, "serialized"], [/double.?rainbow/, "double-rainbow"],
    [/step.?and.?compleat/, "step-and-compleat"], [/invisible.?ink/, "invisible-ink"],
    [/oil.?slick/, "oil-slick"], [/neon.?ink/, "neon-ink"], [/ripple/, "ripple"],
    [/etched/, "etched"], [/surge/, "surge"], [/textured/, "textured"],
    [/gilded/, "gilded"], [/galaxy/, "galaxy"], [/confetti/, "confetti"],
    [/halo/, "halo"], [/fracture/, "fracture"], [/raised/, "raised"],
    [/silver.?foil/, "silver"], [/rainbow.?foil/, "rainbow"], [/mana.?foil/, "mana"],
    [/magnified/, "magnified"], [/glossy/, "glossy"],
    [/first.?place/, "first-place"], [/dragon.?scale/, "dragon-scale"],
    [/singularity/, "singularity"], [/cosmic/, "cosmic"],
    [/chocobo.?track/, "chocobo-track"], [/facet/, "facet"], [/embossed/, "embossed"],
    [/silver.?scroll/, "silver-scroll"], [/gleaming.?gold/, "gleaming-gold"],
  ];
  for (const [pattern, finish] of namedFinishes) if (pattern.test(normalized)) return finish;
  return sheet.foil ? "foil" : "nonfoil";
}
// @end-pure
