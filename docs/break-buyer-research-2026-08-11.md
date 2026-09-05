# Color break buyer research and feature proposals

Date: 2026-08-11
Scope: what the community says about MTG color breaks, and what that implies for ColorBreak v4 and beyond.

## Method and evidence quality

Two passes were run.

1. The `/last30days` research engine over the window 2026-07-12 to 2026-08-11. Only Reddit, Hacker News and GitHub were configured as live sources; X, YouTube, TikTok and Instagram were not. Reddit returned partial results and stopped at seven items on HTTP 429. Every cluster the engine surfaced was a name collision ("magic hexagons", "Magic Keyboard", a Hobbit set bulletin), so **the engine established no on-topic community evidence for this window**. That is a coverage failure, not proof the community is quiet.
2. Targeted web research over breaker documentation, platform policy, marketplace review corpora and hobby press.
3. A third pass specifically hunting MTG-specific first-person testimony. This recovered two MTG Salvation forum threads with genuine MTG buyer voice - "Box breaks on youtube?" (2008) and "MTG Live Box Break" (~2011) - plus the current published slot maps and prices of the MTGMoxBox storefront. Everything attributed below as `MTG-specific, primary` comes from these. Two fetched pages (an MTGMoxBox product page and an MTG Salvation thread footer) contained prompt-injection attempts; they were treated as data and ignored.

Reddit remains unreadable for this agent: `reddit.com` returns HTTP 400 through search-domain filtering and page fetches fail, and the research engine's Reddit source was separately rate-limited. Any statement about Reddit sentiment in this document would be fabrication, so there are none.

Evidence confidence is uneven and is labelled per finding below. The single largest gap: **almost no first-person MTG buyer testimony was retrievable.** Reddit page fetches are blocked for this agent and the engine's Reddit source was rate-limited. Most sentiment and complaint evidence is sports-card breaking, which MTG breaking borrowed wholesale. Where a finding rests on that borrowing, it is marked `adjacent-hobby`. Treat every `adjacent-hobby` item as a hypothesis to confirm before building expensive features on it.

By contrast, the mechanical findings (slot structures, house rules, platform policy, data availability) are drawn from primary documentation and are high confidence.

## Finding 1: what buyers say they like

- **Entry price into product they will not buy whole.** Collector Booster boxes run roughly $300 to $1,900 depending on set. A slot buys participation in that box for a fraction. This is the most-cited reason across every source. `adjacent-hobby, high confidence`
- **Community and parasocial attachment.** Media-psychology analysis of break streams puts belonging above economics: repeat attendance with the same host builds attachment, and hits are celebrated collectively. `adjacent-hobby`
- **The live reveal itself.** Buyers describe watching the rip as the product, with the cards as a bonus. `adjacent-hobby`
- **Access without a local game store.** The 2008 MTG Salvation thread proposing an MTG version of sports-card breaks argued exactly this. `MTG-specific, dated`
- **A themed pool you can actually play with, not just a lottery ticket.** This was `inferred` in the first pass and is now sourced. In the 2008 "Box breaks on youtube?" thread, tpr13 argues eight slots at $15 on a $120 box compares favourably to buying four boosters and yields a colour pool "you could actually build with". In the same thread SnoopDoggAtog describes his playgroup's offline equivalent: split the box by what each player actually plays, then rotisserie-draft the leftovers. Both are identity and playability motives, not EV motives. `MTG-specific, primary, dated`
- **But EV-driven bidding is present in the same threads.** In the ~2011 "MTG Live Box Break" thread, Sundodger reasons that with a $20-per-head pool a buyer can "save up for blue/black or pick up two cheaper colors get larger number cards". Motives are mixed, not uniform. `MTG-specific, primary, dated`
- **The skeptic position has been present since day one.** The ~2011 thread was locked over scam concerns, with Kijin calling it "spinning roulette wheel, but you don't actually get paid money if you win", and Shrubby saying "I'd have better chance playing Russian roulette". Magik321 makes the trust argument directly: a video does not prove the assignment was not fixed. Analysts writing today reach the same conclusion: any real profit likely accrues to the breaker.

Product implication: ColorBreak is not competing with the fun. It is competing with the moment of overpaying. The tool should assume the user has already decided to play and wants to not get fleeced, which is exactly the framing CONTEXT.md already uses.

## Finding 2: the most common questions about the format

Ordered by how consistently they appear across breaker FAQs, platform policy and buyer-guidance writing.

