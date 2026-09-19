# ColorBreak

## Reproducible releases

Scryfall price snapshots are generated local data and are not committed. Run `npm run data:prices` to create them for local development; the Pages workflow regenerates and validates them before building. The app shows a bid ceiling only when its exact-printing snapshot is current.

ColorBreak is a mobile-first planner for Magic: The Gathering color breaks. Build the exact products, compare color outcomes, and set a modeled bid ceiling or seller plan.

## Run locally

```sh
npm install
npm run dev
```

Release validation:

```sh
npm run check
```

`npm run build` creates `dist/`, including the committed static data needed by GitHub Pages.

## Product model

- A break may contain multiple sealed products from multiple sets.
- Cards go to W/U/B/R/G/M/C/L by the printed color of the front face; lands always go to L.
- Market EV counts every exactly priced card. Sellable EV applies the user’s price threshold. Known EV is the priced lower bound when source data is incomplete.
- `verified`, `estimated`, and `incomplete` are confidence states. A stale or incomplete snapshot blocks a bid ceiling, but does not block composing a break: use “Ready for bid check” to show products with current, complete data.
- Seller fees are assessed per purchase. Packing and seller-covered shipping are assessed per shipment. Buyer-paid shipping is not seller revenue.

## Data

- `data/sealed/*.json`: normalized MTGJSON sealed products and collation.
- `data/corrections.json`: narrowly scoped, sourced product corrections. This layer is authoritative over upstream sealed metadata.
- `data/prices/*.json`: ignored, generated Scryfall snapshots containing only exact printings referenced by the normalized corpus. They are refreshed locally or during deployment and should not be committed.
- There is no live-price repair path in the picker. A snapshot miss remains visible and prevents a ceiling until the next data refresh.
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
