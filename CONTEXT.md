# ColorBreak domain context

## Purpose

ColorBreak supports two time-sensitive jobs: a buyer deciding whether to bid on one color slot, and a seller deciding whether and how to run the break. The buyer path optimizes for a roughly ten-second decision. The seller path can expose more controls, but must begin with a useful plan rather than a blank form.

## Ubiquitous language

- **Break**: the complete opening, composed of one or more sealed product lines.
- **Product line**: set, sealed product, quantity, and optional acquisition cost.
- **Color slot**: W, U, B, R, G, M, C, or L. Classification uses front-face printed color; lands always belong to L.
- **Market EV**: expected value of every resolved card at its exact-finish market price.
- **Sellable EV**: expected value from cards at or above the user’s sellable threshold.
- **Known EV**: priced value that is safe to claim after unresolved contents are omitted. It equals Market EV when the result is complete.
- **Landed bid**: hammer price plus shipping added by the current purchase. Tax is disclosed but not modeled in the buyer verdict.
- **Transaction**: one buyer purchase. Commission, percentage processing, and the fixed processing fee apply here.
- **Shipment**: buyer-grouped fulfillment. Packing and seller-covered shipping apply here; a shipment is not automatically one color slot.
- **Target plan**: proposed asks needed to achieve a margin. It is not an actual outcome.
- **Actual asks**: seller-confirmed asks used to calculate projected profit.
- **Verified / Estimated / Incomplete**: data-confidence states. Incomplete is a lower bound and suppresses a buyer verdict.
- **Omission**: a named unresolved product, booster, printing, finish, or sheet weight. Material omissions change status to Incomplete.

## Source policy

MTGJSON provides sealed products and collation, Scryfall provides exact-printing prices, and tcgcsv provides best-effort sealed market prices. `data/corrections.json` contains reviewed product facts from authoritative sources and takes precedence over upstream sealed metadata. No adapter may silently substitute nonfoil for foil, guess missing box contents, or drop a foreign-set printing.

## Experience laws

Product selection triggers calculation immediately. Buyer and seller are separate task flows over one valuation engine. Mobile touch is primary; desktop adds a persistent composition pane. Advanced details are progressively disclosed. Confidence and omissions appear beside the number they qualify, not in a remote disclaimer.