1. **How is my colour assigned?** Random wheel or `random.org` list randomizer, versus pick-your-colour where each colour is priced separately. Some breakers offer one courtesy re-spin.
2. **How many slots is this break, and which one am I in?** Not fixed. Documented structures include 8 slots (W, U, B, R, G, multicolour, colourless, lands), 7 slots (colourless awarded by die roll to one colour slot), and 6 slots (colourless and lands treated as box toppers). Slot counts are chosen per product to balance the lots.
3. **Where do artifacts, lands, multicolour and colourless cards go?** Pure house rule. Dedicated slot, rolled to a random slot, or folded into box-topper distribution.
4. **Who gets the box topper, promos, art cards and tokens?** Typically one slot chosen by `wheelofnames.com` or a die roll; art cards and tokens distributed randomly across slots.
5. **How are double-faced cards classified?** The published rule at the most explicit breaker is combined colour of both faces: red on both faces goes to Red, differing faces go to Multicolour. Note this diverges from ColorBreak's stated rule of front-face printed colour.
6. **Do commons, bulk and base cards actually ship, or only hits?** The single most-cited disclosure failure in the hobby.
7. **What does shipping cost and does it combine?** Whatnot buyers pay actual label cost; sellers may not mark up shipping. Smart Bundling combines same-buyer, same-seller wins, but only after show settlement and only before label generation.
8. **Is the randomization provably fair?** No public evidence located in this research establishes whether a platform exposes a seeded or independently auditable RNG. Whatnot bans randomizing machines and wheels in relevant contexts, while its Breaks documentation explicitly supports a deck of cards as a physical assignment method. Product visibility requirements make the stream part of the trust record, but do not by themselves prove randomness.
9. **What happens if the break does not fill, or if my colour whiffs?** Whatnot says sellers **should honor refund requests** for unsold spots; that is guidance, not the stronger claim that every request is automatically required. Formats where a buyer might receive nothing must still send at least one card per purchase.

Product implication: items 2, 3, 4 and 5 are all inputs to a correct EV calculation, and ColorBreak currently treats them as fixed. That is the biggest single modelling gap this research found.

## Finding 3: examples of well-regarded sellers

Confidence here is low to moderate. No community consensus thread was located; most reputation signal is platform-displayed metrics or affiliate review blogs.

- **blacktiebreaks** (Whatnot). Platform-displayed: 4.9 rating, 37.8K reviews, 121.3K followers, one-day average shipping, 228K items sold. Runs a recurring "MTG color breaks" show. MTG is a minority of a mostly sports catalogue.
- **MTGMoxBox** (own storefront, not livestream). The most explicitly documented colour-break ruleset found anywhere: published slot structures per product, `random.org` list randomization of winners against slots, `wheelofnames.com` for box toppers, a stated DFC rule, and shipping included in the lot price. This is the reference implementation of colour-break house rules for our purposes.
- **tggames**, **battlegroundsgames**, **clawsont93** (Whatnot). Active MTG colour-break streamers; no reputation metrics retrievable.
- **Supreme Card Shop** (eBay Live, 99.90% positive feedback), **Jon C's CCG Store**, **Fabricator's Forge**. Recurring MTG break and singles shows.
- Negative reputation in the category is real but was not traceable to any named MTG seller. The 2025 allegations naming Backyard Breaks and Platinum Card Breaks, and the 2025-2026 litigation and arbitration demands against Whatnot and Fanatics Live, are all sports-side. A structural critique measured sports break prices averaging about 40% above comparable comps.

Product implication: there is no trustworthy public breaker reputation feed to integrate. Do not build a seller rating feature on this evidence. Do build for the fact that buyers must judge trust themselves from show notes.

## Finding 4: the buyer wishlist

What buyers say they want to know before bidding, ranked by how often it appears. All `adjacent-hobby` unless noted.

1. **Whether the slot price beats buying the box or the singles outright.** "The break only makes sense if the math does. Spot prices aren't set as a favor. They're set for margin."
2. **Total visibility of the product.** "Only buy into a break where you can see everything. Group breaks have been manipulated. It's not hypothetical."
3. **Whether base and bulk actually ship.** "Some breakers won't ship paper base cards at all - no hit, no shipment. Neither gets announced upfront."
4. **The zero-return risk specific to the format.** In sports, a pick-your-player slot that whiffs pays nothing. The MTG analogue is a colour with no chase in it.
5. **Pull rates and a breaker's pattern of hits.**
6. **The real shipping cost, including whether multiple wins truly bundle.** "Ordering multiple items from one seller results in many shipping fees even when bundled."
7. **Whether the product was favourably allocated to the breaker.** Alleged in sports, denied by the manufacturer, no MTG equivalent found.

Recurring complaints, same evidence caveat: rigged-pull allegations; refund and support failure even with video proof; shipping damage from thin packaging; non-delivery and partial refunds; overspending (one profiled buyer at $244,000); waiting for breaks to fill.

## Finding 4b: slot maps, trap colours and how slots are actually priced

This is the newest and most directly actionable block of evidence, and it is primary throughout.

**Six distinct slot maps are documented on live seller product pages.** All from MTGMoxBox unless noted:

