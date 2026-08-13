# V2 antagonistic review, round 1 — buyers, competitive players, and collectors

Date: 2026-08-13
Reviewed artifact: [ColorBreak V2 product specification — review draft 1](../PRODUCT-SPEC-v1.md)
Evidence base: [ColorBreak V2 primary research dossier](../../research/colorbreak-v2-primary-research-2026-08-13.md)

## Review method

This is an attempt to falsify the proposed product, not to improve its prose. Each perspective asks whether the specification would produce a trustworthy decision in a concrete failure case. A finding is:

- **Critical** when it can cause a user to bid or spend under false authority, calculate the wrong object, or make the promised task impossible in the live context.
- **Major** when it creates recurring misunderstanding, avoidable delay, or a substantial utility gap without necessarily reversing every decision.
- **Minor** when it weakens comprehension or trust but has a contained workaround.

Dispositions mean:

- **Act** — change the next specification; the product is not defensible without it.
- **Defer** — preserve an explicit seam, but do not put the capability on the V2 testable critical path.
- **Dismiss** — reject the proposed expectation or solution because it is unsupported, unsafe, or disproportionate.

The review uses the documentary evidence already gathered. Where a criticism is an inference rather than an established external fact, it is labeled as such. The largest unresolved questions still require direct observation of active buyers; the dossier correctly states that documents cannot establish buyers' actual decision sequence, private utility, or the universally best risk display.

## Executive verdict

Draft 1 is directionally better than V1, but its buyer promise still outruns its decision model. It says “know your ceiling” while leaving the ceiling's utility rule deliberately undefined. It also treats “prepared buyer can read a result quickly” as equivalent to “buyer can act safely within a live auction,” even though a one-phone buyer must switch contexts, transcribe or copy a number, recover Whatnot's current auction, and submit a binding bid. Those are different measurements.

The draft also names competitive players and collectors as buyer motives without designing their actual value functions. A player does not maximize the summed resale value of a color slot; they may value a particular number of playable copies and receive no incremental utility from the fifth copy. A collector may value one exact treatment that completes a set while assigning nearly no value to duplicates. A single scalar “personal premium” cannot represent either case, and silently applying generic market EV is actively misleading.

The next revision should narrow the release-A buyer claim to a financial, modeled-card-value cap; make the cap formula and every cost assumption explicit; prioritize prepare/pre-bid over frantic live calculation; reduce the live result to one cap, one comparison, one reason, and one evidence state; and introduce a small, explicit wanted-card override rather than pretending to model competitive or collector utility automatically. Deck-list optimization, collection inventory, and the Chase Map should not block V2's testable release.

### Highest-priority cross-perspective decisions

| Priority | Decision | Disposition |
|---|---|---|
| 1 | Replace the undefined “Balanced blend” with a versioned, worked, testable decision rule. Call the output a **modeled financial cap**, not an objectively correct bid. | **Act** |
| 2 | Measure the whole one-phone task from seeing the live auction state through returning to Whatnot and submitting Max Bid; make preparation/pre-bid the primary safe path. | **Act** |
| 3 | Treat current hammer as a comparison to a stable cap, not an input that can change value or trigger an authoritative green “Bid” instruction. | **Act** |
| 4 | Add explicit all-in assumptions and arithmetic for incremental shipping, tax, realization costs, and bid increment/proxy behavior. | **Act** |
| 5 | Cut the first viewport to a cap, amount under/over cap, all-in now, one reason, and evidence state. Move the three-point range behind one tap in Live. | **Act** |
| 6 | Support an optional wanted-card list with user-entered personal values and duplicate/copy limits; keep it visibly separate from market value. | **Act, narrow form** |
| 7 | Do not claim automatic competitive-player or collector recommendations from color EV. Do not invent premiums from rarity, treatment, format, or “playability.” | **Dismiss** |
| 8 | Keep deck/collection imports, format/metagame scoring, and full inventory-aware utility outside the V2 testable gate. | **Defer** |
| 9 | Make the exact printing/finish and missing-price state first-class; a rare unpriced treatment must not quietly become a zero-dollar outcome. | **Act** |
| 10 | Make a ranked, filterable exact-printing list the collector/player exploration surface; delay Chase Map until it proves incremental task value. | **Defer Chase Map** |

---

## Perspective 1 — time-pressured Whatnot color-break buyer

### Persona and attack scenario

The reviewer is watching a Whatnot auction on the same phone, has at most one hand free, and may have five to ten seconds before a Sudden Death close. They know the set and perhaps the remaining colors, but seller routing and bulk rules may be buried in show notes or spoken on stream. They are not trying to learn probability theory. Their goal is to avoid a binding overbid while still acting quickly.

