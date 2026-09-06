# ColorBreak v4 acceptance contract

## Universal answer contract

Every calculated value and graphic gives the best available answer immediately and improves it as matching data arrives. Fresh exact data outranks matching cached data; disclosed approximations fill gaps where possible. With no defensible estimate for an item, show the known subtotal and explain that unknown contributions currently add $0. Never treat that as proof of zero worth or cost. Uncertain evidence changes the explanation, not availability of the answer.

Calculated values and graphics share one circled-asterisk popover per logical section, next to the question mark when available, with separate 44px touch targets and spacing. Repeated child values contribute explanations without inserting more icons. The popover prioritizes specific missing data and uses at most 65 words in short paragraphs; full source evidence remains available in data confidence. Card details have their own card-specific note. Popovers work with touch, keyboard, Escape and outside dismissal, and stay within the visual viewport above mobile keyboards. Exact user-entered counts and recorded receipts are not invented or changed to manufacture an estimate.

Quantity changes reuse only the matching product's values and scale them immediately. Different products cannot inherit each other's answers. MIN and MAX are the smallest and largest values possible under the current pack model, prices, quantity, and bulk filter. Compute these bounds directly from possible choices, guaranteed contents, positive-weight variants and duplicate rules; never use percentile cutoffs or sampled extremes. Numerical MIN/MAX use these endpoints immediately while the typical value remains an analytic preview until sampling finishes. Candlestick geometry and shared scales use the 1st–99th percentile, with the middle 50% as the body; compact seller bars use the 10th–90th percentile. MIN/MAX never set chart geometry or scale. Failed enrichment keeps this useful answer and a retry action.

## Buyer

1. Entry is the job chooser: a hash-less or unrecognized URL resolves to it, and it offers **Buyer** and **Seller** as separate jobs. A shared break link opens the buyer workspace directly.
2. Set → product selection is searchable, touch-friendly, and automatically calculates the break.
3. The first buyer result shows Sellable EV, confidence, the slots still in the pool, and a bid ceiling. The buyer never types a bid or a shipping figure into the live decision: shipping and tax are standing assumptions with editable content/location estimates, and the ceiling is the highest hammer price whose landed cost still fits inside the modeled value.
4. Incomplete data never hides the verdict, projection, or outcome distribution. Results use the best available evidence, including clearly disclosed approximations, with one universal estimate note in each section header. If a premium treatment has no treatment-specific market observation, the same printing's listed TCG foil price is used and labeled; prices never cross printings or foil classes.
5. Market EV, Sellable EV, Known EV, chase share, value without the chase, and top contributors remain available without obstructing the primary decision.
6. Buyer break format offers Color slots and Large break. In a color-slot break the checked slots are the slots the buyer already owns and the crossed slots are the ones another buyer took; both leave the pool the next auction draws from, and the decision prices that remaining pool. Large break accepts 1–500 spots, defaults to 120, reserves each of the 17 catch-all category slots, and fills the remaining slots with the highest-market-value card identities. Character cards sharing a character name occupy one named spot.
7. Large break shows sealed market value per spot, pull EV per spot under the shared bulk filter, top named cards switchable between market-price and expected-value ranking, and residual creature-color/card-type EV with named cards excluded.
8. Buyer setup presents break format first, then break contents, then the slot rail, with costs and the value filter behind one assumptions disclosure. Every slot carries its own MIN / expected / MAX candle on one shared scale, at the point of decision rather than in a separate panel. Step explanations live behind a help icon, not in standing paragraphs. The latest decision evidence and visualizations remain visible during recalculation and require no disclosure to open.
9. On a phone viewport, format, color/spot selection, break contents, and bulk-value controls appear before results and fit in the initial landing viewport for a new break. Buying recommendation and limit precede supporting evidence.
10. The current URL continuously encodes break products, quantities, format, spot/color state, and bulk-value options. Opening or sharing that URL reconstructs the filled-out buyer view. Private costs and receipts remain excluded. Copy break link shows only an automatically dismissed clipboard toast, without a link field or layout shift. Section anchor navigation preserves the current workspace.
11. Empty composition shows only Add products, with no duplicate empty-state box. Product names and quantity selectors share a row at 320px and above. Editing updates the composition directly without a Break updated/Undo banner.
12. Evidence uses available mobile width without nested decorative panels. Value concentration labels sit directly below their bar; contributor columns have distinct aligned Chance and Adds headings. Card details show the full portrait card, one selected-finish market price, and a physical pull chance expressed as an integer number of breaks. Duplicate price and copies-per-break statistics are omitted; their mathematical explanation stays behind help.
13. Numeric entry amounts align right and currency/percent symbols appear to their left. Quantity selectors retain centered numbers. Shipping mode, shipping amount, tax, and bulk threshold use matching control widths in buyer assumptions; keyboard editing keeps the active field and Done accessible.
11. When a result requires user-entered information, the message names the exact missing value, explains which result it affects, and links directly to the corresponding field.
12. In the product picker, selected products have an obvious contrasting border/background and a visible editable quantity. Minus and plus stay beside the product name at its trailing edge; the visible quantity between them is an editable numeric field. All product surfaces use the same quantity control. Focusing the number opens the numeric keyboard, with the field and its Done action kept inside the visual viewport. The picker footer says only Done, including after the last product is removed.
13. Selecting a product never inserts a current-break panel or changes the row geometry; the list remains in place. Estimate freshness is omitted from individual product rows. When an estimate needs attention, one refresh action appears above the list.