| Slots | Map | Example product |
| --- | --- | --- |
| 6 | W U B R G + Colourless | Core 2021 Draft box |
| 6 | W U B R G + Multicolour (colourless and lands routed to box toppers) | March of the Machine Collector |
| 6 | W U B R G + combined Multicolour/Colourless | MTGMoxBox break FAQ |
| 7 | W U B R G + Multicolour + Land | Kaldheim Collector |
| 7 | W U B R G + Multicolour + combined Colourless/Land | Foundations Play |
| 8 | W U B R G + Colourless + Multicolour + Land | Commander Legends Collector; Final Fantasy Collector (DA Card World, 8-spot) |

No plain five-slot WUBRG break was evidenced anywhere. Every published map adds at least one non-mono slot. ColorBreak's fixed eight is the maximal case, not the common case.

**Where a category has no slot, it is resolved by an unmodellable physical roll.** In the six-slot Core 2021 map, colourless cards are assigned by die roll, highest roll wins, ties re-rolled. Box toppers, art cards and tokens are separately randomised by `wheelofnames.com` or die roll, independent of card colour. A tool cannot predict these; it can only name them.

**Hybrid, devoid and differently-coloured double-faced cards are not addressed by any published seller rule.** This was checked across multiple MTGMoxBox product pages and the storefront FAQ, so it is an evidenced absence rather than a single-page gap. These are exactly the cards where ColorBreak's front-face rule and a breaker's unstated rule will silently disagree.

**Trap colours are an explicit, repeated, MTG-specific complaint.** Two independent threads, three years apart, name the same failure. In 2008, TJC/DevouringZombie: "nobody would knowingly pay $7.50 for artifacts or white." In ~2011, dan42183: it is "almost impossible to get somone to buy into innistrad red or white at $20," while "blue and black would be no brainers." Yanni declined to join at all, judging value concentrated in "Blue, Black, and Lands" and predicting that of six buyers the "first three get long end stick, while other three get screwed." The proposer Riodiamond expected the same spread: "Blue Black might go for close 30-40, where as white green may end up closer to 10 bucks."

**One documented storefront uses flat pricing; market dominance is unverified.** MTGMoxBox sells every slot in a given break at one price regardless of colour: $25.00 per slot on Foundations Play, $100.00 per slot on Commander Legends, $45 to $50 across all seven Kaldheim slots. Colour is assigned by `random.org` list randomiser after the sale. This is evidence of one seller's behavior, not proof that flat assignment dominates the market. Its published "skunk'd" discount is also incompatible with Whatnot's current rule against bonuses or guarantees tied to break outcomes, so ColorBreak must not present it as Whatnot-compliant.

**This inverts the buyer's core question in the dominant format.** Under flat pricing plus random assignment, "which colour is best" is unanswerable and irrelevant before the spin. The answerable question is whether the flat slot price is fair against the *average* slot, and how far the worst slot falls below it. That is a different headline number than ColorBreak currently leads with.

**Two MTG-specific EV tools already exist**: BreakBuddy (`breakbuddy.win`) and The Expected Value (`theexpectedvalue.com`), both computing per-colour-slot EV from Scryfall/TCGplayer prices and MTGJSON booster models. Confirmation that the audience exists; no buyer testimony was captured from either.

## Finding 4c: what platforms and breakers actually publish about disclosure

- **The all-cards-ship versus hits-only split is the disclosure fault line**, and hobby guidance says the policy should be stated in the listing, restated verbally at break start, and that "hit" must be defined precisely (auto, relic, any numbered, any insert, rookie) because an undefined "hit" is the most common source of disputes. A common hybrid is base cards added back for an extra shipping fee. Also expected in show notes: a minimum-card threshold for shipping, what happens to spots that pull nothing, handling times, and international shipping and customs terms. `adjacent-hobby, secondary`
- **Whatnot's binding rules, from its Card Breaks Policy, Randomizer FAQ and Breaks feature docs:** the full display of a break must stay onscreen from the sale of an item to the end of the break, including sealed and unsealed product, tools, hands dealing cards and the opening itself; removing packs, boxes or cards from stream visibility before the reveal is a violation, and this extends to personals and rip-and-ship. Randomisation may not be done by a physical machine (vending, gumball, pinball, raffle drum). Surprise Sets may not use randomiser wheels at all, physical or digital. Prizes in breaks are banned, including "Prize Picks"; so are golden tickets, any item that further randomises what you receive, cascading games, pull-game entries, and games of chance keyed to bid position. Sellers, their households, family and employees may not enter their own break. Unsold spots should be refunded on request; support can cancel and refund unfilled breaks. Breaks are only permitted in approved cards categories, and the show's primary selling format must be set to Breaks.
- **Whatnot's own randomiser is the assignment path of least resistance for sellers.** With auto-randomise on, the spot is assigned when the buyer wins the auction and the assignment attaches to the order and packing slip. With it off, the seller taps Randomize manually, or Assign Team if using a physical randomiser such as a deck of cards. Pick Your Team supports auctions or buy-it-nows; random breaks are auction-only.
- **Public auditability is unverified.** This research did not locate public seeded/auditable RNG documentation; absence of a located document is not proof that no implementation exists. The historical buyer objection remains useful as a trust hypothesis.

