# ColorBreak

ColorBreak is a mobile-first decision tool for Magic: The Gathering color breaks. Buyers can judge a live-auction bid in seconds; sellers can price a break against actual marketplace fees, product cost, and fulfillment.

## Run locally

```sh
npm install
npm run dev
```

Production validation:

```sh
npm run check
```

`npm run build` creates `dist/`, including the committed static data needed by GitHub Pages.

## Product model

- A break may contain multiple sealed products from multiple sets.
- Cards go to W/U/B/R/G/M/C/L by the printed color of the front face; lands always go to L.
- Market EV counts every exactly priced card. Sellable EV applies the user’s price threshold. Known EV is the priced lower bound when source data is incomplete.
- `verified`, `estimated`, and `incomplete` are behavioral states. An incomplete result never produces a buyer verdict.
- Seller fees are assessed per purchase. Packing and seller-covered shipping are assessed per shipment. Buyer-paid shipping is not seller revenue.

## Data

- `data/sealed/*.json`: normalized MTGJSON sealed products and collation.
- `data/corrections.json`: narrowly scoped, sourced product corrections. This layer is authoritative over upstream sealed metadata.
- `data/prices/*.json`: a compact, timestamped Scryfall bulk-data snapshot containing only exact printings referenced by the normalized corpus. It is refreshed for every deployment and by the daily Pages workflow.
- Scryfall live lookup: globally throttled recovery path for a printing absent from the snapshot; it is not the primary page-load path.
- tcgcsv: best-effort sealed market cost. The seller can always enter actual cost.

Unresolved contents and exact-finish prices are surfaced as named omissions; they are never silently replaced with a proxy.
Price-source availability is reported separately from product-content completeness, so a transient remote failure cannot make an otherwise exact product look structurally incomplete.

## Structure

- `src/domain/`: pure valuation, marketplace, and legacy-link contracts.
- `src/data/`: source adapters and orchestration.
- `src/App.tsx`: buyer/seller task flows.
- `tools/`: offline data builders and validators.
- `CONTEXT.md`: domain language and product intent.
- `SPEC.md`: current acceptance contract.

The app is a Vite static build and requires no backend or account.
