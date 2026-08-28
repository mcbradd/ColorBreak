import type { CardPrice, Finish } from "./types";

const FINISH_LABELS: Record<Finish, string> = {
  nonfoil: "Nonfoil",
  foil: "Foil",
  etched: "Etched Foil",
  surge: "Surge Foil",
  textured: "Textured Foil",
  gilded: "Gilded Foil",
  galaxy: "Galaxy Foil",
  confetti: "Confetti Foil",
  halo: "Halo Foil",
  ripple: "Ripple Foil",
  fracture: "Fracture Foil",
  raised: "Raised Foil",
  "neon-ink": "Neon Ink Foil",
  "oil-slick": "Oil Slick Raised Foil",
  "step-and-compleat": "Step-and-Compleat Foil",
  "double-rainbow": "Double Rainbow Foil",
  silver: "Silver Foil",
  rainbow: "Rainbow Foil",
  mana: "Mana Foil",
  magnified: "Magnified Foil",
  "invisible-ink": "Invisible Ink",
  "first-place": "First-Place Foil",
  "dragon-scale": "Dragon Scale Foil",
  singularity: "Singularity Foil",
  cosmic: "Cosmic Foil",
  "chocobo-track": "Chocobo Track Foil",
  facet: "Facet Foil",
  "silver-scroll": "Silver Scroll Foil",
  "gleaming-gold": "Gleaming-Gold Foil",
  embossed: "Embossed Foil",
  glossy: "Glossy",
  serialized: "Serialized",
  other: "Premium Foil",
};

export function cardDisplayName(card: CardPrice, finish: Finish = "nonfoil"): string {
  const variants = card.treatments ?? (card.treatment ? [card.treatment] : []);
  const hasNamedProcess = Boolean(card.treatmentMetadata?.processTags.length) ||
    variants.some((label) => /foil|glossy|invisible ink/i.test(label));
  const finishLabel = finish === "nonfoil" || (finish === "foil" && hasNamedProcess)
    ? undefined
    : FINISH_LABELS[finish];
  const treatments = [...variants, finishLabel].filter((label, index, all): label is string =>
    Boolean(label) && all.indexOf(label) === index);
  return treatments.length ? `${card.name} (${treatments.join(", ")})` : card.name;
}
