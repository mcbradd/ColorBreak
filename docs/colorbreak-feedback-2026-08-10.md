# ColorBreak — Change Spec from Owner Feedback (2026-08-10)

> **Superseded by [SPEC.md](../SPEC.md)** for status/consolidation. Kept as the detailed
> acceptance-criteria backing doc for the 2026-08-10 items.

Source: owner playtest of the live build at https://mcbradd.github.io/ColorBreak (main branch, single-file `index.html`, vanilla JS, no build step). This document supersedes conflicting behavior in the current build and in DESIGN.md where noted. Work through P0 before P1, P1 before P2. Each item has acceptance criteria (AC).

## Verdict on current build

The math is not the problem; the product model is. Two structural failures drive most items below:

1. **Wrong cost model.** The build currently rolls seller fulfillment costs into box cost, inflating totals by ~$40 and ignoring that Whatnot buyers pay a flat per-order S&H fee that offsets most seller shipping cost. Item 3.
2. **Single-product assumption.** The build models "one set, one booster type, N boxes." Real breaks are arbitrary compositions: 8 loose packs of one set, 1 collector booster each from two different sets, a bundle's 9 packs + 1 collector booster. Item 5.

Also: the current layout reads as amateur, not "genius design." Full visual/UX redesign is in scope (Item 1), mobile-portrait-first.

## Hard constraints (apply to every item)

- **Mobile portrait first.** Design for a phone held one-handed, one-thumb navigation, minimal typing. Mouse/keyboard desktop is the secondary target and must still work.
- **Fewest clicks to EV.** The primary screen answers "what is this break worth" with the least interaction possible. Everything else is secondary navigation.
- **Minimize user data entry.** Anything knowable from data (product catalogs, market prices, fee schedules, break-even) is fetched or precomputed, never typed by the user. User inputs are limited to: what the break consists of, their own costs, their own sale prices, and optional overrides.
- **Static product data lives in the repo.** Facts that do not change (which sealed products exist per set, packs per box, packs per bundle) are committed as a data file, not fetched at runtime and not entered by users.
- **Keep the existing warning-banner pattern** (the yellow "preview mode / Scryfall hasn't flagged" style) for all new advisory states.
- Keep: single `index.html`, no build step, `localStorage` state, `// @pure` test fencing, Scryfall + tcgcsv.com price sources.

---

## P0 — Product model and cost model

### 1. Full UI/UX redesign, mobile-first

The current page fails on first open: on desktop it is confusing what you are looking at, header content truncates ("play b..."), and the overall impression is "made by somebody with no web experience." Serviceable is not the bar; compelling is.

- Redesign the entire page hierarchy around the flows in this doc: pick break contents → see EV → drill into slots → (seller) price the desk.
- The Break Bar (per-slot value distribution) is good; keep it as the signature element and make it the drill-down entry point (Item 7).
- Owner explicitly delegates the mode-switching mechanism (tabs vs. toggle vs. sections, Item 4) and overall layout solution to the implementer. Optimize for the constraints above; do not present options, pick one.
- AC: no truncated or clipped text at 390px width portrait. Every interactive target ≥ 44px. Primary flow (set → product → EV) completable with taps only, zero keyboard, on a phone.

### 2. Set picker replaces raw set-code entry as the primary input

Users must not need set codes memorized.

- Primary: a browsable, searchable list of all sets (Scryfall `/sets` API is the source of truth). Search-as-you-type on set name. Sort options (at minimum: release date, name) and set-type filters (expansion, masters, commander, etc.).
- Functional reference: https://www.mtgstocks.com/sets (search + set-type checkboxes + sort dropdown). Its functionality is right; its layout is not. That page is mouse-and-keyboard design. Rebuild the same capability as a touch-first UI (e.g., bottom-sheet picker, large tap rows, thumb-reachable controls).
- Secondary: typing a set code directly still works for users who know it.
- Keep the "recent sets" quick-tap affordance.
- AC: a user who knows only "the Hobbit set" can reach it in ≤ 3 taps + partial name typing, one-handed.

### 3. Split the cost model: seller fulfillment cost vs. buyer S&H

Current behavior is wrong: it adds ~$40 of fees/shipping into box cost. The two sides of the transaction must be modeled separately.

