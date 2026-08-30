# ColorBreak

> **Public demo notice:** the GitHub Pages deployment is a non-commercial demo. It does not have response-level anti-framing headers and must not be used for commercial transactions or financially consequential decisions. A production launch requires a header-capable static host/CDN.

## Reproducible releases

Price snapshots are reviewed, committed release inputs. The Pages workflow verifies them but never regenerates them, so the deployed artifact is traceable to the commit and its release manifest. Refresh snapshots in a dedicated reviewed commit before release; the app withholds a buyer limit whenever its exact-printing snapshot is older than six hours.

ColorBreak is a mobile-first, analysis-only practice demo for Magic: The Gathering color breaks. It models historical/datestamped card-value outcomes and seller-plan assumptions; it does not provide bid caps, transaction guidance, or launch recommendations.

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
- `verified`, `estimated`, and `incomplete` are confidence states. A stale or incomplete snapshot blocks a decision, but does not block composing a break: the default picker can still be used for visibly analysis-only exploration, while “Decision-ready only” hides it.
- Seller fees are assessed per purchase. Packing and seller-covered shipping are assessed per shipment. Buyer-paid shipping is not seller revenue.

## Data

- `data/sealed/*.json`: normalized MTGJSON sealed products and collation.
- `data/corrections.json`: narrowly scoped, sourced product corrections. This layer is authoritative over upstream sealed metadata.
- `data/prices/*.json`: a compact, timestamped Scryfall bulk-data snapshot containing only exact printings referenced by the normalized corpus. It is refreshed in a separately reviewed commit; deployment only verifies that committed input.
- There is no live-price repair path for picker or buyer eligibility. A snapshot miss remains a named, analysis-only blocker.
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
- `docs/release-runbook.md`: canonical snapshot, release-posture, and audit procedure.

The app is a Vite static build and requires no backend or account.
