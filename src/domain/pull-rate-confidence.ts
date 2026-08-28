import { cardDisplayName } from "./card-label";
import type { CardPrice, ExpectedDraw, Finish, Omission } from "./types";

export interface PullRateEvidence {
  status: "verified" | "unverifiable";
  publishedFact: string;
  source: string;
}

const WIZARDS_EOE = "https://magic.wizards.com/en/news/feature/collecting-edge-of-eternities";
const WIZARDS_HOB = "https://magic.wizards.com/en/news/feature/collecting-the-hobbit";
const WIZARDS_LTR = "https://magic.wizards.com/en/news/feature/collecting-the-lord-of-the-rings-tales-of-middle-earth";

const EXACT_EVIDENCE: Record<string, PullRateEvidence> = {
  "EOE|382": {
    status: "unverifiable",
    publishedFact: "Wizards states that it appears in less than 1% of Collector Boosters, but does not publish an exact rate",
    source: WIZARDS_EOE,
  },
  "HOB|249": {
    status: "unverifiable",
    publishedFact: "Wizards states that approximately 500 copies exist, but does not publish the total number of eligible Collector Boosters",
    source: WIZARDS_HOB,
  },
  "HOB|275": {
    status: "unverifiable",
    publishedFact: "Wizards publishes a 1.8% rate for the six-card mythic surge-foil book-cover category, but does not publish an exact rate for this card within that category",
    source: WIZARDS_HOB,
  },
  "HOC|96": {
    status: "unverifiable",
    publishedFact: "Wizards publishes category rates for the five Dwarvish cards, but does not publish an exact rate for Mox Amber within that category",
    source: WIZARDS_HOB,
  },
  "HOC|96|nonfoil": {
    status: "unverifiable",
    publishedFact: "Wizards publishes a 1.5% rate for the five-card nonfoil Dwarvish category, but does not publish an exact rate for Mox Amber within that category",
    source: WIZARDS_HOB,
  },
  "HOC|96|foil": {
    status: "unverifiable",
    publishedFact: "Wizards publishes a 1.6% rate for the five-card traditional-foil Dwarvish category, but does not publish an exact rate for Mox Amber within that category",
    source: WIZARDS_HOB,
  },
  "LTC|408": {
    status: "unverifiable",
    publishedFact: "Wizards publishes 3,000 nonfoil Elven Ring copies, but not the total number of eligible Collector Boosters",
    source: WIZARDS_LTR,
  },
  "LTC|409": {
    status: "unverifiable",
    publishedFact: "Wizards publishes 7,000 nonfoil Dwarven Ring copies, but not the total number of eligible Collector Boosters",
    source: WIZARDS_LTR,
  },
  "LTC|410": {
    status: "unverifiable",
    publishedFact: "Wizards publishes 9,000 nonfoil Human Ring copies, but not the total number of eligible Collector Boosters",
    source: WIZARDS_LTR,
  },
  "LTC|408z": {
    status: "unverifiable",
    publishedFact: "Wizards publishes 300 serialized Elven Ring copies, but not the total number of eligible Collector Boosters",
    source: WIZARDS_LTR,
  },
  "LTC|409z": {
    status: "unverifiable",
    publishedFact: "Wizards publishes 700 serialized Dwarven Ring copies, but not the total number of eligible Collector Boosters",
    source: WIZARDS_LTR,
  },
  "LTC|410z": {
    status: "unverifiable",
    publishedFact: "Wizards publishes 900 serialized Human Ring copies, but not the total number of eligible Collector Boosters",
    source: WIZARDS_LTR,
  },
};

const keyOf = (card: Pick<CardPrice, "set" | "collectorNumber">) => `${card.set.toUpperCase()}|${card.collectorNumber}`;

export function pullRateEvidenceFor(card: CardPrice, finish?: Finish): PullRateEvidence | undefined {
  const exact = (finish ? EXACT_EVIDENCE[`${keyOf(card)}|${finish}`] : undefined) ?? EXACT_EVIDENCE[keyOf(card)];
  if (exact) return exact;
  if (card.treatmentMetadata?.attributeTags.includes("headliner")) {
    return {
      status: "unverifiable",
      publishedFact: "No exact per-card pull rate has been recorded for this headliner printing",
      source: "",
    };
  }
  return undefined;
}

export function hasUnverifiablePullRate(card: CardPrice, finish: Finish): boolean {
  if (finish === "serialized" || finish === "double-rainbow") return true;
  return pullRateEvidenceFor(card, finish)?.status === "unverifiable";
}

const percent = (probability: number) => `${(probability * 100).toFixed(probability < .01 ? 2 : 1)}%`;

export function pullRateOmissions(draws: ExpectedDraw[], prices: CardPrice[]): Omission[] {
  const cards = new Map(prices.map((card) => [`${card.set}|${card.collectorNumber}`, card]));
  const grouped = new Map<string, { card: CardPrice; finish: Finish; probability: number; copies: number }>();
  for (const draw of draws) {
    const card = cards.get(`${draw.set}|${draw.collectorNumber}`);
    const finish = draw.finish ?? (draw.foil ? "foil" : "nonfoil");
    if (!card || !hasUnverifiablePullRate(card, finish)) continue;
    const key = `${card.set}|${card.collectorNumber}|${finish}`;
    const row = grouped.get(key) ?? { card, finish, probability: 0, copies: 0 };
    row.probability = 1 - (1 - row.probability) * (1 - Math.max(0, Math.min(1, draw.pullProbability ?? 1 - Math.exp(-draw.copies))));
    row.copies += draw.copies;
    grouped.set(key, row);
  }
  return [...grouped.values()].map(({ card, finish, probability, copies }) => {
    const evidence = pullRateEvidenceFor(card, finish);
    return {
      code: "unverifiable-pull-rate",
      dedupeKey: `pull-rate:${card.set}|${card.collectorNumber}|${finish}`,
      message: `${cardDisplayName(card, finish)} has no verifiable exact pull rate. ${evidence?.publishedFact ?? "Its exact per-card odds are not published"}. The imported collation estimates a ${percent(probability)} chance in this selected break. Its price remains visible, but it is excluded from expected value and Rank by EV until the rate can be verified.`,
      expectedCards: copies,
      material: true,
      ...(evidence?.source ? { source: evidence.source } : {}),
    };
  });
}