**Seller side:**
- One field: **fulfillment cost per order** ("cost to get an order out the door": mailer, postage, materials, combined). Do NOT itemize into separate mailer/postage/etc. fields. One number.
- Lives in a set-once settings area (the existing Advanced pattern is the right home; users configure once and rarely change it).

**Buyer side:**
- Whatnot charges the buyer a flat S&H fee per order in addition to the winning bid (typically ~$4.99). Model this as a configurable constant, default $4.99.
- This buyer-paid S&H offsets the seller's fulfillment cost. Seller net shipping cost = fulfillment cost − buyer S&H collected. It can be negative (S&H exceeds actual cost).

**Fee math (verified against Whatnot's published schedule, Aug 2026):**
- Commission: 8% of item sale price (hammer), excluding shipping and taxes.
- Payment processing: 2.9% + $0.30 per order, on total order value (hammer + buyer-paid S&H + tax).
- Replace the current flat "≈11%" simplification with this two-part model. Keep both rates user-editable in Advanced with these as defaults.
- AC: for a slot that hammers at $20 with $4.99 buyer S&H and $2.00 seller fulfillment cost, seller net = 20 − (0.08×20) − (0.029×24.99 + 0.30) − 2.00 + 4.99. Unit-test this exact case in the `@pure` block.

### 4. Buyer mode and seller mode

The tool serves both sides of the transaction; the current build blurs them.

- **Buyer view** surfaces: per-slot EV, chase card, LOTTERY/STEADY, quick check ("is $22 for Green +EV"), top contributors.
- **Seller view** surfaces: total product cost at market, auto-computed break-even (Item 10), pricing desk, per-slot net and margin.
- Default view: buyer (the simplest "what's it worth" question). Mechanism (tabs, toggle, whatever) is implementer's choice per Item 1.
- AC: each view shows only its side's numbers; nothing requires mental subtraction of the other side's costs.

### 5. Break composition builder (multi-product breaks)

Replace "set code + booster type + boxes" as the unit of analysis with a **break** = ordered list of line items, each `{set, product type, quantity}`.

- Add-a-product flow: pick set (Item 2) → pick product from that set's catalog (Item 6) → set quantity. Repeat to add more line items.
- Line items may span different sets and different product types. Required-to-work examples from real breaks:
  - 8 loose packs of The Hobbit (fractional box: 8 of 30 packs).
  - 1 collector booster of Tarkir: Dragonstorm + 1 collector booster of Modern Horizons.
  - 1 bundle's contents from one set: 9 play boosters + 1 collector booster.
- All EV, distribution, break-even, and desk math aggregates across the full composition.
- AC: each example above produces a priced board. URL-share format (`?set=…&preset=…`) is extended or replaced to encode full compositions; old single-set URLs still resolve.

### 6. Per-set product catalog (static data)

When a set is selected, the product dropdown lists the actual sealed products that exist for that set: draft boosters, set boosters, play boosters, collector boosters, boxes and cases thereof, bundles, prerelease packs, three-booster packs, sleeved/sleeve collector packs, etc. (mtgstocks.com's sealed pages per set show the shape of this data, e.g. /sets → set → sealed).

- This is research-once, write-once data. Build it (script in `tools/` is fine, tcgcsv.com product listings are a viable source since they mirror TCGplayer's per-set product catalogs) and commit it as a static JSON data source the page reads. Do not make users enter product types manually and do not fetch the catalog live per page load.
- Catalog entries carry the constants math needs: packs per box, packs per bundle, boosters per prerelease pack, etc.
- AC: selecting Modern Horizons 2 offers at least draft/set/collector boosters (pack and box), bundle, and prerelease pack, each with correct pack counts.

### 7. Seller cost basis: fraction of sealed box price, not loose packs

Sellers buy sealed product, not loose packs. Cost basis for a break of N packs = N / (packs per box) × current sealed box market price (tcgcsv.com / TCGplayer market). E.g., 8 packs from a 30-pack box = 8/30 of box price. Same fractional logic for any partial-product line item.

**Loose-pack fallback (old sets):**
- If sealed box price data is unavailable or unreliable (no realistic sales volume; e.g., Revised boxes), fall back to loose pack prices.
- Fallback triggers a warning banner (existing yellow pattern) stating which basis is in use, plus a per-line-item toggle letting the user force either basis (use thin sealed data anyway, or use loose packs).
- Define "unreliable" with an explicit heuristic in code (e.g., no listing, or price staleness/volume threshold from the tcgcsv data available) and document the heuristic in a code comment. If tcgcsv exposes no volume signal, absence-of-listing is the trigger; note that limitation in the banner copy.
- AC: a Revised 8-pack break prices from loose packs with the banner shown; a current-set break prices from box fraction; the toggle switches basis and recomputes.

---

## P1 — Analysis and drill-down

### 8. Slot drill-down: top 10 contributors

Tapping/clicking a slot anywhere it appears (Break Bar segment, desk row, distribution list) opens that slot's **top 10 cards by EV contribution** for the current composition. This is the buyer question "I've got White in this Hobbit 8-pack break; what actually drives its value?"

- Top 10 by contribution (expected copies × price), descending. Exactly 10 (fewer if the slot has fewer contributors).
- The existing global Top Contributors table remains but slot-tap filters/navigates to the slot-scoped view.
- AC: tapping the White segment after loading a board shows White's 10 highest-EV cards with prices and expected copies.

### 9. Remove the $1 floor; add an optional threshold filter

Reverses the original spec. Current behavior (cards under $1 count toward pull rates but not EV) is now wrong.

- Default: ALL cards count toward EV, no floor.
- Advanced option: user-settable minimum card value threshold. When set, cards below it are excluded from EV so the user sees only "real" (non-bulk) value.
- Off by default. When active, its effect must be unmistakable: show the active threshold and the excluded-value delta wherever EV is displayed (e.g., "EV $412 · excluding $38 under $2.00").
- Update README/DESIGN copy that states the $1 rule.
- AC: with threshold off, EV includes sub-$1 cards; with threshold $2 set, all EV displays carry the exclusion annotation.

### 10. Auto-computed break-even; auto-populate seller costs

Sellers should not hand-enter "box cost" and fee numbers that the tool already knows.

- Break-even for the composition = (market cost of all line items per Item 7) + (fulfillment cost per Item 3) + (platform fees per Item 3), auto-calculated and auto-populated. Label it plainly as the number the break must clear.
- Manual override stays possible (seller may have paid below market) but market-derived is the default state, no entry required.
- Pricing desk reworks around this: as the seller enters actual slot sale prices, show running net above/below break-even ("anything above that gives you a net of X").
- AC: loading a composition in seller view shows a populated break-even with zero cost fields touched; entering 8 slot prices shows cumulative net vs. break-even live.

### 11. Card popups: image + Oracle text on every card name

Every card name anywhere in the UI (top contributors, chase card, drill-downs, desk) is tappable and opens a popup with:
- The Scryfall card image for the **exact printing/version being priced** (correct set, collector number, finish; foils show the priced finish).
- Oracle text adjacent or below, readable on a phone without zooming.
- One tap to open, one tap/swipe to dismiss. Scryfall image URIs from data already being fetched; avoid extra API round-trips where the card object is already in memory.
- AC: tapping a chase card name on a phone shows its image + Oracle text; the printing shown matches the price used.

### 12. Pricing desk and contributor presentation rework

The desk's information is valuable (per-slot sale entry especially) but currently "a lot of information not answering a specific question." Recast both sections around the two personas:
- Buyer framing: what am I getting and what is it worth (EV, chase, floor, top contributors).
- Seller framing: what does each slot need to sell at to break even, and where am I net (Item 10).
- Slot color taps here route to the Item 8 drill-down.
- AC: every column/figure on the desk traces to one of those two questions; anything that doesn't is cut or moved to Advanced.

---

## P2 — Data and polish

### 13. Product catalog research script

Deliver the Item 6 dataset generator as a repeatable `tools/` script with a documented run command, so new sets can be appended after each release. Output committed to the repo.

### 14. Copy pass

After the redesign, re-verify all copy against DESIGN.md's writing rules and against the new cost model (the "≈11%" explainer text, the $1-floor text, and the box-cost tile copy are all now wrong).

---

## Explicitly delegated decisions

- Mode-switch mechanism (tabs vs. toggle vs. stacked sections) and overall layout architecture: implementer decides, judged against the hard constraints.
- "Unreliable sealed price" heuristic specifics: implementer decides and documents.
- Top-contributor count is fixed at 10 by owner ruling; not delegated.

## Out of scope

- No change to price sources (Scryfall, tcgcsv.com) or the CORS proxy approach.
- No build tooling; stays a single static HTML file.
