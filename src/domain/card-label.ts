import type { CardPrice, Finish } from "./types";

const FINISH_LABELS: Record<Finish, string> = {
  nonfoil: "Nonfoil",
  foil: "Foil",
  etched: "Etched Foil",
  surge: "Surge Foil",
  textured: "Textured Foil",
  gilded: "Gilded Foil",
  serialized: "Serialized",
  other: "Special Treatment",
};

export function cardDisplayName(card: CardPrice, finish: Finish = "nonfoil"): string {
  const treatments = [card.treatment, finish === "nonfoil" ? undefined : FINISH_LABELS[finish]].filter(Boolean);
  return treatments.length ? `${card.name} (${treatments.join(", ")})` : card.name;
}