## Seller

1. Product market cost is populated when tcgcsv is reachable; actual cost is always editable.
2. The Whatnot US preset uses 8% commission plus 2.9% processing on hammer + buyer shipping + tax, plus $0.30 per purchase.
3. Buyer-paid shipping is never seller revenue. Packing and seller-covered shipping are explicit costs.
4. Planning profit is always estimated from entered costs, then available market prices, with unknown costs explicitly contributing $0. Recorded-so-far results use only recorded revenue plus disclosed cost assumptions. Reconciled actual profit uses actual costs, receipts and shipments; target asks never become actual receipts.
5. Target asks allocate by Sellable EV with a minimum, can be locked, and redistribute when a slot is marked unsold.
6. Seller entry is an inline, combined set/product search. Tapping a product immediately adds it, clears search and returns focus for the next product. Quantities and removal remain on the same screen, with Undo; different sets never merge merely because their product keys match.
7. Product identity appears without evaluating every search alternative. Analytic EV starts on selection; range calculations settle rapid edits before sampling. Neither cost entry nor market-price hydration restarts card valuation or unmounts seller controls.
8. The first result shows whole-break EV and per-color average, MIN (minimum possible), typical (median) and MAX (maximum possible) outcomes. Unknown acquisition costs do not hide card values. Stale or incomplete models show qualified estimates; a bid limit remains visible using the best available range or analytic preview, with its limitations in the estimate note. A random color preview explicitly assumes all eight colors are available.
9. On phones a compact value strip stays visible during entry, including above the keyboard. The product list is bounded; expanded ranges and pricing remain on the same page. Controls remain usable at 320px, and quantity entry retains a visible Done button.
10. Recalculation immediately reuses matching product values for the new quantities with an updating note; stale results never masquerade as the current mix. Continuing composition edits retain standing assumptions and valid per-product cost choices, while receipt records never move to another break.
11. Browser bars and keyboards cannot cover the active field or its Done action. The value strip follows the visual viewport, including during native panning; search leaves room for a tappable match. Short viewports use a single-row quantity/Done control. Deliberate scrolling and explicit result navigation cancel automatic position restoration. See `docs/mobile-viewport-contract.md` for regression coverage and device verification limits.

## Per-product collation

