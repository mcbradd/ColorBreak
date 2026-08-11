export type EnticementKind = "fixed-product" | "threshold-product" | "whiff-insurance";

export interface EnticementEconomicsInput {
  kind: EnticementKind;
  cost: number;
  buyerValue: number;
  probability?: number;
}

export function scenarioEconomics(input: EnticementEconomicsInput): {
  expectedSellerCost: number;
  expectedBuyerValue: number;
} {
  const probability = input.kind === "fixed-product"
    ? 1
    : Math.max(0, Math.min(1, input.probability ?? 0));
  return {
    expectedSellerCost: input.cost * probability,
    expectedBuyerValue: input.buyerValue * probability,
  };
}
