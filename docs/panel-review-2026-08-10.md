# ColorBreak — Expert panel re-review (2026-08-10)

Full-cycle review of the shipped build: panel round 1 → revisions plan → adversarial
round 2 → final implementation plan → confidence scores.

**Roster provenance.** The plan-time panel was never written down — the original session
left [CONTEXT.md](../CONTEXT.md), [DESIGN.md](../DESIGN.md), and `docs/adr/`, but no list
of seats. The seven seats below are reconstructed from the domains those documents
actually argue in. Correct the roster and the rounds below can be re-run against it.

| Seat | Who | Owns |
|---|---|---|
| **S1** | Whatnot break seller (operator) | cost basis, break-even, pricing desk, orders |
| **S2** | Live-auction buyer (viewer) | the 10-second bid decision, quick check, verdicts |
| **S3** | Mobile interaction designer | one-hand portrait flow, tap targets, sheets |
| **S4** | Information designer | The Board, Break Bar, type/color law, copy |
| **S5** | Financial modeler | fee math, EV, break-even algebra, variance |
| **S6** | MTG sealed/collation analyst | pool construction, pack models, pull rates |
| **S7** | Frontend engineer | single-file constraint, network, a11y, persistence |

State of the build going in: SPEC.md's 14 owner-feedback items are implemented, 63 unit
tests pass, collation format v2 is mid-flight.

---

## Round 1 — panel feedback on the current build

### S1 · Whatnot break seller

1. **Fulfillment defaults to $0, and that silently gifts the seller ~$36.** With the
   default eight singleton orders and $4.99 buyer S&H, `compBreakEven` (`index.html:455`)
   sums +$36 of per-order credit before dividing by the keep rate. A seller who never
   opens Advanced sees a break-even roughly $40 below reality — the exact error the
   2026-08-10 feedback was written to kill, now flipped in sign.
2. **"Ask to clear" allocates break-even strictly by EV share** (`index.html:1077`), so a
   thin White slot is told to ask $1.80. No real break opens a slot under a floor; the
   number is unusable as printed.
3. **Nothing models a slot that doesn't sell.** Break-even assumes all eight hammer.
4. Cost list and desk are good. Combine/ungroup for orders matches how I actually ship.

### S2 · Live-auction buyer

1. **The buyer's verdict ignores the $4.99 the buyer pays.** Quick check computes
   `net = slot EV − asking price` (`index.html:1206`); my landed cost is bid + S&H (+ tax).
   The tool models S&H rigorously for the seller and not at all for me. Every FAIR verdict
   near the deadband is really −EV.
2. **EV is market price; I can't sell at market.** A slot "worth" $25 liquidates for
   maybe $15 after fees, shipping, and the fact that half the EV is $0.30 commons nobody
   buys. The headline number overstates what I get by a lot.
3. LOTTERY/STEADY plus "floor if it misses" is the best thing on the page for me. Keep it.
4. First load of a set is slow — several paged Scryfall fetches. The countdown is ~10s.

### S3 · Mobile interaction designer

1. **Sheets have no focus trap** (`openSheet`, `index.html:827`) — focus lands on the
   first control but tabbing walks straight out behind the scrim. Escape and scrim-tap
   dismissal are correct.
2. Composition builder → set picker → product picker is genuinely two taps. Good.
3. The Advanced block is now 13 inputs in one `<details>`; the two that change money
   (fulfillment, S&H) sit beside collation modelling knobs no buyer will ever touch.
4. No visible "unset" state anywhere: a blank field and a deliberate zero look identical.

### S4 · Information designer

1. The Board holds. Bar, legend, strip, ticker stamp all read at 390px.
2. **The seller strip's four tiles are four different questions** (cost, break-even, EV,
   net). Break-even and net are the decision; cost and EV are supporting.
3. Copy drift risk: if a liquidity haircut ships, "Break EV" must stop meaning two things.
4. `buildSkeleton` writes `colspan="5"` into a six-column desk table
   (`index.html:946`) — cosmetic, but it's a visible short row on empty state.

### S5 · Financial modeler

1. Confirmed: `orderNet` and `compBreakEven` are algebraically correct for the stated
   model, and the pinned test case matches Whatnot's published schedule. No error here.
2. **Tax is excluded from processing with a code comment but not from the UI.** The
   break-even is therefore optimistic by roughly 2.9% of the tax collected. Small, but
   it's an undisclosed assumption on the number sellers act on.
3. **EV without dispersion is the wrong statistic for a single-slot purchase.** A slot
   whose EV is 60% one mythic has a median outcome far below its mean. The build hints at
   this (LOTTERY, floor-if-miss) but the headline is still a mean.
4. Break-even divided by `orders.length` for the "/order avg" line assumes uniform orders;
   with combined orders that average is misleading.

### S6 · MTG sealed/collation analyst

1. **The collector booster model is labelled "(rough)" in the code** (`index.html:419`)
   and it is the model that prices the most expensive breaks people actually run.
2. **Collector pools are built in `"all"` mode** (`index.html:1367`) — the pool includes
   cards that never appear in a collector booster, which dilutes every per-card weight.