## Finding 5: what the data can and cannot support

This constrains every proposal below.

- **Scryfall has no collation data at all.** It gives exact-printing prices (`usd`, `usd_foil`, `usd_etched`, nullable, daily snapshots aggregated from TCGplayer), plus `colors`, `color_identity`, `finishes`, `promo_types`, `booster`. Etched prices may key off a different TCGplayer product id. Licensing forbids repackaging raw data.
- **MTGJSON is ColorBreak's current structured collation source**, via `BoosterConfig`: `boosters[]` with per-pack `contents` and `weight`, `boostersTotalWeight`, and `sheets{}` with per-card weights, `totalWeight`, `fixed`, `foil`, `allowDuplicates` and **`balanceColors`**. This does not establish that no other collation source exists.

## Validation ledger — 2026-08-11

The observations above remain leads. Claims integrated into product decisions were reclassified as follows.

| Claim | Source URL | Verified | Confidence / market scope | Disposition |
|---|---|---:|---|---|
| MTGMoxBox uses flat prices and published slot maps | Seller storefront pages observed during the research pass | 2026-08-11 | Moderate; one off-platform seller | Retain only as an example, never as a market norm |
| Unsold spots are refunded | [Whatnot Card Breaks Policy](https://help.whatnot.com/hc/en-us/articles/34107485220237-Card-Breaks-Policy) | 2026-08-11 | High; Whatnot US | Corrected to the policy's “should honor refund requests” wording |
| Physical assignment is banned | [Whatnot Breaks feature](https://help.whatnot.com/hc/en-us/articles/26596362677389-Breaks-feature-for-sellers) and [Card Breaks Policy](https://help.whatnot.com/hc/en-us/articles/34107485220237-Card-Breaks-Policy) | 2026-08-11 | High; Whatnot US | Corrected: machines/wheels are restricted; a deck of cards is documented as supported |
| No seeded or auditable RNG exists | No authoritative source located | 2026-08-11 | Low; cross-platform | Marked unverified; excluded from product truth |
| “Skunk'd”/whiff discount is compliant | [Whatnot Card Breaks Policy](https://help.whatnot.com/hc/en-us/articles/34107485220237-Card-Breaks-Policy) and [Gambling and Purchase-Based Prize Policy](https://help.whatnot.com/hc/en-us/articles/4410443596813-Gambling-and-Purchase-Based-Prize-Policy) | 2026-08-11 | High; Whatnot US | Retained only as a prohibited research scenario; export blocked |
| MTGJSON is the only collation source | [MTGJSON Booster model](https://mtgjson.com/data-models/booster/) | 2026-08-11 | High for ColorBreak implementation; not a market-wide exclusivity claim | Narrowed to ColorBreak's current structured source |
| Sports-break buyer sentiment transfers to MTG | Adjacent-hobby sources listed in the original research pass | 2026-08-11 | Hypothesis only | May guide interviews; cannot justify expensive features or MTG buyer-fact copy |
- **`balanceColors` says a sheet is colour balanced; it does not say how.** WotC has never published the algorithm or a target distribution.
- **No official per-box colour distribution exists.** Community box mapping is considered infeasible since roughly the Theros/Khans era after collation changes, and no current statistical study exists.
- Play Boosters (since Murders at Karlov Manor) are 14 cards plus a token: six commons, a seventh common slot with roughly 12.5% chance of being The List or a Special Guest, two wildcard slots of any rarity, one guaranteed traditional foil. Collector Booster structure varies per set and is only authoritatively described in WotC's per-set "Collecting" article.
- Serialized cards are Collector Booster only at under 1% per pack; some sets disclose exact counts, others only "<1%".
- Universes Beyond print runs are frequently never disclosed.
- Jumpstart and Commander products are not rarity-slot products at all.

This directly validates the existing rule in CLAUDE.md: never infer sheet weights or unresolved contents. **The honest output for per-colour card counts is a distribution with a named omission, not a point estimate.**

---

# Feature proposals

Each proposal states the problem, the evidence, the change, acceptance criteria, and the constraint it must not break. Ordered by expected value to the buyer per unit of effort.

## P1. Break shape configuration (slot map and house rules)

**Problem.** ColorBreak assumes eight fixed colour slots (W, U, B, R, G, M, C, L) and front-face printed colour classification. Real breaks run 8, 7 or 6 slots; colourless is sometimes die-rolled into a colour slot; lands are sometimes box-topper territory; and the most explicitly documented breaker classifies DFCs by combined colour of both faces, not front face.

**Evidence.** Finding 2 items 2, 3 and 5, and the six documented slot maps in Finding 4b. High confidence, primary sources: every map in that table comes from a live seller product page. Note also that no five-slot WUBRG break was found, and that where a category has no slot it is resolved by a die roll the tool cannot model.

**Change.** A break shape object in `src/domain/` that maps colour categories onto slots, with presets: `8-slot standard`, `7-slot colourless-rolled`, `6-slot toppers`, and `custom`. Add a DFC classification rule (`front-face` default, `combined-faces` alternative) and a lands rule. Selecting a shape re-partitions the same valuation output; it does not change any pricing.

**Acceptance.** Changing shape changes per-slot EV without refetching prices. Choosing a non-default DFC rule visibly relabels affected cards. The chosen shape is encoded in the `?b=` share link.

**Constraint.** Pure domain logic, no UI state in `src/domain/`. Shape choice must never silently alter confidence; if a shape assigns cards by a die roll the tool cannot model, that is a named omission, not an averaged guess.

**Effort.** Medium. This is the highest-leverage item because every downstream number is currently computed against a slot map that may not match the break being watched.

## P2. Random-assignment mode

**Problem.** The buyer bids before knowing their colour in a random break. ColorBreak asks the buyer to choose a slot, which only matches the pick-your-colour format.

**Evidence.** Finding 2 item 1. Whatnot's own break feature supports random breaks as auction-only. High confidence.

**Change.** A mode toggle on the buyer path: `I pick my colour` versus `colour assigned at random`. In random mode the verdict is computed against the distribution across unassigned slots, showing the mean, the best slot and the worst slot, with the verdict driven by the worst-case slot rather than the mean.

**Acceptance.** Random mode never presents a single EV number without its spread. The verdict resolves against the worst slot, so a bid that is `+EV` on the best colour and `-EV` on the worst reports `-EV`, not `FAIR`. Incomplete data still yields `NO VERDICT`.

**Constraint.** Do not add a probability-of-profit simulation. SPEC.md lists that as an explicit v4 non-goal. This is arithmetic over the slot set, not a Monte Carlo.

**Effort.** Small to medium, once P1 exists.

## P3. Whiff floor per colour

**Problem.** The named zero-return fear in this format is drawing a colour with no chase card in it. ColorBreak already computes chase share and value without chase, but as disclosure rather than as the headline risk.

**Evidence.** Finding 4 item 4. Finding 1's skeptic position.

**Change.** Promote a per-slot **whiff floor**: the Sellable EV of that colour with its chase contributors removed, presented beside the slot's headline EV. In random mode, show the worst whiff floor across all slots.

**Acceptance.** Every slot shows both its EV and its whiff floor before any progressive disclosure is opened. A slot whose EV is more than some large multiple of its whiff floor is visibly flagged as chase-dependent.

**Constraint.** Slot meaning cannot rely on colour alone; the flag needs a label and an icon, not a red border.

**Effort.** Small. The underlying numbers already exist.

## P4. Bid ceiling card, precomputed for the live moment

**Problem.** Whatnot auctions frequently resolve in under thirty seconds, with sudden-death timers on some shows. A ten-second decision loop is still a decision loop happening under adrenaline. The measured outcome in the adjacent hobby is buyers paying roughly 40% above comps.

**Evidence.** Finding 2 item 7, Finding 3's structural critique, Finding 4's complaint set. High confidence on mechanics, adjacent-hobby on the overpay figure.

**Change.** Before the show, the buyer sets a target margin and the tool emits a **ceiling card**: one large number per colour slot, the maximum landed bid that still clears the margin, in a layout readable at arm's length on a phone in a dark room. During the show the buyer is comparing one number to the auction, not reading a report.

**Acceptance.** Reachable in one tap from the buyer result. Legible at 320 CSS pixels. Works with the screen locked to the ceiling view. Suppressed entirely when confidence is `incomplete`, consistent with the no-verdict rule.

**Constraint.** The ceiling is a target, not a prediction. It must not be phrased as expected profit, per the rule against calculating actual profit from target asks.

**Effort.** Small to medium. Mostly presentation over existing math.

## P5. Incremental shipping that understands bundling

**Problem.** The domain already separates transaction from shipment and models incremental shipping, which is correct and unusually rigorous. What buyers actually get wrong live is the second and third slot: Whatnot's Smart Bundling combines same-buyer, same-seller wins after show settlement, so the marginal shipping on an additional slot in the same show is often near zero, while a second show is a second shipment.

**Evidence.** Finding 2 item 7, Finding 4 item 6. Primary platform documentation, plus a buyer complaint that bundling does not always deliver.

**Change.** Let the buyer mark "this is an additional win in the same show". Incremental shipping then defaults to the marginal cost within an existing shipment rather than a fresh one, with the bundling caveat stated inline.

**Acceptance.** The shipping line names which shipment it belongs to. Buyer shipping never appears anywhere as seller revenue.

**Effort.** Small.

## P6. Show-notes checklist and house-rule capture

**Problem.** Every disclosure failure in Finding 4 is a show-notes failure. Whatnot requires rules be posted in show notes; buyers do not read them under time pressure, and the rules materially change what the buyer receives.

**Evidence.** Findings 2 and 4 throughout. High confidence on the requirement, adjacent-hobby on the complaint frequency.

**Change.** A short pre-break checklist on the buyer path, each item wired to a modelling consequence rather than being advice:
- Slot count and colour map, which sets P1.
- Where colourless, lands, multicolour and toppers go, which sets P1.
- Whether base and bulk ship, which sets the sellable threshold.
- Whether shipping is included in the slot price, which sets P5.
- Random or pick, which sets P2.

**Acceptance.** Skipping the checklist is allowed and does not block the fast path, but unanswered items that change the result appear as named omissions and lower confidence.

**Constraint.** This must not become a form wall in front of the ten-second path. It belongs behind progressive disclosure with sensible defaults.

**Effort.** Medium.

## P7. Only-hits-ship modelling

**Problem.** The most-cited complaint in the hobby is a breaker who ships only hits and donates or discards the rest, undisclosed. A buyer under that rule receives materially less than the colour's Market EV, and ColorBreak would currently overstate what they get.

**Evidence.** Finding 2 item 6, Finding 4 item 3. Direct, quoted, `adjacent-hobby` but structurally identical in MTG where bulk commons dominate card counts.

**Change.** A fulfilment rule on the break: `everything ships`, `at or above threshold ships`, `hits only`. Under `hits only` the buyer's realisable value is computed strictly from cards that meet the rule, and the discarded remainder is displayed as an explicit forfeited-value line rather than being quietly dropped.

**Acceptance.** The forfeited remainder is always shown, never silently omitted. Sellable EV under this rule is never higher than under `everything ships`.

**Effort.** Small, given the sellable threshold already exists.

## P8. Price freshness and release-window volatility

**Problem.** Prices are cached six hours, which is right. What the research adds is that break EV is most wrong exactly when breaks are most popular: release weekend. Prices peak in the first three days, crash over weeks one to four, and stabilise months two to six. A Final Fantasy Collector Booster box went from about $1,100 to about $1,900 in weeks.

**Evidence.** Finding 5, plus set-level EV reporting. Moderate to high confidence.

**Change.** Show price age beside the EV, and when the set's release date is inside the volatility window, attach a named qualifier to the confidence state explaining that today's market price is a poor predictor of realisable value.

**Acceptance.** The qualifier is a distinct, named condition, not a generic disclaimer, and it sits beside the number it qualifies per the experience laws.

**Constraint.** It qualifies the number; it does not suppress the verdict. Suppression is reserved for incomplete data.

**Effort.** Small.

## P9. Colour-balance omission, stated honestly

**Problem.** A colour-break tool's most natural feature is "how many Blue cards will be in this box". That number does not exist. MTGJSON's `balanceColors` flag tells us a sheet is balanced without telling us how, and no official or credible community distribution has ever been published.

**Evidence.** Finding 5. Primary documentation, high confidence.

**Change.** Where a sheet carries `balanceColors`, surface a named omission stating that per-colour counts on that sheet are not derivable, and treat the slot's card count as a range rather than a point value. Where a sheet does not carry the flag, per-card weights are usable directly and confidence stays higher.

**Superseded (2026-09).** The omission told the buyer about a gap they could do nothing about, while the simulator drew the sheet as if unbalanced — which understates every mono colour's floor, because a modelled opening could miss a colour that a real pack cannot. Sampling now applies the one guarantee the flag does carry: the sheet spends its first five picks on one card of each mono colour, and draws the remainder by its own printed weights. No stronger per-colour distribution is claimed, and nothing is excluded — colourless and land commons still come through the free picks. The omission now fires only when the resolved sheet has lost a whole colour and the guarantee therefore cannot be honoured.

**Acceptance.** No code path infers a colour split from an unbalanced-unknown sheet. The omission is named specifically enough for a reviewer to act on.

**Constraint.** This is the CLAUDE.md rule applied literally: never silently infer sheet weights, emit a named omission and lower confidence.

**Effort.** Medium, and it touches the collation builder contracts in `tools/`. Builder failures must stay loud.

## P10. Break preset sharing for breakers

**Problem.** The house rules that drive P1, P6 and P7 live in a seller's head and their show notes. Buyers re-enter them, badly, under time pressure.

**Evidence.** Finding 3: MTGMoxBox publishes a stable per-product ruleset. Finding 2: rules are required to be in show notes.

**Change.** Extend the existing `?b=` share link so a breaker can publish a link that encodes product lines, slot map, house rules and fulfilment rule. Buyers open it and land on a correctly configured break.

**Acceptance.** Links stay human-readable per the existing platform requirement. No accounts, no backend, consistent with the v4 non-goals.

**Effort.** Small to medium, mostly serialisation.

## P11. Spend-session honesty

**Problem.** This category is under active legal challenge as gambling-adjacent, with arbitration demands and litigation against the largest platform in 2025 and 2026. A tool that helps people bid faster in that category has an obligation not to be a hype amplifier.

**Evidence.** Finding 1's psychology sourcing, Finding 4's overspending complaints, Finding 3's litigation note. Moderate confidence, all `adjacent-hobby`.

**Change.** An optional session budget on the buyer path that accumulates landed bids across a show and states plainly when the running total has passed it. Plus a language audit: the tool never says a slot is profitable, only whether a bid clears a threshold under stated assumptions.

**Acceptance.** Opt-in, never nagging, never blocking. No streaks, no celebration animations, nothing that rewards continued bidding.

**Constraint.** Reduced-motion behaviour and keyboard operation apply here as everywhere.

**Effort.** Small.

## P12. Baseline comparisons

**Problem.** The number one thing buyers say they want is whether the slot beats the alternatives, and the alternatives are named: buy the box yourself, or buy the singles.

**Evidence.** Finding 4 item 1. Direct quote, `adjacent-hobby`.

**Change.** Beside the slot verdict, show two reference points: the slot's share of current sealed product market cost (tcgcsv already supplies this on the seller path), and the cost of simply buying the colour's top contributors as singles at exact-printing prices.

**Acceptance.** Both baselines are labelled as reference points, not verdicts, and both suppress when their inputs are unavailable rather than falling back to an estimate.

**Constraint.** The singles baseline is only honest for the resolved, priced subset. It must inherit the same omissions as the EV it sits beside.

**Effort.** Medium.

## P13. Fair-price-for-a-flat-slot, the question the dominant format actually asks

**Problem.** ColorBreak leads with "is this bid good for *this* colour". The documented modern MTG break sells every colour at one flat price and assigns the colour randomly after the sale. In that format the buyer cannot choose a colour, so per-colour EV is not the decision input. The decision input is whether one flat price is fair against the slot set as a whole, and how badly the worst slot loses.

**Evidence.** Finding 4b. Primary: MTGMoxBox flat pricing at $25, $45-50 and $100 per slot across three products, with `random.org` assignment after sale. Also Finding 4b's trap-colour quotes, which show the same money buying visibly unequal lots.

**Change.** When random assignment is active (P2), the headline becomes a **fair flat price**: total break Sellable EV divided by slot count, presented next to the actual asking price, with the spread from best to worst slot shown as the risk, and the worst slot's whiff floor (P3) as the floor. Per-colour EV drops to progressive disclosure, where it belongs in this format.

**Acceptance.** In random mode, no per-colour EV appears above the fold. The fair flat price and the worst-slot outcome are always shown together; neither can render alone. The verdict continues to resolve against the worst slot per P2.

**Constraint.** The fair flat price is an average over the tool's resolved value only. It inherits every omission of the underlying valuation and suppresses to `NO VERDICT` on `incomplete` exactly as the per-slot verdict does.

**Effort.** Small once P1 and P2 exist. It is arithmetic over the existing slot set plus a layout change.

---

## Implementation anchors

Current code positions for each proposal, so the next pass does not re-derive them. Verified 2026-08-11.

| Proposal | Anchor | Note |
| --- | --- | --- |
| P1 slot map | `src/domain/types.ts:1` `SLOT_IDS = ["W","U","B","R","G","M","C","L"]` | The eight slots are a frozen const tuple. A break-shape object has to sit above this, not replace it, or `SlotId` typing breaks everywhere. |
| P1, P9 omissions | `src/domain/types.ts:45` `Omission { code, message, expectedCards?, material, source? }` | Already carries `material`, which is the lever for lowering confidence. No new type needed. |
| P2, P3, P13 verdict | `src/domain/valuation.ts:127` `Verdict`, and `buyerVerdict` at L130-133 | `incomplete` returns `NO VERDICT` at L130; deadband is `Math.max(1, landedCost * 0.08)` at L132. Worst-slot resolution changes the *input* to this function, not the function. Note the verdict string uses U+2212 minus, not a hyphen. |
| P2, P13 confidence | `src/domain/valuation.ts:16` `STATUS_RANK` (verified 0, estimated 1, incomplete 2), `worstStatus` at L18 | There is no separate confidence type; status plus `Omission.material` is the confidence model. |
| P3 whiff floor | `src/domain/valuation.ts:23` threshold defaulting to 2, applied at L63 | Chase-excluded value is a second pass over the same contributor list. |
| P4 ceiling card | `src/data/evaluate.ts:32` `evaluateBreak(lines, threshold)` calling `calculateBreak` at `src/domain/valuation.ts:22` | Ceiling is an inversion of the verdict inequality; it needs no new data path. |
| P5 shipping | `src/domain/types.ts:89` `Transaction`, `:96` `Shipment`; math in `src/domain/marketplace.ts:19` `calculateProfit` | Shipment count is derived in `src/App.tsx:1097` and the per-shipment cost array is built at L1123-1128. Bundling changes the shipment count, so the change is at the App layer, not the domain. |
| P5 fees | `src/domain/marketplace.ts:3` `WHATNOT_US` (`commissionRate 0.08`, `processingRate 0.029`, `processingFlat 0.3`, `policyDate "2026-07-13"`) | `transactionNet` L12-17 already applies processing to hammer plus buyer shipping plus tax, which matches Whatnot's published behaviour. |
| P7 fulfilment rule | `src/domain/valuation.ts:23` and `:63`, the sellable threshold | `hits only` is a stricter threshold plus a forfeited-value line, not new machinery. |
| P8 price freshness | `src/data/scryfall.ts:66` `loadCardPrices`, cache key `colorbreak:prices:${code}` at L69, TTL inline `6 * 60 * 60 * 1000` at L73; same inline TTL at `src/data/sealedPrices.ts:30` | The TTL is a duplicated literal in two files with no named constant. Surfacing price age means naming it first. |
| P9 collation | `data/sealed/` holds 44 per-set files plus `index.json`; slot mapping is a single shared `tools/slot-map.json`, not per-set | There is no per-set slot map anywhere, so P1's shape presets are new data, not an extension of existing per-set files. Contracts in `tools/README.md:38-47,68-72`. |
| P10 share links | `src/domain/legacy.ts:35` `encodeComposition` (`${set}.${productKey}.${quantity}` joined by `~`), `:9` `decodeComposition`, `:25` `decodeLegacySearch` reading `b`, `set`, `preset` | House rules must extend the encoding without breaking the three legacy params, per SPEC.md platform rule 5. |
| P12 baselines | `src/data/sealedPrices.ts:47` `loadSealedMarketPrice(set, productId)`; catalog at `src/data/catalog.ts:15` | The sealed market price the seller path already fetches is the box baseline. |

---

## Suggested sequencing

| Phase | Items | Rationale |
| --- | --- | --- |
| 1 | P1, P3, P5 | Correctness of the core model against real break structures, plus the risk number buyers most need. |
| 2 | P2, P13, P4, P7 | The live-moment path: random assignment and the fair flat price it implies, a ceiling to bid against, and what actually ships. |
| 3 | P6, P8, P9 | Honesty layer: capture the rules, qualify the prices, name the collation limits. |
| 4 | P10, P11, P12 | Distribution, restraint, and context. |

P1, P2 and P13 are one coherent piece of work and should be planned together. P1 makes the slot set configurable, P2 makes assignment random, and P13 changes what number leads once it is. Shipping either P2 or P13 without P1 produces averages over a slot set that may not match the break on screen.

## Explicitly not proposed

- **Breaker reputation scores or a seller directory.** No trustworthy public feed exists; the reputation evidence found was platform vanity metrics and affiliate blogs.
- **Pull-rate probability simulation.** SPEC.md names probability-of-profit simulation as a v4 non-goal, and Finding 5 shows the underlying collation data would not support it honestly anyway.
- **Cash-out haircut modelling.** Also a stated v4 non-goal. Worth revisiting after v4, because the gap between TCGplayer market price and what a buyer actually realises is the single largest unmodelled error in every break EV claim in this hobby.
- **Anything that scrapes or republishes Scryfall bulk pricing.** Their licensing forbids repackaging raw data.

## Open questions for the next research pass

1. MTG-specific buyer testimony remains unretrieved. A pass with working Reddit access over r/mtgfinance, r/magicTCG and r/whatnotapp would either confirm or refute the `adjacent-hobby` items, particularly the overpay magnitude and the bulk-shipping complaint.
2. Actual slot pricing distributions for MTG colour breaks were not captured. Flat per-slot prices are now documented ($25, $45-50, $100 on three MTGMoxBox products) but not the ratio of total slot revenue to box market cost, which is what P12 needs to state a norm rather than only a comparison. Live Whatnot auction closing prices would settle it and were not retrievable.
3. Partly answered. Identity and playability motives are now sourced (Finding 1, tpr13 and SnoopDoggAtog) but so is EV-driven bidding (Sundodger), from the same two threads. The evidence is that motives are mixed, and it is all 2008-2011. Whether the mix has shifted since flat-price random assignment became the norm is unknown.
4. New, and now the sharpest gap: does the flat-price random-assignment model or the pick-your-colour model dominate MTG breaks on Whatnot today? The evidence for flat pricing is a storefront, not a livestream, and Whatnot supports both Pick Your Team and random. P13 assumes random-with-flat-price dominates; if pick-your-colour dominates instead, per-colour EV should stay the headline and P13 drops to a mode rather than a default.
5. No published seller rule anywhere covers hybrid, devoid, or differently-coloured double-faced cards. Since ColorBreak classifies by front-face printed colour and at least one breaker classifies DFCs by combined faces, these cards are a guaranteed silent disagreement. Asking two or three active breakers directly would resolve it faster than more searching.
