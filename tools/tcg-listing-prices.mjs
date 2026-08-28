const LISTING_ENDPOINT = (productId) => `https://mp-search-api.tcgplayer.com/v1/product/${productId}/listings?mpfev=1`;
const BROWSER_USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const listingBody = (printing) => ({
  filters: {
    term: { printing: [printing], language: ["English"], sellerStatus: "Live" },
    range: { quantity: { gte: 1 } },
    exclude: { channelExclusion: 0 },
  },
  from: 0,
  size: 1,
  sort: { field: "price+shipping", order: "asc" },
  context: { shippingCountry: "US", cart: { packages: {} } },
  aggregations: ["listingType"],
});

export async function fetchTcgListingPrice(productId, finish, fetchImpl = fetch) {
  const printing = finish === "nonfoil" ? "Normal" : finish === "etched" ? "Etched" : "Foil";
  const response = await fetchImpl(LISTING_ENDPOINT(productId), {
    method: "POST",
    headers: {
      Accept: "application/json, text/plain, */*",
      "Content-Type": "application/json",
      Origin: "https://www.tcgplayer.com",
      Referer: `https://www.tcgplayer.com/product/${productId}`,
      "User-Agent": BROWSER_USER_AGENT,
    },
    body: JSON.stringify(listingBody(printing)),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const payload = await response.json();
  const listing = payload.results?.[0]?.results?.[0];
  const value = listing?.price ?? listing?.sellerPrice;
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}

const isPremiumFinish = (finish) => finish && finish !== "nonfoil" && finish !== "serialized";

export async function addTcgListingFallbacks(cards, required, options = {}) {
  const lookup = options.lookup ?? fetchTcgListingPrice;
  const observedAt = options.observedAt ?? new Date().toISOString();
  const delayMs = options.delayMs ?? 0;
  let added = 0;

  for (const card of cards) {
    const requirement = required.get(`${String(card.set).toUpperCase()}|${card.collector_number}`);
    if (![...(requirement?.finishes ?? [])].some(isPremiumFinish)) continue;
    if (!card.tcgplayer_id || card.prices?.usd_foil != null || card.tcgplayer?.prices?.foil?.listed != null) continue;

    let listed;
    try {
      listed = await lookup(card.tcgplayer_id, "foil");
    } catch (error) {
      options.onError?.(card, error);
      continue;
    } finally {
      if (delayMs > 0) await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
    if (listed == null) continue;
    card.tcgplayer = card.tcgplayer ?? { observedAt, prices: {} };
    card.tcgplayer.observedAt = observedAt;
    card.tcgplayer.prices.foil = { market: null, listed: Math.round(listed * 100) / 100 };
    added += 1;
  }
  return added;
}
