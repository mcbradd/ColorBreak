# ColorBreak domain context

## Purpose

ColorBreak supports two time-sensitive jobs: a buyer deciding whether to bid on one color slot, and a seller deciding whether and how to run the break. The buyer path optimizes for a roughly ten-second decision. The seller path can expose more controls, but must begin with a useful plan rather than a blank form.

## Ubiquitous language

- **Break**: the complete opening, composed of one or more sealed product lines and one declared slot map.
- **Auction**: one sequential purchase whose winner receives a uniformly random slot from the remaining pool.
- **Remaining pool**: the unassigned color slots available to the next auction.
- **Product line**: set, sealed product, quantity, and optional acquisition cost.
- **Color slot**: W, U, B, R, G, M, C, or L. Classification uses front-face printed color; lands always belong to L.
- **Market EV**: expected value of every resolved card at its exact-finish market price.
- **Counted EV**: expected value from card finishes at or above the user’s “Ignore bulk under” threshold. The threshold is a value filter, not a liquidity claim.
  _Avoid_: Sellable EV
- **Known EV**: priced value that is safe to claim after unresolved contents are omitted. It equals Market EV when the result is complete.
- **Landed bid**: hammer price plus shipping added by the current purchase. Tax is disclosed but not modeled in the buyer verdict.
- **Transaction**: one buyer purchase. Commission, percentage processing, and the fixed processing fee apply here.
- **Shipment**: buyer-grouped fulfillment. Packing and seller-covered shipping apply here; a shipment is not automatically one color slot.
- **Target plan**: proposed asks needed to achieve a margin. It is not an actual outcome.
- **Actual asks**: seller-confirmed asks used to calculate projected profit.
- **Outcome Fingerprint**: a 20-bin frequency view of modeled outcomes that makes the median, downside, upside, mean, and landed-cost boundary visible together.
- **Evidence state**: separate claims about product identity, contents, collation, finish, break rules, and price freshness. A material unresolved claim suppresses outcome assertions.
- **Eligible / Estimated / Incomplete**: decision-confidence states. Incomplete is a disclosed lower bound and suppresses buyer verdicts and probability views.
- **Omission**: a named unresolved product, booster, printing, finish, or sheet weight. Material omissions change status to Incomplete.

## Source policy

MTGJSON provides versioned sealed products and collation. Scryfall provides exact-printing metadata, images, and current price observations. Product acquisition cost is user-entered until ColorBreak has written rights to a commercial sealed-price source. `data/corrections.json` contains narrow, sourced product facts from authoritative sources and takes precedence over upstream sealed metadata. No adapter may silently substitute finishes, guess missing contents, or drop a foreign-set printing.

## Experience laws

Product selection triggers calculation immediately. The buyer defaults to sequential random assignment; Pick My Color is alternate mode. Mobile touch is primary; desktop mouse and keyboard are secondary inputs. Advanced details are progressively disclosed. Confidence and omissions appear beside the number they qualify, not in a remote disclaimer. Removing an assigned slot takes one tap and is undoable.
