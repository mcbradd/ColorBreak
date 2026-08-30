export const SLOT_IDS = ["W", "U", "B", "R", "G", "M", "C", "L"] as const;
export type SlotId = (typeof SLOT_IDS)[number];

export const SLOT_NAMES: Record<SlotId, string> = {
  W: "White", U: "Blue", B: "Black", R: "Red", G: "Green",
  M: "Multicolored", C: "Colorless", L: "Lands",
};

export type DataStatus = "verified" | "estimated" | "incomplete";

export type Finish =
  | "nonfoil"
  | "foil"
  | "etched"
  | "surge"
  | "textured"
  | "gilded"
  | "galaxy"
  | "confetti"
  | "halo"
  | "ripple"
  | "fracture"
  | "raised"
  | "neon-ink"
  | "oil-slick"
  | "step-and-compleat"
  | "double-rainbow"
  | "silver"
  | "rainbow"
  | "mana"
  | "magnified"
  | "invisible-ink"
  | "first-place"
  | "dragon-scale"
  | "singularity"
  | "cosmic"
  | "chocobo-track"
  | "facet"
  | "silver-scroll"
  | "gleaming-gold"
  | "embossed"
  | "glossy"
  | "serialized"
  | "other";

export interface EvidenceState {
  productIdentity: "official-verified" | "aggregate-identified" | "ambiguous";
  contents: "official-verified" | "mtgjson-structured" | "prose-only" | "unresolved";
  collation: "published-rate-checked" | "weighted-upstream" | "unvalidated" | "unresolved";
  finish: "exact" | "class-only" | "unresolved";
  breakRules: "seller-confirmed" | "preset" | "user-entered" | "unknown";
}

export interface PriceQuote {
  provider: string;
  currency: "USD";
  finish: Finish;
  observedAt: string;
  fetchedAt: string;
  amount: number;
  rightsStatus: "approved" | "public-value-add" | "user-entered";
}

export interface BreakLine {
  id: string;
  set: string;
  productKey: string;
  productLabel: string;
  quantity: number;
  packCount?: number;
  tcgId?: number;
  marketCost?: number;
  myCost?: number;
}

export interface CardPrice {
  id: string;
  set: string;
  collectorNumber: string;
  name: string;
  /** Printing treatment only; base printings omit this. */
  treatment?: string;
  /** Every visual/printing variant on this exact printing, in display order. */
  treatments?: string[];
  /** Unknown-preserving source facets; these dimensions are intentionally composable. */
  treatmentMetadata?: {
    rawFrameEffects: string[];
    rawPromoTypes: string[];
    finishClasses: string[];
    styleTags: string[];
    processTags: string[];
    attributeTags: string[];
    unknownTags: string[];
    borderColor?: string;
    fullArt: boolean;
    textless: boolean;
    variationOf?: string;
    language?: string;
    flavorName?: string;
    illustrationId?: string;
    securityStamp?: string;
  };
  rarity?: string;
  /** Front-face Scryfall type line used for large-break residual categories. */
  typeLine?: string;
  /** Front-face colors used for large-break unlisted-creature spots. */
  colors?: string[];
  slot: SlotId;
  nonfoil: number | null;
  foil: number | null;
  prices?: Partial<Record<Finish, number | null>>;
  listedPrices?: Partial<Record<Finish, number | null>>;
  quotes?: PriceQuote[];
  priceObservedAt?: string;
  priceFetchedAt?: string;
  image?: string;
  oracleText?: string;
  layout?: string;
  faces?: Array<{
    name?: string;
    typeLine?: string;
    oracleText?: string;
    image?: string;
  }>;
}

export interface ExpectedDraw {
  set: string;
  collectorNumber: string;
  copies: number;
  pullProbability?: number;
  foil: boolean;
  finish?: Finish;
  source: string;
}

export interface Omission {
  code: string;
  message: string;
  dedupeKey?: string;
  expectedCards?: number;
  material: boolean;
  source?: string;
}

export interface Contributor {
  card: CardPrice;
  finish?: Finish;
  marketPrice?: number;
  priceBasis?: "exact-market" | "same-printing-foil-market" | "listed-tcg";
  copies: number;
  sellableCopies: number;
  marketValue: number;
  sellableValue: number;
  foilCopies: number;
  sellableFoilCopies: number;
  pullProbability: number;
  sellablePullProbability: number;
  pullRateVerified?: boolean;
}

export interface SlotValuation {
  id: SlotId;
  name: string;
  marketEV: number;
  sellableEV: number;
  knownEV: number;
  contributors: Contributor[];
  chaseShare: number;
  withoutChase: number;
}

export interface ValuationResult {
  marketEV: number;
  sellableEV: number;
  knownEV: number;
  threshold: number;
  status: DataStatus;
  statusReason: string;
  slots: SlotValuation[];
  priceOnlyContributors?: Contributor[];
  omissions: Omission[];
  pricedAt: string;
  /** Where the price observation that controls freshness came from. */
  priceSource?: string;
  dataVersion: string;
  evidence: EvidenceState;
}

export type DecisionEligibilityStatus = "eligible" | "stale" | "material-incomplete" | "unavailable";

/** A named omission that prevents a decision from being actionable. */
export interface DecisionAffectedGroup {
  id: string;
  label: string;
  directionallyUsable: boolean;
}

/**
 * Engine-owned decision gate. UI, sharing, export, and analytics must consume
 * this value rather than independently interpreting valuation status or age.
 */
export interface DecisionEligibility {
  status: DecisionEligibilityStatus;
  blockerCount: number;
  affectedGroups: DecisionAffectedGroup[];
  observedAt?: string;
  observedSource?: string;
  ageMs?: number;
  freshnessThresholdMs: number;
  /** A conservative calculation using only resolved exact-printing values. */
  resolvedOnlyAvailable: boolean;
  reason:
    | "fresh-complete"
    | "stale-price-snapshot"
    | "material-omissions"
    | "missing-price-timestamp"
    | "invalid-price-timestamp"
    | "unavailable-source-status";
}

export interface ResolvedOnlyLimit {
  scope: "resolved-only";
  amount: number;
  allIn: number;
  omittedGroups: DecisionAffectedGroup[];
  observedAt?: string;
  observedSource?: string;
}

export interface Transaction {
  slot: SlotId;
  hammer: number;
  buyerShipping: number;
  buyerTax: number;
}

export interface Shipment {
  id: string;
  slots: SlotId[];
  packingCost: number;
  sellerCoveredShipping: number;
}

export interface MarketplacePreset {
  id: string;
  name: string;
  commissionRate: number;
  processingRate: number;
  processingFlat: number;
  policyDate: string;
}

export interface ProfitResult {
  hammer: number;
  fees: number;
  shipmentCosts: number;
  acquisitionCost: number;
  profit: number;
}

export interface ProductChoice {
  key: string;
  label: string;
  set: string;
  setName: string;
  category: "common" | "box" | "pack" | "bundle" | "prerelease" | "case" | "specialty";
  packCount: number;
  tcgId?: number;
  sealedKey?: string;
  status: DataStatus;
}

export interface SetChoice {
  code: string;
  name: string;
  released: string;
  type: string;
}
