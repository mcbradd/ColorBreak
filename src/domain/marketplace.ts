import type { MarketplacePreset, ProfitResult, Shipment, Transaction } from "./types";

export const WHATNOT_US: MarketplacePreset = {
  id: "whatnot-us-2026-07",
  name: "Whatnot US",
  commissionRate: 0.08,
  processingRate: 0.029,
  processingFlat: 0.3,
  policyDate: "2026-07-13",
};

export function transactionNet(transaction: Transaction, preset: MarketplacePreset): number {
  const commission = transaction.hammer * preset.commissionRate;
  const processingBase = transaction.hammer + transaction.buyerShipping + transaction.buyerTax;
  const processing = processingBase * preset.processingRate + preset.processingFlat;
  return transaction.hammer - commission - processing;
}

export function calculateProfit(
  transactions: Transaction[],
  shipments: Shipment[],
  acquisitionCost: number,
  preset: MarketplacePreset,
): ProfitResult {
  const hammer = transactions.reduce((sum, item) => sum + item.hammer, 0);
  const transactionIncome = transactions.reduce((sum, item) => sum + transactionNet(item, preset), 0);
  const fees = hammer - transactionIncome;
  const shipmentCosts = shipments.reduce(
    (sum, shipment) => sum + shipment.packingCost + shipment.sellerCoveredShipping,
    0,
  );
  return {
    hammer,
    fees,
    shipmentCosts,
    acquisitionCost,
    profit: transactionIncome - shipmentCosts - acquisitionCost,
  };
}

export function requiredHammer(
  transactionCount: number,
  shipmentCosts: number,
  acquisitionCost: number,
  targetProfit: number,
  typicalBuyerShipping: number,
  preset: MarketplacePreset,
): number {
  if (transactionCount <= 0) return 0;
  const keep = 1 - preset.commissionRate - preset.processingRate;
  const fixedFees = transactionCount * (
    preset.processingFlat + typicalBuyerShipping * preset.processingRate
  );
  return (acquisitionCost + shipmentCosts + targetProfit + fixedFees) / keep;
}