Whatnot supports a Max Bid that bids incrementally to a ceiling and explicitly warns that short auctions move fast. A winning bid is binding, with shipping and tax added to hammer. In standard auctions a late bid may reset the timer, while Sudden Death does not extend. These mechanics make a precomputed cap useful, but make manual cross-app live updates especially error-prone. ([Whatnot bidding](https://help.whatnot.com/hc/en-us/articles/14932924544141-Bid-on-an-item-during-a-show), [Whatnot pre-bidding](https://help.whatnot.com/hc/en-us/articles/14933026908301-Pre-bid-on-an-item-before-a-show), [Whatnot auction setup](https://help.whatnot.com/hc/en-us/articles/9779931101837-Start-an-auction-during-your-show))

### B1 — The bid ceiling is an undefined preference disguised as a fact

**Severity: Critical · Disposition: Act**

Draft 1 says Balanced uses “a documented blend of typical outcome and expected value” but does not define the blend, the buyer's loss function, the realization haircut's application, or the condition under which that blend is rational. Any weighted blend can produce a plausible-looking number. In a chase-heavy slot with a $4 median, $18 mean, and $120 P90, different arbitrary blends can move the cap by several auction increments while all carrying the same reassuring label.

Concrete failure: a buyer selects Balanced because it sounds neutral. ColorBreak says the maximum hammer is $15. The app has effectively chosen the buyer's tolerance for an outcome below cost, even though the buyer never did. “Bid” then converts an undocumented normative choice into an imperative.

Expected value alone is not a sufficient preference rule; choices under risk depend on outcomes relative to a reference point, and auction participants can suffer winner's-curse behavior. That evidence does not establish a replacement universal formula—it demonstrates why the product must not smuggle one in. ([Kahneman and Tversky, 1979](https://www.jstor.org/stable/1914185), [Charness and Levin, 2009](https://doi.org/10.1257/mic.1.1.207))

Required revision:

1. Specify one versioned formula for each stance, including tax, shipping, realization, personal values, and rounding.
2. Provide worked fixtures with skewed distributions, zero median, missing prices, and a cost exactly on the boundary.
3. Name the output **modeled financial cap under [rule]**, not “your value” or “the right bid.”
4. Show the controlling fact beside it: for example, “Cap uses the median; 50% of modeled openings are lower.”
5. Never increase a saved user cap when defaults, price refreshes, or algorithm versions change without affirmative confirmation.

### B2 — The success metric measures reading, not completing the auction task

**Severity: Critical · Disposition: Act**

The three-second median gate starts too late. It measures whether a prepared buyer can identify a recommendation and cap after ColorBreak is already visible. The real same-phone sequence is: perceive the current Whatnot price and assignment state, leave the stream, restore the correct ColorBreak plan, update taken colors if necessary, read/copy the cap, return to the correct live auction, open Max Bid, enter the amount, and submit. The draft has no end-to-end gate for that chain and no recovery case when Safari discards or refreshes a tab.

Concrete failure: the recommendation is legible in two seconds, but app switching and state recovery take six. The buyer returns after Sudden Death closes, or rushes and enters the cap into the wrong spot. The product passes its stated study while failing its actual job.

Time-pressure research supports minimizing interpretation and making a ceiling salient before the competitive moment, not assuming that another live surface can be operated safely inside the countdown. Recommendation-first interfaces can also speed choices while increasing automation overreliance. ([El Haji et al., 2019](https://doi.org/10.1016/j.socec.2018.12.001), [Adam et al., 2015](https://doi.org/10.1016/j.jretai.2015.01.003), [Swaroop et al., 2024](https://doi.org/10.1145/3640543.3645206))

Required revision:

- Make **Prepare + Whatnot Max Bid/pre-bid** the primary safe workflow. Live Check is a fallback comparison surface, not the product's normative path.
- Add a one-phone physical-device gate from visible auction state to submitted test bid, including app switching, keyboard, Safari tab restoration, and Sudden Death. Record wrong-auction/wrong-spot errors, not only elapsed time.
- Persist a compact “last plan” locally and make it recoverable in one tap without a mode chooser.
- Provide a copy-cap action with immediate confirmation and the exact number in the accessible label. Do not imply automatic transfer or integration.

### B3 — A manually entered current hammer creates a stale, chasing recommendation

**Severity: Critical · Disposition: Act**

The spot's modeled value is independent of current hammer. Yet the proposed Live flow asks the buyer to repeatedly enter current hammer and renders Bid/Pass from that transient value. By the time a user switches back to Whatnot, the hammer may already be higher. The bright action word invites them to follow a stale instruction rather than obey a stable precommitted cap.

Concrete failure: ColorBreak says “Bid” at $18 all-in against a $23 cap. While the buyer returns to Whatnot, proxy bids push the hammer to $24. Under auction arousal they remember only green/Bid, swipe once, and overpay. The system did not technically change the cap, but its action language caused the cap to be forgotten.

Required revision:

- Treat hammer as optional comparison data. The primary number remains the stable cap.
- Replace `Bid`/`Pass` in Live with `Under your modeled cap by $X`, `At your cap`, or `Over your cap by $X`. Use “Do not exceed $Y hammer” as the action.
- Timestamp the manually entered hammer as “you entered $18 moments ago”; never present it as live platform state.
- Test that price movement cannot alter the cap and that the UI never suggests chasing above it.

### B4 — “Max next bid” conflates a platform ceiling with the next increment

**Severity: Major · Disposition: Act**

Whatnot supports both a swipe at the next increment and a custom Max Bid that acts as a ceiling. “Max next bid” can reasonably mean either “the next increment I should submit” or “the highest proxy ceiling I should enter.” That ambiguity is unacceptable under time pressure.

Concrete failure: the next shown increment is $17 and the modeled cap is $24. The buyer interprets “Max next bid $24” as advice to make a $24 direct bid rather than set a proxy ceiling, or interprets $24 as additional spend above current hammer.

Required revision: use **Maximum hammer: $24** and a secondary **Enter $24 in Whatnot Max Bid**. If Whatnot's interface or region lacks Max Bid, say **Do not bid above $24**. Do not use “additional bid” unless it truly denotes an amount added to hammer.

### B5 — The all-in arithmetic is under-specified at precisely the point that reverses verdicts

**Severity: Critical · Disposition: Act**

The spec mentions incremental shipping and “modeled tax treatment” but never defines defaults, rounding, combined-shipment effects, or whether tax applies to shipping in the relevant jurisdiction. The buyer may not know incremental shipping before purchase. A realization haircut also does not capture selling fees, outbound postage, condition loss, or the fact that low-value cards are not economical to list individually.

Concrete failure: a $20 hammer is under a $23 value cap. The app assumes $0 incremental shipping because another order exists and excludes tax; Whatnot charges $4.10 incremental shipping and applicable tax. The result crosses the cap, but the UI's one-word recommendation appears definitive.

Whatnot states shipping and taxes are additional to hammer; TCGplayer states Market Price is derived from completed transactions, not the amount this buyer can realize after selling effort and costs. ([Whatnot bidding](https://help.whatnot.com/hc/en-us/articles/14932924544141-Bid-on-an-item-during-a-show), [TCGplayer Market Price](https://help.tcgplayer.com/hc/en-us/articles/213588017-TCGplayer-Market-Price), [TCGplayer price definitions](https://help.tcgplayer.com/hc/en-us/articles/222376867-What-do-the-different-price-points-on-TCGplayer-com-mean))

Required revision:

- Define a visible equation: `maximum hammer = value under selected rule − incremental shipping − modeled tax − buyer realization costs`.
- Never silently default unknown shipping or tax to zero. Offer a clearly labeled conservative placeholder, exclude the verdict, or require confirmation.
- Separate “keep/use value” from “resale realization.” A generic realization percentage must remain visibly user-authored.
- Preserve every entered cost when assignment, bulk, risk, or product settings change.

### B6 — The first viewport contract recreates information overload

**Severity: Major · Disposition: Act**

The 440 × 956 contract demands selected pool, bid, shipping, recommendation, maximum bid, all-in, three quantiles on one scale, one reason, evidence state/age, and color/taken controls. With 44-point controls, 16-pixel body text, Safari chrome, safe areas, and the keyboard, this is not one comprehensible viewport; it is a compressed dashboard. At 200% text it is physically incompatible with the same one-screen claim.

Concrete failure: the cap and “over by $3” are above the fold, but the evidence warning that invalidates them is pushed below. Alternatively all items fit only through tiny labels and dense boxes—the exact V1 failure the reset is meant to solve.

Apple emphasizes readable text, 44-point controls, and fitting content without horizontal scrolling; WCAG requires reflow and unobscured focus. ([Apple design tips](https://developer.apple.com/design/tips/), [WCAG 2.2](https://www.w3.org/TR/WCAG22/), [W3C reflow guidance](https://www.w3.org/WAI/WCAG22/Understanding/reflow))

Required revision:

- In Live, show only exact slot/pool, maximum hammer, amount under/over cap, all-in now, one reason, evidence state, and the immediate taken/undo control.
- Put downside/typical/upside behind one clearly labeled expansion unless user testing proves it improves the live decision without delay.
- Treat keyboard-open and 200%-text layouts as separate usable states, not as states that must preserve a mythical full first viewport.

### B7 — Four recommendation states are not mutually exclusive or operationally distinct

**Severity: Major · Disposition: Act**

“Conditional” is defined as defensible under Chase upside or personal value, but every bid is conditional on a risk rule and assumptions. “Bid” can still have a large loss probability. “Pass” can still be rational for a collector who has high private value. The labels mix model comparison, personal preference, and evidence sufficiency.

Concrete failure: two buyers with identical inputs choose Balanced and Chase upside. One sees Bid, one sees Conditional, even though both are simply under their separately chosen caps. The second label sounds like lower evidence confidence, which is supposed to be a separate dimension.

Required revision: use a three-state financial comparison (`under cap`, `at cap`, `over cap`) plus a separate evidence state (`ready`, `caution`, `no modeled cap`). Express preference directly in the cap label. **Dismiss** a universal green “good deal” verdict; the dossier already rejects it.

### B8 — “No verdict” is correct but the materiality rule is absent

**Severity: Major · Disposition: Act**

The spec says material omissions suppress recommendations, but does not define materiality. A missing $0.25 common price is not equivalent to an unknown land-routing rule or an unpriced serialized treatment. Without deterministic thresholds, implementation teams will either suppress nearly everything or wave through high-impact gaps.

Concrete failure: one color's mean is driven by a special treatment with no current market price. The engine preserves its probability at $0, labels evidence “Caution,” and still recommends a cap. A collector sees a conservative floor; a financial buyer sees an arbitrary understatement. Conversely, one missing bulk common blocks a decision that is otherwise stable.

Required revision:

- Define materiality by whether plausible bounds on the missing fact can change the cap comparison or selected stance's quantile.
- When bounds straddle the decision, emit no modeled cap and name the exact missing fact.
- When they do not, show the robust cap and the bounded uncertainty.
- Add invariant tests for missing price, unknown routing, unresolved product slot, and stale price cases.

### B9 — Saved plans can become confidently wrong without identity and drift controls

**Severity: Major · Disposition: Act**

“Recent local breaks” and seller links save time, but the draft does not require a show/seller identity, immutable composition version, or a visible diff when the seller changes rules. Product names are often similar, and the dossier specifically warns that product structures vary by set.

Concrete failure: the buyer restores yesterday's “FDN box” plan for today's show, but one was a Play Booster Box and one is a Bundle, or today's seller routes multicolor cards differently. The restore is fast enough to pass the speed gate and wrong enough to reverse the selected color.

Wizards documents that set/product collation differs and publishes set-specific collecting guides; seller rules are mandatory parts of a Whatnot break. ([Wizards on Play Boosters](https://magic.wizards.com/en/news/making-magic/what-are-play-boosters), [Whatnot Card Breaks Policy](https://help.whatnot.com/hc/en-us/articles/34107485220237-Card-Breaks-Policy))

Required revision: show source seller/show label, exact sealed SKU, plan creation time, evidence refresh time, and a human-readable diff for any changed product/routing/bulk rule. A shared link opens a new local fork; it must not silently overwrite the buyer's saved plan.

### B10 — The study gate can reward blind compliance

**Severity: Major · Disposition: Act**

The draft asks participants to identify the reason and one condition that changes the recommendation, which is good, but it does not measure harmful reliance when evidence is wrong or intentionally contradicted. A participant can score perfectly by parroting the interface.

Required revision: add adversarial study trials where seller rules conflict with a saved plan, a price is stale, shipping is unknown, or one expensive card is unpriced. A passing participant must refuse the cap or correct the assumption. Measure false-bid rate, cap overshoot, wrong-plan use, and calibration—not only time and label recall.

---

## Perspective 2 — competitive Magic player

### Persona and attack scenario

The reviewer wants cards for a known deck, sideboard, or format. They care about obtaining the required number of playable copies before an event. They may accept a lower resale-value opening if it contains a needed staple and reject a higher-resale opening composed of irrelevant cards. They usually compare a stochastic break purchase with buying exact singles.

Wizards' Play Booster rationale establishes that play and opening/collecting excitement are different intended motives, but it does not prove a universal competitive-player valuation. The dossier therefore correctly calls personal utility optional and user-authored. ([Wizards on Play Boosters](https://magic.wizards.com/en/news/making-magic/what-are-play-boosters))

### P1 — Color-slot market EV answers the wrong competitive-player question

**Severity: Critical · Disposition: Act by narrowing the claim**

The truth engine outputs market-value distributions by routing slot. A competitive player asks “What is the chance I obtain the specific cards and copy counts I need?” Those are different random variables. A high-EV blue pool can be dominated by a collectible variant of an irrelevant card while having near-zero chance of supplying the needed four-of.

Concrete failure: Blue has $24 typical modeled market value and appears under the Balanced cap. The player's only need is three copies of a $4 uncommon; the box usually yields zero or one. Buying the spot is a poor way to complete the deck even though the financial comparison is internally correct.

Required revision: the default output must say **modeled card-market-value cap**, never “player value.” Add a separate prepared-mode question: “Are you valuing cards to resell/keep generally, or looking for specific cards?” If specific, the primary output becomes chance of meeting the declared target plus user-authored value, not color EV.

### P2 — Play utility is non-additive and copy-count constrained

**Severity: Critical · Disposition: Act in a narrow V2 form; defer full optimizer**

A scalar personal premium added to a slot cannot model play utility. The first needed copy may unlock a deck, copies two through four may add value, and the fifth may have no play value. Utility may also be complementary: three pieces together are valuable while one alone is not. Summing individual card prices or premiums double-counts duplicates and misses set completion.

Concrete failure: the user assigns a $10 personal premium to a needed uncommon. A box can yield four copies. A naive model adds $40 even though only one more copy was needed, inflating the bid cap.

Required revision for V2:

- Allow a small wanted-card list with `copies needed`, `personal value per useful copy`, exact printing flexibility, and “duplicates beyond need use market value only/zero.”
- Calculate the predictive distribution of target completion separately from resale value.
- Label the personal portion and never infer it.

**Defer** deck-level complementarities, collection/deck imports, trade inventory, and general portfolio optimization. Preserve a domain seam for a future utility function, but do not pretend a slider solves it.

### P3 — Color routing is not deck color identity

**Severity: Major · Disposition: Act**

Competitive decks commonly need monocolor cards, multicolor cards, colorless artifacts, and lands together. Break routing sends these to separate M/C/L spots or seller-specific destinations. “Choose your color” can therefore suggest that a blue player is evaluating all cards useful to a blue deck when they are actually evaluating only the seller's blue routing bucket.

Concrete failure: a blue-red player picks Blue, assuming multicolor cards with blue identity are included. The seller routes every multicolor card to M. The desired card can never be won from Blue, but the product label and color-centric workflow encourage the mistaken inference.

Required revision: everywhere a player preference appears, distinguish **auction slot** from **deck/color identity**. Show a one-line routing summary adjacent to selection and explicitly list wanted cards that route outside the selected spot. Unknown routing blocks the target-completion calculation.

### P4 — Exact premium treatment value can oppose functional play value

**Severity: Major · Disposition: Act**

The financial engine properly values exact finishes, but a competitive player may treat multiple printings as functionally substitutable and may not assign the market premium of a showcase or foil version to play utility. Conversely, they may require a specific tournament-legal printing characteristic. The spec has no rule for separating the exact market price from the functional value of acquiring a playable copy.

Concrete failure: the outcome model prices a premium foil at $30. The player would buy a $5 nonfoil to use and gives the finish no premium. The generic market cap tells them to spend as though the extra $25 helps achieve their goal.

Required revision: in wanted-card mode, let the user select exact printing or “any acceptable printing” and set a maximum personal value independent of the pulled printing's market price. Present market and personal utility as separate columns and never add both without explaining the rule.

### P5 — The opportunity-cost alternative is missing

**Severity: Major · Disposition: Act**

The competitive buyer's natural alternative is buying the exact needed singles, not doing nothing. A break can be under a modeled EV cap and still be dominated by a deterministic purchase that completes the deck more cheaply.

Concrete failure: a $20 spot has a 25% chance to yield the needed $15 card and otherwise yields tradable cards. The financial EV may support the bid, but four such attempts cost more than the single with uncertain completion timing.

Required revision: wanted-card results should show `buy exact targets: $X observed market` beside `break: Y% chance to obtain target at $Z all-in`. This is a comparison, not a universal recommendation; condition, seller, shipping, and availability still matter. If exact-single data is absent, say so rather than imply the break is the efficient acquisition route.

### P6 — Format legality, reprint, metagame, and event timing are outside the evidence model

**Severity: Major · Disposition: Defer and constrain language**

Competitive value can change with legality, bans, rotation, reprints, metagame shifts, and the date of the player's event. Draft 1 has no authoritative, dated feed for these states and no workflow for maintaining them.

Concrete failure: an expensive card contributes strongly to the cap but is unusable in the player's target format, or the player needs the deck before shipment can plausibly arrive. A generic “competitive profile” would create false confidence.

Required revision: **dismiss** automatic “competitive playability scores” in V2. Let users author wanted cards and values. **Defer** format/metagame intelligence until there is a first-party legality source, an update contract, and user research showing it affects break bidding. A simple optional event deadline/shipping warning may be added if seller fulfillment data exists; otherwise do not claim readiness for an event.

### P7 — Risk is displayed in dollars, not in accomplishing the player's task

**Severity: Major · Disposition: Act for wanted-card mode**

P10/median/P90 market dollars and chance to clear cost can all look acceptable while the chance to get a wanted card is negligible. For this persona, task risk is “probability of obtaining N useful copies,” with the dollar outcome secondary.

Concrete failure: 70% of simulated openings clear all-in cost through unrelated cards, so the app appears low-risk. Only 3% contain the desired staple. The player overestimates the purchase's usefulness.

Required revision: when wanted cards exist, put `3 in 100 modeled openings meet your target` before the market-value range. Use the same absolute-frequency principles recommended in the dossier. ([Galesic et al., 2009](https://doi.org/10.1037/a0014474))

### P8 — Recruiting “competitive players” does not repair a missing workflow

**Severity: Minor · Disposition: Act**

The measurement plan recruits competitive motives but only tests generic recommendation, cap, and quantile comprehension. A participant can pass without the product ever helping acquire a playable card.

Required revision: either remove competitive-player usefulness from V2 claims or add persona-specific tasks: identify whether a wanted card routes to the spot, compare target-completion probability with buying singles, and avoid paying a finish premium they do not personally value.

---

## Perspective 3 — enthusiastic Magic collector

### Persona and attack scenario

The reviewer cares about exact art, treatment, set, collector number, language, and collection gaps. They may chase a scarce printing despite poor financial expectation, but do not want the app to convert that enthusiasm into an invented monetary premium. They also care about duplicates, card condition, seller handling, and whether a rare item lacks enough transactions for a meaningful market observation.

### C1 — “Exact printing” is necessary but the identity contract is incomplete

**Severity: Critical · Disposition: Act**

The spec requires exact product/finish and an exact printing inspector, but does not define the complete identity fields used for valuation and display. Collector value can differ across treatment, foil state, promo/stamp, language, serialized status, and art variant. Collector number alone may not communicate all of those distinctions to a user, even when it is sufficient for an internal price key.

Concrete failure: the ranked list shows the desired card name and a high price, but the simulated slot can produce a different finish or treatment than the image/name implies. The collector bids for the wrong object.

Wizards explains that sheets, variants, finishes, and dedicated slots interact in collation, and set-specific collecting guides enumerate treatments. ([Wizards: Do the Math](https://magic.wizards.com/en/news/making-magic/do-the-math), [Wizards: Collecting Foundations](https://magic.wizards.com/en/news/feature/collecting-foundations))

Required revision:

- Define the canonical printing identity and display contract: set, collector number, treatment/frame, finish, language assumption, promo/stamp/serialized attributes where applicable, and source slot.
- Never reuse an image or price from a nearby printing as silent fallback.
- If the exact price is unavailable, preserve pull probability and show `price unavailable`; do not substitute another finish without a labeled comparison.

### C2 — Collector utility is also non-additive and duplicate-sensitive

**Severity: Critical · Disposition: Act narrowly; defer inventory integration**

A generic personal premium cannot describe collection completion. The first missing treatment may be highly valuable to the collector; a duplicate may have only resale value. Completing the final card in a subset can be more valuable than the sum of isolated cards. The financial EV engine assumes additive dollar values and therefore cannot claim to represent collection utility.

Concrete failure: the collector wants exactly one borderless card and assigns a $40 personal value. The simulation opens two copies in some outcomes and a naive premium counts $80, raising the cap above what the collector intended.

Required revision: reuse the narrow wanted-card contract from P2 with exact-printing requirements and useful-copy limits. Keep `market value`, `your stated collection value`, and `duplicates beyond target` separate. **Defer** collection-account imports, full set tracking, and completion synergies until a later validated release.

### C3 — Thin-market and missing-price chases can reverse the result

**Severity: Critical · Disposition: Act**

The cards most interesting to collectors are often those for which a stable market observation is least defensible. TCGplayer describes Market Price as derived from recent completed transactions and exposes volatility/indeterminate states for sparse data. A zero, stale, or proxy price is not conservative in every decision: it can suppress a financial cap while simultaneously hiding the collector's main desired outcome. ([TCGplayer Market Price](https://help.tcgplayer.com/hc/en-us/articles/213588017-TCGplayer-Market-Price), [TCGplayer price definitions](https://help.tcgplayer.com/hc/en-us/articles/222376867-What-do-the-different-price-points-on-TCGplayer-com-mean))

Concrete failure: a rare treatment has known pull probability but no exact current price. The engine includes it as $0, labels the output a conservative floor, and still presents Pass. The collector interprets Pass as a judgment on the chase rather than a statement that financial valuation is unavailable. The opposite failure occurs if a single old transaction is treated as a stable current value.

Required revision:

- Show price availability, age, and thin/indeterminate state at the exact-printing level.
- Run bounded sensitivity where possible. If a plausible price interval changes the cap, suppress the financial comparison.
- Preserve a non-monetary “chance to pull your wanted printing” even when financial value is unavailable.
- Do not label an unpriced rare printing as $0 value in buyer-facing prose.

### C4 — The product can model a pull, not the condition delivered to the collector

**Severity: Major · Disposition: Act through scope disclosure; defer scoring**

Freshly opened does not guarantee a collector's desired condition after handling, sorting, sleeving, shipping, or manufacturing variation. The spec's market values require a condition assumption but the first result does not foreground it. Seller links include fulfillment policy, yet ColorBreak has no verified feed for seller handling or card condition.

Concrete failure: a collector uses a near-mint market cap for a premium foil. The seller ships unsleeved bulk and the card arrives damaged. ColorBreak's calculation was mathematically correct but economically inapplicable.

Required revision: state the price condition assumption beside exact-printing value; include seller-authored sleeving/toploader/shipping rules as unverified assumptions; and explicitly exclude delivered condition from the modeled cap. **Dismiss** any seller-quality or condition-confidence score without reliable data. Whatnot's own guidance makes accurate presentation and secure packing seller responsibilities, not facts ColorBreak can infer. ([Whatnot seller performance guidance](https://help.whatnot.com/hc/en-us/articles/41945906342029-Improve-Your-Seller-Performance-Metrics))

### C5 — Ranked EV hides rare collector targets

**Severity: Major · Disposition: Act**

The exploration section ranks cards and emphasizes contribution/concentration. A very rare exact treatment can contribute less EV than a frequently opened mid-price card while being the only object the collector cares about. EV rank is therefore not a collector-interest rank.

Concrete failure: the wanted serialized or showcase variant appears far below common contributors or disappears under a bulk/value filter even though the user opened the tool specifically to inspect its odds.

Required revision: provide separate sorting/filtering by personal wanted status, exact price, pull probability, EV contribution, treatment, and missing-price state. Bulk filters affect the financial sum, not discoverability of a user-marked printing. A user-marked chase remains visible even when its price is below the bulk threshold or unavailable.

### C6 — A scalar “Chase upside” stance exploits enthusiasm without modeling it

**Severity: Major · Disposition: Dismiss as currently defined**

“Chase upside” permits a higher ceiling based on the tail but does not require the tail to contain something this collector wants. It can rationalize spending more merely because the distribution is skewed. That is casino-like authority in conflict with the spec's own non-goals.

Concrete failure: the P90 is high because of a treatment the collector dislikes. Selecting Chase upside raises the cap anyway. The label converts generic variance into a presumed preference.

Required revision: remove Chase upside as a generic cap-raising stance. A cap may rise only from an explicit user-authored value attached to named outcomes, with useful-copy limits. Tail probability remains evidence, not permission. Auction-arousal research makes this restraint especially important. ([Adam et al., 2015](https://doi.org/10.1016/j.jretai.2015.01.003))

### C7 — Chase Map remains scope waste until it beats the exact-printing list

**Severity: Major · Disposition: Defer**

Draft 1 makes Chase Map optional and Release D, which is an improvement, but still specifies non-negative axes, clustering, labels, synchronization, and accessibility work. This is substantial implementation and test scope for a view that answers no core buyer action and has already failed through overlap and negative axes.

Concrete failure: the team spends a sprint building collision-safe scatter interaction while exact treatments, wanted cards, missing-price states, and the live cap remain ambiguous. The plot becomes visually correct but strategically useless.

The dossier's graphical-perception evidence favors aligned position for comparisons and specifically recommends a sortable list before a probability/value plot. ([Cleveland and McGill, 1984](https://doi.org/10.1080/01621459.1984.10478080), [Park et al., Gatherplot](https://www.journalovi.org/2023-park-gatherplots/))

Required revision: remove Chase Map from the V2 testable definition and implementation stories until the ranked exact-printing list passes buyer/collector tasks. Reintroduce it only through an experiment demonstrating faster or more accurate answers to a defined exploration question. A visual bug fix may remain a V1 maintenance patch; it is not justification for V2 product scope.

### C8 — Seller-generated graphics can become persuasive selection without complete denominators

**Severity: Major · Disposition: Act**

The seller launch pack is intended to make auctions enticing and may emphasize appealing art and chase possibilities. The buyer/collector perspective sees an obvious conflict: the seller chooses which chases appear, while the same tool supplies the buyer's supposedly independent analysis. “Modeled, not guaranteed” does not cure cherry-picking.

Concrete failure: a 9:16 graphic shows three premium treatments without their actual pull chances or identifies “$300+ in possible hits” while the typical color outcome is near zero. The seller link then carries the same selected framing into Bid Check.

Required revision:

- Every generated chase graphic shows exact product, exact printings, pull probability or `odds unavailable`, price age/state, and a denominator.
- It includes a standardized typical/downside statement or link to the complete ranked list, not only the selected high tail.
- Seller selections are labeled `featured by seller`; ColorBreak-generated completeness fields cannot be removed.
- Buyer analysis refreshes prices independently and shows a diff from the seller-generated timestamp.

Relative framing can alter decisions; the research specifically warns against “2× better” claims without absolute values and denominators. ([Stone, Yates, and Parker, 1994](https://doi.org/10.1006/obhd.1994.1091))

### C9 — Seller assumptions are not collector trust evidence

**Severity: Minor · Disposition: Act**

The draft correctly avoids a verified badge, but “evidence state” can still be misread as evidence about the seller. Ready means the model has sufficiently complete product/rule/price inputs; it does not establish that the seller will follow them, keep the break visible, or ship the promised cards.

Required revision: rename the state **model input completeness** in buyer-visible contexts. Place `Seller supplied these rules; ColorBreak has not verified performance or fulfillment` adjacent to shared assumptions. Keep platform-account health and seller reputation out of scope without an authorized source.

---

## Feedback to act on, dismiss, and defer

### Act in the next specification revision

1. **Formalize the buyer decision contract.** Define exact inputs, formula versions, cost arithmetic, cap invariants, evidence materiality, output vocabulary, and update behavior.
2. **Reframe recommendation as a cap comparison.** `Under/at/over modeled cap` is more truthful than `Bid/Pass`; current hammer is explicitly manual and staleable.
3. **Make preparation primary.** The core bridge is the platform's own Max Bid/pre-bid. Live mode is optimized recovery/comparison, not an invitation to calculate from scratch in Sudden Death.
4. **Test the real task.** Add same-phone, cross-app, binding-action simulations and adversarial wrong/stale-assumption cases on physical hardware.
5. **Reduce the live viewport.** Cap, gap, all-in, one reason, evidence, and one update/undo control; range and method are secondary.
6. **Define material omissions.** Use decision sensitivity, not a generic warning count.
7. **Add a narrow wanted-card utility model.** Exact card/printing flexibility, copies needed, user-authored value, and duplicates beyond need. Keep it separate from market value.
8. **Separate slot routing from color identity.** A player/collector must see where a wanted card actually routes.
9. **Make exact-printing and price-state identity complete.** Never silently proxy a price/image or turn an unpriced collector chase into a visible $0.
10. **Constrain seller graphics.** Mandatory denominators, complete assumptions, timestamp/diff, and seller-featured labeling.

### Dismiss

1. **Dismiss a universal “good bid” verdict.** The evidence supports clear assumptions and user-authored risk/utility, not an objective valuation of entertainment, competition, play, or collecting.
2. **Dismiss generic Chase upside as permission to raise a cap.** Only named, user-valued outcomes should change personal utility.
3. **Dismiss inferred player/collector premiums.** Rarity, treatment, format presence, or color affinity do not establish an individual's value.
4. **Dismiss automated playability, seller-trust, delivered-condition, or fill-probability scores without authoritative data and validation.** These would manufacture certainty.
5. **Dismiss “three seconds to identify a recommendation” as the sole live success metric.** It can reward automation bias and ignore cross-app completion errors.

### Defer beyond the V2 testable gate

1. Deck-list imports, collection-account imports, inventory reconciliation, completion synergies, metagame scoring, and event-readiness claims.
2. A full arbitrary utility engine. Preserve the seam, but ship only named wanted cards and copy limits after usability validation.
3. Chase Map and other scatterplot exploration until a ranked list succeeds and a controlled test demonstrates incremental value.
4. Seller reputation and condition-quality modeling.
5. Any Whatnot data ingestion not supported by an authorized interface and consent model.

## Required changes to review-round-2 evidence

The next draft should not return for review with only revised wording. It should include:

- a normative formula appendix with worked skewed-outcome examples;
- an evidence-materiality decision table;
- a state diagram for prepare, restore, stale plan, current comparison, taken-color update, and undo;
- a low-fidelity 440 × 956 Live layout and separate keyboard-open/200%-text layouts;
- an exact canonical printing schema and missing-price behavior;
- a wanted-card/copy-limit utility contract, including duplicate and printing-substitution rules;
- study scripts that begin in Whatnot-like context and end at submitted Max Bid, with adversarial stale/wrong assumptions;
- an explicit cut list showing that Chase Map and deep player/collector integrations cannot delay the financial decision foundation.

Round 2 should try to falsify the formulas and interaction artifacts, not re-litigate high-level principles. If the next reviewers cannot compute the cap by hand from a fixture, cannot identify when the product refuses to provide one, or cannot complete the one-phone test without memorizing a number, the product remains under-specified.
