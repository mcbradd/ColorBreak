interface SealedPriceSnapshot {
  schemaVersion: 1;
  provider: "TCGCSV";
  observedAt: string;
  prices: Record<string, number>;
}

let snapshotPromise: Promise<SealedPriceSnapshot | null> | null = null;

export function loadSealedPriceSnapshot(): Promise<SealedPriceSnapshot | null> {
  snapshotPromise ??= fetch("data/sealed-prices.json")
    .then((response) => response.ok ? response.json() as Promise<SealedPriceSnapshot> : null)
    .catch(() => null);
  return snapshotPromise;
}

export async function sealedMarketPrice(set: string, productId?: number): Promise<number | undefined> {
  if (!productId) return undefined;
  const snapshot = await loadSealedPriceSnapshot();
  return snapshot?.prices[`${set.toUpperCase()}:${productId}`];
}
