# ColorBreak domain context

## Purpose

ColorBreak supports two time-sensitive jobs: a buyer deciding whether to bid on one color slot, and a seller deciding whether and how to run the break. The buyer path optimizes for a roughly ten-second decision. The seller path can expose more controls, but must begin with a useful plan rather than a blank form.

## Ubiquitous language

- **Best available answer**: the current estimate from the strongest available evidence, improved as data arrives. Fresh exact observations take precedence over matching cached observations, which take precedence over a disclosed approximation. When no defensible estimate exists for an item, the known subtotal still appears; an unknown contribution of $0 never claims that item is worthless.
- **Estimate note**: the universal circled asterisk beside a calculated field or graphic. Tapping it explains the relevant missing data or assumptions in concise everyday language.
- **MIN / MAX**: minimum and maximum possible counted card value under the available pack rules and prices, including rare outcomes. For a random spot, the limits span the remaining eligible slots; marginal color maxima are not summed. Missing data or approximate pack rules qualify these bounds.
- **Quick range**: immediate modeled MIN and MAX, with a provisional typical value while sampling is refined.
- **Recorded-so-far estimate**: recorded revenue less recorded fees and the best available cost assumptions. Missing sales are never fabricated, and this becomes actual profit only after reconciliation.

- **Break**: the complete opening, composed of one or more sealed product lines and one declared slot map.
- **Auction**: one sequential purchase whose winner receives a uniformly random slot from the remaining pool.
- **Remaining pool**: the unassigned color slots available to the next auction.
- **Product line**: set, sealed product, quantity, and optional acquisition cost.
- **Color slot**: W, U, B, R, G, M, C, or L. Classification uses front-face printed color; lands always belong to L.
- **Market EV**: expected value of every resolved card at its exact-printing price. A treatment-specific market observation is preferred; until one exists for a premium treatment, the same printing's listed TCG foil price is used and labeled.
- **Counted EV**: expected value from card finishes at or above the user’s “Ignore bulk under” threshold. The threshold is a value filter, not a liquidity claim.
  _Avoid_: Sellable EV
- **Known EV**: priced value that is safe to claim after unresolved contents are omitted. It equals Market EV when the result is complete.
- **Landed bid**: hammer price plus every buyer cost the purchase adds — shipping, tax, fees.
- **Transaction**: one buyer purchase. Commission, percentage processing, and the fixed processing fee apply here.
- **Shipment**: buyer-grouped fulfillment. Packing and seller-covered shipping apply here; a shipment is not automatically one color slot.
- **Target plan**: proposed asks needed to achieve a margin. It is not an actual outcome.
- **Actual asks**: seller-confirmed asks used to calculate projected profit.
- **Outcome Fingerprint**: a 20-bin frequency view of modeled outcomes that makes the median, downside, upside, mean, and landed-cost boundary visible together.
- **Evidence state**: separate claims about product identity, contents, collation, finish, break rules, and price freshness. A material unresolved claim adds a specific warning to outcome assertions.
- **Eligible / Estimated / Incomplete**: decision-confidence states. Incomplete means some evidence remains unresolved; the best available estimate and any defensible approximation remain visible with an estimate note describing their limits.
- **Omission**: a named unresolved product, booster, printing, finish, or sheet weight. Material omissions change status to Incomplete.
- **Bid Check**: the buyer's time-critical workspace for deciding whether to bid and setting a maximum hammer price. It has Prepare and Live states, but they share one saved decision.
- **Large Break**: the buyer's high-volume random-spot view. It prices a declared spot count from the same break composition and bulk threshold as Bid Check.
- **Named spot**: one top-market-value card identity, except that character cards sharing a character name form one spot. Every eligible printing, treatment, and finish for that identity goes to the same spot; for example, every Jace card belongs to the single **Jace** spot.
- **Residual category spot**: one indivisible slot that receives the entire remaining creature-color or card-type pool after all named spots are excluded. A slot is never repeated or split among buyers.
- **Seller Studio**: the seller's planning workspace for deciding whether to run a break, pricing it, checking downside, and producing policy-safe launch assets.
- **Truth engine**: the shared composition, collation, pricing, evidence, simulation, auction, and fee model used by both workspaces. A seller-authored link supplies assumptions but never overrides buyer-visible evidence.
- **Bid ceiling**: the greatest hammer price whose landed cost still fits inside the typical modeled value of the remaining pool, after the buyer's standing costs. It is a limit, not a prediction or encouragement to bid.
- **Viability decision**: the Seller Studio result: Run, Reprice, Change mix, or Do not run, supported by net profit, break-even fill, and explicit assumptions.
- **Break-even fill**: the minimum number or percentage of planned spots that must sell at the modeled prices for seller net profit to reach zero.
- **Buyer costs**: the buyer's standing assumptions about what a winning purchase costs on top of the hammer price — added shipping, sales tax, platform or payment fees, and any flat per-purchase fee. Set once, kept for the session, and removed from the modeled value to produce the bid ceiling.
- **Launch pack**: buyer-facing and operational assets generated from the same modeled break: rules, spot labels, listing copy, show notes, a portrait graphic, and a checklist.

## Source policy

Each sealed SKU resolves its exact constituent pack codes (including foreign sets), quantities, and fixed cards. `data/collation-rules.json` records scoped facts with official → community → inferred precedence. Source priority applies to each fact independently: a verified card count does not certify all printing weights. `data/product-collation.json` is the generated, release-gated product-to-recipe map. Community MTGJSON variants remain the fallback for facts not covered by a sourced rule. Color balancing uses front-face mono colors, independently of break slot assignment; known rules survive missing prices and other partial data. Unpublished within-pack order and box print-run correlations are explicitly estimated.

Unknown exact odds no longer erase a priced card: community or inferred positive odds contribute to EV and possible ranges with a specific uncertainty note. Unknown prices still contribute zero to the known subtotal. This supersedes the earlier policy that excluded all unverifiable collector odds from EV.

MTGJSON provides versioned sealed products and collation. Scryfall provides exact-printing metadata, images, and current price observations. A daily build-time TCGCSV snapshot provides a sealed-product market reference; the seller can override it with their actual acquisition cost. `data/corrections.json` contains narrow, sourced product facts from authoritative sources and takes precedence over upstream sealed metadata. A premium treatment without its own market observation may use the same printing's listed TCG foil price, with that basis shown to the user. No adapter may silently cross printings or foil classes or drop a foreign-set printing. Missing pack grouping can use an explicitly disclosed independent-card approximation; a generic pack recipe is a provisional estimate, never a claim about confirmed contents.

## Experience laws

Product selection triggers calculation immediately. The buyer defaults to a specific color, and that choice stays synchronized across buyer and seller views, charts, contributors, and shared links. Random remaining-slot analysis is an explicit alternate mode. Mobile touch is primary; desktop mouse and keyboard are secondary inputs. Advanced details are progressively disclosed. Confidence and omissions appear beside the number they qualify, not in a remote disclaimer. Removing an assigned slot takes one tap and is undoable.
