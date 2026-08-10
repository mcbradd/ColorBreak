# ColorBreak

Price board for MTG Whatnot color breaks. Primary use case: a buyer watching a live auction countdown (often ~10 seconds) needs a fast, glanceable answer to "is this slot worth bidding on" — not a report to review later. Speed and minimal taps beat completeness. Sharing a finished break has little value; the tool is a live-decision aid, not a results page.

## Language

**Basis**:
Which of two sealed-product prices a slot's cost uses: the current sealed-box fraction (default) or, if that box isn't available in the market, the loose-pack price as a fallback.
_Avoid_: using "basis" for the paid-vs-market question below — that's a **cost override**, a different concept.

**Cost override**:
A seller-entered dollar amount that replaces the auto-computed market price for a line item, used when the seller's actual acquisition cost (e.g. inventory bought earlier at a different price) differs from today's market. Defaults to unset (market price applies).
_Avoid_: "basis" (see above), "paid basis."

**Order**:
One or more slots a single buyer wins and pays for together, sharing one fulfillment cost and one buyer S&H charge. Defaults to one order per slot; a buyer can group any number of their own won slots (not necessarily adjacent) into one order. There is no Whatnot platform feature for combined orders — a seller offering reduced or free S&H on multi-slot orders is a seller-chosen incentive, not a platform mechanic, so both fulfillment cost and buyer S&H must be overridable per order, not just set once globally.
_Avoid_: "combined order" as a platform term — it's seller-specific, not a Whatnot feature.