1. Resolve every sealed product by its own set/product key, constituent booster codes, quantities, fixed contents, and source revisions. Boxes and cases scale those same recipes; cross-set boosters use their owning set.
2. Resolve facts in this order: scoped official published rules/rates, scoped community observations or models, then disclosed inference. A source applies only to the facts it supports; product-specific rules beat family rules at the same evidence tier. Conflicts retain a useful qualified answer and are blocked by the catalog release audit until reviewed.
3. Fast expected draws and generative opening models consume the same resolved variant and sheet rates. Official replacement rates retain mutually exclusive branches, total card counts, finishes and guaranteed slots. Never add a bonus-sheet hit on top of a replacement common.
4. Both MIN/MAX and simulation enforce minimum distinct mono colors and avoid duplicate card identities within a sheet, including alternate printings. Color constraints use front-face card colors and apply before the dollar threshold. Set Boosters and specialty products cannot inherit Play color guarantees by name proximity.
5. Preserve known fixed cards and pack structure when prices or one detail are missing. Unknown printing weights stay represented at zero known value; missing colors must not force a falsely positive floor. An independent-card fallback is permitted only when no structured component survives.
6. Exact factory sheet order and box correlations are not generally known. Weighted sequential draws respecting available constraints are a disclosed approximation. A family-derived color guarantee is identified as inferred, not officially verified for that set.
7. Priced outcomes with community or inferred odds remain in EV, MAX and rankings. Their unknown exact odds are explained. Missing prices are distinct from missing probabilities.
8. `npm run check:collation` verifies every catalog product's mapping, source rules, quantities, recipe fingerprint and absence of unreviewed conflicts. New data must regenerate the map deliberately. Physical-device testing is separate from browser viewport checks.

## Data integrity

1. Exact sealed contents are used whenever a normalized record exists.
2. Sourced corrections override upstream metadata and remain reviewable in `data/corrections.json`.
3. Cross-set packs, guaranteed cards, deck contents, and box toppers resolve as cards or become named material omissions.
4. Confidence is `verified`, `estimated`, or `incomplete` and is computed, not editorial.
5. Card prices are exact to printing. Treatment-specific market prices are preferred; a same-printing listed TCG foil price may fill a premium-treatment gap and must be labeled. Prices older than six hours remain usable estimates with an age note while newer data is requested.

## Platform and quality

1. React, TypeScript, and Vite produce a static GitHub Pages build.
2. The app works at 320 CSS pixels, is touch-first, supports keyboard use, visible focus, reduced motion, and semantic controls.
3. The core shell is installable as a PWA. Network-first caching must not conceal refreshed prices.
4. Public share links contain composition only; private acquisition costs are excluded.
5. Legacy `?set=`, `?preset=`, and `?b=` links remain readable.
6. `npm test` and `npm run build` pass before release. Domain calculations have unit coverage; buyer and seller happy paths receive browser smoke coverage.

## Explicit non-goals for v4

Accounts, a hosted backend, cash-out haircut, probability-of-profit simulation, tax estimation, and speculative collector-pool narrowing are not part of this release.

## Product picker refresh and ordering

1. Explicit price refresh checks the latest publication over the network, preserving existing estimates on failure. The button immediately acknowledges the tap and shows Searching, Updating, or Checking with a spinner while that phase is active. It retains an Updated, Up to date, No newer data, Partial update, or Retry result. In-progress refreshes cannot be double-submitted, and old requests cannot change a different set's feedback.
2. Product order is shared across the per-set picker and seller search: packs, boxes, bundles, prerelease kits, specialty products, then cases. Specialty priority favors decks, gift/scene collections, then starter products. This is an editorial break/wheel priority, not a measured sales ranking. Selection and refresh never reorder products or change the header height.

## Cost entry

Currency inputs align right through the shared numeric primitive; quantities stay centered and layout values retain element-specific alignment. Buyer fields exclude seller fees. One shipping input has per-item/flat-fee modes, defaulting to estimated Whatnot combined-label shipping. The next bid deducts only added shipping. Large Break reuses these assumptions. Tax uses a disclosed regional guess, editable without requesting precise location. User overrides, including zero, survive composition changes and reset when all local data is cleared. Filter and cost labels use available horizontal space before their fields. Actual receipt entries remain blank until recorded. Sources and limitations: `docs/cost-assumptions.md`.
