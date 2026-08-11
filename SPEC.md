# ColorBreak v4 acceptance contract

## Buyer

1. Entry offers **Check a bid** and **Build & price** as separate jobs.
2. Set → product selection is searchable, touch-friendly, and automatically calculates the break.
3. The first buyer result shows Sellable EV, confidence, slot selection, bid, incremental shipping, and a verdict.
4. Incomplete data produces **NO VERDICT**. No missing value receives an inferred price.
5. Market EV, Sellable EV, Known EV, chase share, value without the chase, and top contributors remain available without obstructing the primary decision.

## Seller

1. Product market cost is populated when tcgcsv is reachable; actual cost is always editable.
2. The Whatnot US preset uses 8% commission plus 2.9% processing on hammer + buyer shipping + tax, plus $0.30 per purchase.
3. Buyer-paid shipping is never seller revenue. Packing and seller-covered shipping are explicit costs.
4. The target plan and actual asks are distinct. Profit is hidden until all sold slots have actual asks.
5. Target asks allocate by Sellable EV with a minimum, can be locked, and redistribute when a slot is marked unsold.

## Data integrity

1. Exact sealed contents are used whenever a normalized record exists.
2. Sourced corrections override upstream metadata and remain reviewable in `data/corrections.json`.
3. Cross-set packs, guaranteed cards, deck contents, and box toppers resolve as cards or become named material omissions.
4. Confidence is `verified`, `estimated`, or `incomplete` and is computed, not editorial.
5. Card prices are exact to printing and finish. Cached prices expire after six hours.

## Platform and quality

1. React, TypeScript, and Vite produce a static GitHub Pages build.
2. The app works at 320 CSS pixels, is touch-first, supports keyboard use, visible focus, reduced motion, and semantic controls.
3. The core shell is installable as a PWA. Network-first caching must not conceal refreshed prices.
4. Public share links contain composition only; private acquisition costs are excluded.
5. Legacy `?set=`, `?preset=`, and `?b=` links remain readable.
6. `npm test` and `npm run build` pass before release. Domain calculations have unit coverage; buyer and seller happy paths receive browser smoke coverage.

## Explicit non-goals for v4

Accounts, a hosted backend, cash-out haircut, probability-of-profit simulation, tax estimation, and speculative collector-pool narrowing are not part of this release.
