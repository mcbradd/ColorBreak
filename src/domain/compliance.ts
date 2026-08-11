export type ComplianceState =
  | "permitted"
  | "written-approval-required"
  | "prohibited"
  | "unknown";

export interface EnticementScenario {
  id: string;
  name: string;
  platform: "whatnot-us" | "off-platform";
  policyCheckedAt: string;
  compliance: ComplianceState;
  evidenceUrls: string[];
  approvalEvidence?: string;
}

const CARD_BREAKS = "https://help.whatnot.com/hc/en-us/articles/34107485220237-Card-Breaks-Policy";
const PURCHASE_PRIZES = "https://help.whatnot.com/hc/en-us/articles/4410443596813-Gambling-and-Purchase-Based-Prize-Policy";
const REWARDS = "https://help.whatnot.com/hc/en-us/articles/27689721056909-Set-up-your-Rewards-Club";

export const WHATNOT_ENTICEMENTS = {
  fixedCollectorBooster: {
    id: "fixed-collector-booster",
    name: "Fixed upfront Collector Booster",
    platform: "whatnot-us",
    policyCheckedAt: "2026-08-11",
    compliance: "permitted",
    evidenceUrls: [CARD_BREAKS],
  },
  fixedPlayBooster: {
    id: "fixed-play-booster",
    name: "Fixed upfront Play Booster",
    platform: "whatnot-us",
    policyCheckedAt: "2026-08-11",
    compliance: "permitted",
    evidenceUrls: [CARD_BREAKS],
  },
  fixedPromo: {
    id: "fixed-promo",
    name: "Fixed disclosed promo",
    platform: "whatnot-us",
    policyCheckedAt: "2026-08-11",
    compliance: "permitted",
    evidenceUrls: [CARD_BREAKS],
  },
  sellerCoupon: {
    id: "seller-coupon",
    name: "Seller-funded coupon",
    platform: "whatnot-us",
    policyCheckedAt: "2026-08-11",
    compliance: "permitted",
    evidenceUrls: [REWARDS, PURCHASE_PRIZES],
  },
  shippingSubsidy: {
    id: "shipping-subsidy",
    name: "Declared shipping subsidy",
    platform: "whatnot-us",
    policyCheckedAt: "2026-08-11",
    compliance: "permitted",
    evidenceUrls: [CARD_BREAKS],
  },
  everythingShips: {
    id: "everything-ships",
    name: "Everything-ships fulfillment",
    platform: "whatnot-us",
    policyCheckedAt: "2026-08-11",
    compliance: "permitted",
    evidenceUrls: [CARD_BREAKS],
  },
  whiffInsurance: {
    id: "whiff-insurance",
    name: "Whiff insurance",
    platform: "whatnot-us",
    policyCheckedAt: "2026-08-11",
    compliance: "prohibited",
    evidenceUrls: [CARD_BREAKS, PURCHASE_PRIZES],
  },
  thresholdPack: {
    id: "threshold-pack",
    name: "Sales-threshold shared pack",
    platform: "whatnot-us",
    policyCheckedAt: "2026-08-11",
    compliance: "written-approval-required",
    evidenceUrls: [CARD_BREAKS, PURCHASE_PRIZES],
  },
} as const satisfies Record<string, EnticementScenario>;

export function canExportScenario(scenario: EnticementScenario): { allowed: true } | { allowed: false; reason: string } {
  if (scenario.compliance === "prohibited") {
    return {
      allowed: false,
      reason: "Prohibited on Whatnot: outcome-contingent guarantees and bonuses are not permitted.",
    };
  }
  if (scenario.compliance === "written-approval-required" && !scenario.approvalEvidence?.trim()) {
    return { allowed: false, reason: "Written Whatnot approval must be recorded before export." };
  }
  if (scenario.compliance === "unknown") {
    return { allowed: false, reason: "Policy status is unknown; export is disabled." };
  }
  return { allowed: true };
}
