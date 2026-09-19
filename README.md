# ColorBreak

## Reproducible releases

Scryfall price snapshots are generated local data and are not committed. Run `npm run data:prices` to create them for local development; the Pages workflow regenerates and validates them before building. The release manifest records the code revision, source timestamps and data checksums. The app shows the best available estimate immediately and explains stale or incomplete evidence beside it.

ColorBreak is a mobile-first planner for Magic: The Gathering color breaks. Build the exact products, compare color outcomes, and set a modeled bid ceiling or seller plan.

## Run locally

```sh
npm ci
npm run data:prices
npm run data:sealed-prices
npm run dev
```

Release validation:

```sh
npm run check
```

`npm run build` creates `dist/`, including the reviewed static data and generated price snapshots needed by GitHub Pages. A fresh checkout needs the data-generation steps above before release checks or a production build.

## Product model

- A break may contain multiple sealed products from multiple sets.
- Cards go to W/U/B/R/G/M/C/L by the printed color of the front face; lands always go to L.
- Market EV counts every exactly priced card. Sellable EV applies the user’s price threshold. Known EV is the priced lower bound when source data is incomplete.
- `verified`, `estimated`, and `incomplete` are confidence states. Stale or incomplete evidence qualifies the estimate and bid ceiling; named omissions explain what could change the answer.
- Seller fees are assessed per purchase. Packing and seller-covered shipping are assessed per shipment. Buyer-paid shipping is not seller revenue.

## Data

- `data/sealed/*.json`: normalized MTGJSON sealed products and collation.
- `data/corrections.json`: narrowly scoped, sourced product corrections. This layer is authoritative over upstream sealed metadata.
- `data/prices/*.json`: ignored, generated Scryfall snapshots containing only exact printings referenced by the normalized corpus. They are refreshed locally or during deployment and should not be committed.
- The picker and buyer decision can check for a newer published snapshot. Failed refreshes retain usable prices and report the result; missing prices remain named omissions until resolved.
- tcgcsv: best-effort sealed market cost. The seller can always enter actual cost.

Unresolved contents and prices are surfaced as named omissions. For premium treatments on new releases, a missing treatment-specific market observation uses the same printing's listed TCG foil price and labels that basis; prices never cross printings or foil classes.
Price-source availability is reported separately from product-content completeness, so a transient remote failure cannot make an otherwise exact product look structurally incomplete.

## Structure

- `src/domain/`: pure valuation, marketplace, and legacy-link contracts.
- `src/data/`: source adapters and orchestration.
- `src/App.tsx`: buyer/seller task flows.
- `tools/`: offline data builders and validators.
- `CONTEXT.md`: domain language and product intent.
- `SPEC.md`: current acceptance contract.
- `docs/release-runbook.md`: canonical snapshot and audit procedure.

The app is a Vite static build and requires no backend or account.
