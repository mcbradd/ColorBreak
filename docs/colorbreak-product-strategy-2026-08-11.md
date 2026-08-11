# ColorBreak product strategy

Date: 2026-08-11  
Status: implementation baseline and staged growth program

## Product thesis

ColorBreak is a live-auction decision tool, not an EV spreadsheet. Its default buyer workflow models eight slots—W, U, B, R, G, M, C, and L—auctioned sequentially, with each winner assigned uniformly from the remaining pool. The product should answer, in one glance: what a typical outcome looks like, how often counted card value covers landed cost, and how the next random assignment changes after a slot leaves the pool.

The mean remains mathematically important but visually secondary. Chase cards can make a mean look healthy while most modeled openings fall below it. ColorBreak therefore pairs analytic EV with deterministic outcome simulation and withholds distribution claims when the available evidence cannot support them.

## Implemented foundation

### Data and evidence

The sealed corpus now covers 72 sets from 2018 onward, 1,107 products, and versioned source metadata with document checksums. The generated coverage report currently classifies 1,023 products as structurally complete and 84 as incomplete: 43 have missing sheet weights, 33 contain prose-only contents, and eight reference an unresolved booster. These gaps are named instead of estimated away. `data/coverage-baseline.json` prevents an eligible product from silently regressing.

MTGJSON remains the versioned structured import for product identities, sealed hierarchies, decks, variants, and weighted sheets. Narrow corrections must identify the exact product, cite their source and retrieval date, and describe the operation. The current correction set resolves the two known HOB prerelease pseudo-pack mappings. Official Wizards collecting and product guides are evidence for future corrections, not an unattended scraping feed. [MTGJSON downloads](https://mtgjson.com/downloads/all-files/) document the distributed datasets, while its [sealed-product](https://mtgjson.com/data-models/sealed-product/) and [booster](https://mtgjson.com/data-models/booster/) models define the relevant structures.

Price observations now retain finish and timestamps. Exact finishes include nonfoil, foil, etched, surge, textured, gilded, serialized, and an explicit other class. A missing finish price is an omission; it never falls back silently. Scryfall supplies printing metadata, images, and current price observations under its [API](https://scryfall.com/docs/api) and [image-use](https://scryfall.com/docs/api/images) rules. ColorBreak is not a raw proxy and does not put Scryfall-derived analytical truth behind a subscription.

The public CORS relay for sealed prices has been removed. Acquisition cost is user-entered until a provider grants suitable written rights. TCGplayer's published terms restrict API access and redistribution, so public availability is not treated as permission. [TCGplayer API terms](https://help.tcgplayer.com/hc/en-us/articles/360061115874-TCGplayer-API-Terms-Conditions).

Evidence is composable: product identity, contents, collation, finish, break rules, and price freshness are distinct claims. Any material unresolved dimension suppresses verdicts and probability views. A known lower bound may remain visible with the omission beside it.

### Outcome engine

The generative model preserves mutually exclusive booster variants, weighted sheet draws, replacement behavior, fixed cards, nested sealed products, exact printing and finish, and product provenance. It records unresolved branches rather than manufacturing plausible packs.

Exact enumeration is used where the state is tractable. Otherwise a Web Worker runs a deterministic seeded Monte Carlo: 10,000 samples for the interactive result and an idle refinement path to 50,000. The cache/seed identity covers composition, price snapshot, bulk threshold, slot map, house rules, and remaining slots. Identical inputs reproduce identical results. The simulated mean is tested against analytic EV, and mutually exclusive variants cannot co-occur.

### Live buyer flow

Random Remaining Slot is the default mode; Pick My Color remains available. The buyer enters the current hammer and incremental shipping, then taps the assigned slot once after each auction. The slot disappears, the current scroll/context remains stable, the next remaining-pool mixture recalculates, and Undo reverses mistakes. The final remaining slot needs no assignment tap. Share links preserve composition, house rules, and the remaining pool.

Every card name opens a focus-trapped detail pane with the image, exact-finish price, current-break pull odds, expected copies, and source context. Outside-tap and explicit dismissal restore the previous focus and scroll position. Numeric fields expose decimal-capable mobile input plus a visible Done/Apply action; keyboard opening is tied to intentional focus and cannot create a page-wide snap loop. Help content renders above clipping containers.

## The visual system

### Outcome Fingerprint and Bid Guardrail

Twenty dots represent equal five-percent slices of modeled outcomes. Direct labels show P10, median, mean, P90, and the landed-cost boundary. “11 of 20 modeled openings clear $18” is easier to reason about under auction pressure than a probability with false precision. The bid language is deliberately descriptive—More conservative, Higher risk, Chase-oriented—never safe, guaranteed, hot, or due. Expandable examples can show lower-tail, typical, and upper-tail card mixes.

Value delivered: it exposes chase-inflated means and anchors the decision on frequency and downside without pretending to know the next opening.

### Break Balance

Each remaining slot is plotted against its equal share of pooled EV, with median and P10–P90 whiskers when simulation is eligible. A weakest/strongest ratio and Gini-style dispersion describe inequality without assigning a moral “fair” score. Concentration annotations identify chase-heavy or lighter pools using published metric rules.

Value delivered: the buyer sees that assignment odds can be equal while economic outcomes are not, and can watch that distribution change after each assignment.

### Enticement Frontier

Seller scenarios plot incremental seller cost against a selected buyer improvement: weakest-slot median, weakest-slot P10, balance improvement, or chase-tail increase. Points also expose margin and concentration changes. Only nondominated options form the Pareto frontier; compliance state remains visible and cannot be dismissed.

Value delivered: sellers can compare a fixed Collector Booster with cheaper Play Boosters, shipping support, or fixed promos in the metric they actually want to improve, rather than adding expensive variance by intuition.

Supporting views follow the same truth standard: Chase Constellation plots pull probability against price with EV-contribution area; Bulk Boundary shows retained EV over “Ignore bulk under” thresholds without calling that liquidity; Evidence Lens lists finish precision, age, and omissions; EV River retains product-to-sheet-to-slot provenance. Frequency-based uncertainty displays are supported by the review literature as a useful alternative to a lone point estimate. [Frontiers review](https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2020.579267/full).

## Seller enticements and platform safety

Every scenario stores a platform, policy-check date, evidence links, compliance state, and export eligibility. ColorBreak can analyze a prohibited mechanism in a clearly marked research lab, but it cannot generate a Whatnot rule card for it. Approval-required exports require a stored approval reference, and the warning persists after acknowledgement.

Current Whatnot policy prohibits break prizes, paid bounties, and bonuses or guarantees linked to results or assignments; it also restricts purchase-based prize mechanics. Therefore a fixed, disclosed Collector Booster included before sales is a normal break product, while an outcome-triggered pack and whiff insurance are prohibited. A sales-threshold shared pack remains written-approval-required. A genuine no-purchase-required giveaway is separate and never enters break EV. Sources: [Card Breaks Policy](https://help.whatnot.com/hc/en-us/articles/34107485220237-Card-Breaks-Policy), [Gambling and Purchase-Based Prize Policy](https://help.whatnot.com/hc/en-us/articles/4410443596813-Gambling-and-Purchase-Based-Prize-Policy), and [Giveaway Rules](https://help.whatnot.com/hc/en-us/articles/14349906179597-Giveaway-Rules-Requirements).

Whatnot-first scenarios should prioritize supported allocation and trust mechanics: Pick 2 Choose 1, one-time Stash or Pass, a fixed upfront Collector Booster, a recorded pre-opening trade window, seller-funded coupons unrelated to outcomes, Rewards Club tiers, disclosed multi-slot shipping support, everything-ships fulfillment, and separate follower giveaways. Whatnot documents the integrated assignment features in its [Breaks feature guide](https://help.whatnot.com/hc/en-us/articles/26596362677389-Breaks-feature-for-sellers). Any allocation-changing format requires a ledger proving that each slot has exactly one final owner.

## Monetization boundary

Analytical truth stays free: calculator, current observations, evidence/omissions, Outcome Fingerprint, Bid Guardrail, Break Balance, card images/prices/odds, compliance, and methodology.

Buyer Pro is a workflow product at $4.99 monthly or $39.99 yearly: saved breaks, show presets, watch alerts, comparisons, personal snapshots, exports, sharing, and synchronization. Seller Workspace follows seller interviews and buyer retention: Starter at $39 monthly for templates, show-note rule cards and margin scenarios; Pro at $79 monthly for the Enticement Frontier, reusable cost library, team work and exports. Payment never changes ranking, evidence, or recommendations.

An optional TCGplayer affiliate action is confined to card details and carries a direct compensation disclosure. It is ancillary: the official program uses Impact and a 48-hour first-click window but does not publish a commission rate. [TCGplayer affiliate program](https://docs.tcgplayer.com/docs/tcgplayer-affiliate-program). An optional support URL can expose Ko-fi immediately once the owner supplies the account. Display ads remain deferred and away from bid controls.

Accounts and billing intentionally do not launch before validated usage. The implemented anonymous event adapter is off unless configured and accepts only a fixed taxonomy: break creation, first-result time bucket, sequential assignment count, sharing, and errors. It excludes bids, costs, searches, card names, share contents, session replay, and persistent identifiers. Weeks 7–12 introduce Supabase and Stripe Checkout/customer portal only after repeat use is demonstrated and the privacy/legal review is complete.

Early revenue cases remain hypotheses, not forecasts: around $23 monthly at 1,000 MAU, $305 at 5,000, and $2,650 at 20,000 from Buyer Pro/support/affiliate combined. Five Seller Starter accounts could produce about $176 net monthly after a ten-percent payment/operating allowance; 25 Seller Pro accounts could produce about $1,778 on the same allowance. Paid acquisition waits for measured retention, conversion, and churn.

## Release sequence and gates

1. Keep the coverage report and regression baseline green on every data build.
2. Review the remaining 84 named structural gaps; corrections require authoritative evidence.
3. Moderate the sequential buyer flow at 320 px, 390 px, and desktop; target first useful result within ten seconds.
4. Require at least 80% of test users to distinguish typical, mean, downside, and chance-to-clear without coaching.
5. Instrument only the allow-listed anonymous events and measure repeat use before accounts.
6. Obtain written pricing rights and legal review before commercial data use, affiliate launch, or subscriptions.
7. Interview active sellers before committing to Seller Workspace.

Performance gates are an analytic update under 100 ms after cached data, an initial 10,000-sample result under two seconds on a representative mid-range phone without blocking input, explicit analytic-only fallback on worker failure, and cache invalidation for composition, price, threshold, slot map, fulfillment, evidence, and remaining-pool changes.

## Non-goals and harm-aware constraints

ColorBreak will not use autoplay openings, slot-machine effects, countdowns, “hot” indicators, escalation prompts, rewards for higher bids, or language implying a guaranteed next outcome. Reduced-motion preferences are respected. Giveaways never raise break EV. Prohibited mechanics never export. Affiliate presence never changes analytical output. Paid entitlement failure never removes the free calculator.

The buyer-research observations that informed this direction are preserved with corrected scope and disposition in [break-buyer-research-2026-08-11.md](./break-buyer-research-2026-08-11.md). Production interpretation notes and the three visual examples live in [visualizations](./visualizations/README.md).