3. Variant weight is one global 0.125 across all sets and treatments. It's a guess doing
   real work in the rare/mythic split.
4. Collation v2 in `tools/` is the right long-term fix; the page just needs to say where
   its numbers are soft.

### S7 · Frontend engineer

1. **Persistence saves the global top-60 contributors** (`index.html:1466`). After a
   reload, a weak slot's drill-down can show fewer than 10 cards while the slot's EV total
   (restored from `buckets`) still reflects all of them — list and total disagree.
2. Pools are cached in memory only (`poolCache`), so every fresh page load re-fetches the
   whole set from Scryfall. That's the slow path S2 is complaining about.
3. Relay race, staleness stamping, and the non-blocking sealed-price refresh are solid.
4. Sheets are `aria-modal` without a trap (matches S3's finding from the a11y side).

---

## Revisions plan v1 (as presented back to the panel)

| # | Change | Source |
|---|---|---|
| R1 | Buyer verdicts price the buyer's landed cost: bid + buyer S&H | S2, S5 |
| R2 | Treat fulfillment as *unset* until edited; banner the seller view until it is | S1, S3 |
| R3 | Optional "cash-out %" haircut on EV, one knob, off by default | S2, S6 |
| R4 | Floor "ask to clear" at a minimum and redistribute the remainder by EV share | S1 |
| R5 | Add a probability-of-profit figure per slot | S5, S2 |
| R6 | Persist top 10 per slot instead of global top 60 | S7 |
| R7 | Persist set pools to localStorage so repeat loads are instant | S7, S2 |
| R8 | Focus trap in sheets | S3, S7 |
| R9 | Build collector pools from the booster-flagged pool, not `"all"` | S6 |
| R10 | Surface model softness on collector line items | S6 |
| R11 | Fix `colspan`; tighten seller strip to the two decision tiles | S4 |
| R12 | Disclose the tax exclusion in Advanced copy | S5 |

---

## Round 2 — adversarial critique of the revisions plan

**S1 attacks R3 and R4.** "Cash-out % is a second EV knob next to the min-value
threshold, and they overlap — a 65% haircut and a $2 floor both mean 'ignore bulk.' Two
knobs, one intent, guaranteed user confusion. And R4's redistribution changes the meaning
of break-even: if I floor White at $5 and shift the difference off Green, my asks no
longer sum to a clean break-even unless you're careful. Show the floor as advice, don't
rewrite the allocation."

**S2 attacks R1 and R5.** "R1 is right but it must not double-count: if I'm bidding on
three slots from one seller and they combine my order, I pay S&H once, not three times.
Charging me $4.99 per slot makes the tool pessimistic in exactly the case sellers
advertise. R5 I'd cut outright — I have ten seconds. A probability I can't check is
another number to distrust; 'floor if it misses' already told me the story."

**S3 attacks R7 and R2.** "R7 caches card pools with image URLs and Oracle text — that's
hundreds of KB per set, and localStorage is 5MB shared with board state. Two big sets and
you're evicting the user's own composition. If you cache, cache thin. R2 I support, but a
banner that can't be dismissed until a field is filled is a wall in front of the seller
view; make it a prompt with a sane suggested value, not a blocker."

**S4 attacks R3 and R11.** "If EV can mean two things, every EV string on the page needs
re-copy — strip, slot cards, drill-down, quick check, footer, share text. That's the copy
pass all over again. Only worth it if the haircut is off by default and annotated exactly
like the threshold already is. R11's strip tightening is scope creep dressed as polish;
the four tiles are fine, don't relitigate The Board."

**S5 attacks R1 and R6.** "R1 changes the input to `verdictOf`, which is pinned by tests
and described in DESIGN.md as 'net = slot EV − asking price.' That's fine — the deadband
rule is unchanged and the pin still holds — but the label must change with it or you've
made the page lie in a new way. R6 is a real bug, not a revision; it should ship
independent of everything else here."

**S6 attacks R9 and R10.** "R9 is not a one-liner. Collector boosters legitimately contain
prints that Scryfall doesn't flag as `booster` — that's why `"all"` was chosen. Narrowing
it without a per-set inclusion rule will *lose* real chase cards and make collector EV too
low, which is worse than too high because sellers will underprice. Do not touch pool
construction ahead of collation v2. R10 — the honesty banner — costs nothing and should
ship now."

**S7 attacks R7 and R8.** "R7's real fix isn't caching, it's that the drill-down and popup
need image and Oracle text but the *board math* doesn't. Split the cached record: keep the
math fields, refetch card detail by id on popup. R8 is trivial and uncontroversial; ship
it in the same commit as the colspan fix."

---

## Final implementation plan

Ordered. Each item carries its acceptance criterion. Anything the panel killed is listed
at the bottom with the reason, so it doesn't get silently re-proposed.

### P0 — correctness of the numbers people act on

**F1. Buyer verdicts price landed cost.**
Quick check and slot verdicts compare slot EV against *bid + buyer S&H*, not bid alone.
`verdictOf` and its deadband are untouched; only the price fed into it changes. The S&H
component is charged **once per order**, not once per slot: when a buyer is evaluating a
single slot it is the full S&H, and the quick check gains a "combining with another slot"
toggle that drops it to zero. Every affected figure is relabelled ("net at $22 + $4.99
S&H").
*AC:* a $22 bid on a $25-EV slot reads −$1.99 with S&H on and +$3.00 with combining on;
DESIGN.md's verdict section gains one sentence defining the price input.

**F2. Fulfillment is unset, not zero.**
Distinguish "never edited" from "deliberately $0". While unset, the seller view shows the
existing yellow advisory with a suggested starting value and a one-tap accept; break-even
still computes, annotated as excluding fulfillment. Not a blocker (S3's amendment).
*AC:* a fresh profile entering seller view sees the advisory; accepting the suggestion
dismisses it permanently; an explicit $0 also dismisses it.

**F3. Restore-fidelity fix (independent, ship first).**
Persist the top 10 contributors *per slot* rather than the global top 60, so a restored
board's drill-downs and totals agree.
*AC:* load a board, reload the page, open the weakest slot — 10 cards, and their sum is
consistent with the slot total shown.

**F4. Cosmetic and a11y sweep, one commit.**
Focus trap in all four sheets; `colspan` corrected to 6.
*AC:* Tab cycles within an open sheet and returns to the invoking control on close.

### P1 — honesty about softness

**F5. Collector-model honesty banner.**
Any collector line item in the composition triggers the existing warning-banner pattern:
collector collation is an estimate, EV is directional, collation v2 is the fix in flight.
*AC:* adding a collector booster line item shows the banner; removing it clears it.

**F6. Tax disclosure.**
Advanced copy states that processing is computed on hammer + S&H excluding tax, and that
break-even is therefore slightly optimistic where tax applies.
*AC:* copy present; no math change.

**F7. Ask-to-clear floor as advice, not reallocation** (S1's amendment).
Slots whose EV-share allocation lands below a minimum show the floor value with a marker
and a footnote that asks below it aren't realistic; the allocation itself is unchanged, so
asks still sum to break-even.
*AC:* a break with a near-zero White slot shows the floor marker; the desk's ask column
still sums to the break-even hammer.

### P2 — performance, gated on measurement

**F8. Thin pool cache.**
Persist only the math fields of a set's pool (id, name, cn, rarity, bucket, treat, prices)
under an LRU of two sets; card image and Oracle text are refetched by id when a popup
opens. Ship only if measured payload stays under ~150KB per set.
*AC:* second load of a cached set paints the board without a Scryfall round trip; total
localStorage stays under 2MB with two sets cached and a full board saved.

### Killed, with reasons

- **R3 (cash-out haircut)** — killed. S1 and S4 both landed it: it duplicates the existing
  min-value threshold's intent and would force a second full copy pass. The realization
  gap is real; the fix is the threshold that already exists, documented better.
- **R5 (probability of profit)** — killed. S2's ten-second constraint; "floor if it
  misses" already carries the variance story.
- **R9 (collector pool narrowing)** — killed for now. S6: narrowing without a per-set
  inclusion rule loses real chase cards and biases collector EV *low*, which makes sellers
  underprice. Blocked behind collation v2.
- **R11's strip retightening** — killed. S4: The Board is settled; not re-litigated.

---

## Confidence in the final plan

| Seat | Confidence | ELI5 |
|---|---|---|
| **S1** Seller | **88** | The two numbers that decide whether I make money — what I paid to ship, and what each slot must clear — stop lying to me. The plan didn't touch my desk layout, which is the part that already works. Points off because a slot that just doesn't sell still isn't modelled anywhere. |
| **S2** Buyer | **85** | The price I actually pay now includes the shipping fee I actually pay. That's the whole thing. They cut the fancy probability number, which is right — I have ten seconds, not ten minutes. Points off because "worth $25" still means catalog value, not what I could resell it for. |
| **S3** Mobile designer | **90** | Nothing new gets bolted onto a screen that's already tight, one real trap is fixed so keyboard and screen-reader users stop falling out of a popup, and the nagging prompt is a suggestion instead of a wall. Small, safe, mine-shaped. |
| **S4** Info designer | **93** | The plan changes numbers, not the look. No new colors, no new sizes, and — critically — no second meaning for the word "EV", because they killed the change that would have caused one. Highest confidence because the risk I care about was removed. |
| **S5** Financial modeler | **86** | The math was already right; the problem was one side of the trade got modelled and the other didn't. Now both do, using the same fee model, with the pinned rule untouched. Points off for the tax assumption still being disclosed rather than computed. |
| **S6** Collation analyst | **80** | They're telling users where the guessing is instead of pretending precision, and they refused to "fix" the collector pool in a way that would have quietly deleted expensive cards from the estimate. Lowest score not because the plan is wrong but because the real fix is a different project that isn't done. |
| **S7** Frontend engineer | **89** | Two genuine bugs get their own commits instead of riding along with feature work, and the risky caching idea got cut down to the version that can't blow up the user's saved board. Points off because the caching item is still "ship if it measures well", which is a promise, not a result. |

**Panel mean: 87.**
