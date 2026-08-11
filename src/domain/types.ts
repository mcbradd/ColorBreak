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
  rarity?: string;
  slot: SlotId;
  nonfoil: number | null;
  foil: number | null;
  prices?: Partial<Record<Finish, number | null>>;
  quotes?: PriceQuote[];
  priceObservedAt?: string;
  priceFetchedAt?: string;
  image?: string;
  oracleText?: string;
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
  expectedCards?: number;
  material: boolean;
  source?: string;
}

export interface Contributor {
  card: CardPrice;
  copies: number;
  sellableCopies: number;
  marketValue: number;
  sellableValue: number;
  foilCopies: number;
  sellableFoilCopies: number;
  pullProbability: number;
  sellablePullProbability: number;
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
  omissions: Omission[];
  pricedAt: string;
  dataVersion: string;
  evidence: EvidenceState;
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
