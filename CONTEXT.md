# ColorBreak domain context

## Purpose

ColorBreak supports two time-sensitive jobs: a buyer deciding whether to bid on one color slot, and a seller deciding whether and how to run the break. The buyer path optimizes for a roughly ten-second decision. The seller path can expose more controls, but must begin with a useful plan rather than a blank form.

## Ubiquitous language

- **Break**: the complete opening, composed of one or more sealed product lines and one declared slot map.
- **Auction**: one sequential purchase whose winner receives a uniformly random slot from the remaining pool.
- **Remaining pool**: the unassigned color slots available to the next auction.
- **Product line**: set, sealed product, quantity, and optional acquisition cost.
- **Color slot**: W, U, B, R, G, M, C, or L. Classification uses front-face printed color; lands always belong to L.
- **Market EV**: expected value of every resolved card at its exact-printing price. A treatment-specific market observation is preferred; until one exists for a premium treatment, the same printing's listed TCG foil price is used and labeled.
- **Counted EV**: expected value from card finishes at or above the user’s “Ignore bulk under” threshold. The threshold is a value filter, not a liquidity claim.
  _Avoid_: Sellable EV
- **Known EV**: priced value that is safe to claim after unresolved contents are omitted. It equals Market EV when the result is complete.
- **Landed bid**: hammer price plus shipping added by the current purchase. Tax is disclosed but not modeled in the buyer verdict.
- **Transaction**: one buyer purchase. Commission, percentage processing, and the fixed processing fee apply here.
- **Shipment**: buyer-grouped fulfillment. Packing and seller-covered shipping apply here; a shipment is not automatically one color slot.
- **Target plan**: proposed asks needed to achieve a margin. It is not an actual outcome.
- **Actual asks**: seller-confirmed asks used to calculate projected profit.
- **Outcome Fingerprint**: a 20-bin frequency view of modeled outcomes that makes the median, downside, upside, mean, and landed-cost boundary visible together.
- **Evidence state**: separate claims about product identity, contents, collation, finish, break rules, and price freshness. A material unresolved claim adds a specific warning to outcome assertions.
- **Eligible / Estimated / Incomplete**: decision-confidence states. Incomplete means the result uses only resolved contents and prices; verdicts and probability views remain visible with named warnings about what is missing and how it may affect the result.
- **Omission**: a named unresolved product, booster, printing, finish, or sheet weight. Material omissions change status to Incomplete.
- **Bid Check**: the buyer's time-critical workspace for deciding whether to bid and setting a maximum hammer price. It has Prepare and Live states, but they share one saved decision.
- **Large Break**: the buyer's high-volume random-spot view. It prices a declared spot count from the same break composition and bulk threshold as Bid Check.
- **Named spot**: one top-market-value card identity, except that character cards sharing a character name form one spot. Every eligible printing, treatment, and finish for that identity goes to the same spot; for example, every Jace card belongs to the single **Jace** spot.
- **Residual category spot**: one indivisible slot that receives the entire remaining creature-color or card-type pool after all named spots are excluded. A slot is never repeated or split among buyers.
- **Seller Studio**: the seller's planning workspace for deciding whether to run a break, pricing it, checking downside, and producing policy-safe launch assets.
- **Truth engine**: the shared composition, collation, pricing, evidence, simulation, auction, and fee model used by both workspaces. A seller-authored link supplies assumptions but never overrides buyer-visible evidence.
- **Bid ceiling**: the greatest hammer price consistent with the buyer's selected risk stance after incremental shipping and any explicitly modeled costs. It is a limit, not a prediction or encouragement to bid.
- **Viability decision**: the Seller Studio result: Run, Reprice, Change mix, or Do not run, supported by net profit, break-even fill, and explicit assumptions.
- **Break-even fill**: the minimum number or percentage of planned spots that must sell at the modeled prices for seller net profit to reach zero.
- **Risk stance**: a buyer-selected interpretation of modeled outcomes (Protect downside, Balanced, or Chase upside) used to derive a bid ceiling. It never changes the underlying distribution.
- **Launch pack**: buyer-facing and operational assets generated from the same modeled break: rules, spot labels, listing copy, show notes, a portrait graphic, and a checklist.

## Source policy

MTGJSON provides versioned sealed products and collation. Scryfall provides exact-printing metadata, images, and current price observations. A daily build-time TCGCSV snapshot provides a sealed-product market reference; the seller can override it with their actual acquisition cost. `data/corrections.json` contains narrow, sourced product facts from authoritative sources and takes precedence over upstream sealed metadata. A premium treatment without its own market observation may use the same printing's listed TCG foil price, with that basis shown to the user. No adapter may cross printings or foil classes, guess missing contents, or drop a foreign-set printing.

## Experience laws

Product selection triggers calculation immediately. The buyer defaults to a specific color, and that choice stays synchronized across buyer and seller views, charts, contributors, and shared links. Random remaining-slot analysis is an explicit alternate mode. Mobile touch is primary; desktop mouse and keyboard are secondary inputs. Advanced details are progressively disclosed. Confidence and omissions appear beside the number they qualify, not in a remote disclaimer. Removing an assigned slot takes one tap and is undoable.
