# V2 antagonistic review, round 2 — buyers, competitive players, and collectors

Date: 2026-08-13
Reviewed artifact: [ColorBreak V2 product specification — revision 2](../PRODUCT-SPEC-v2.md)
Prior inputs: [round-1 buyer/player/collector review](round-1-buyers-players-collectors.md), [round-1 adjudication](../ROUND-1-ADJUDICATION.md), and the [primary research dossier](../../research/colorbreak-v2-primary-research-2026-08-13.md)

## Verdict

Revision 2 resolves most of round 1's product-direction failures. It removes the generic `Bid/Conditional/Pass` verdict, makes pre-bid preparation primary, separates buyer and seller private data, removes Chase Map from the V2 path, defines canonical printing identity, and replaces the designer-authored Balanced/Chase rules with named rules whose risk statistic is visible. The first viewport is also much more credible than revision 1.

It is not yet safe to implement the buyer cap contract exactly as written. Three remaining ambiguities can produce a wrong dollar ceiling: hammer-dependent tax is treated as a fixed subtraction, `Under cap` overlaps `At cap`, and wanted-card personal value has no rule saying whether it replaces or adds to market/resale value. These are not copy problems. They are missing domain semantics.

The automation-bias response is substantially stronger, but the release sequence is internally inconsistent: the validation section says the precise-cap treatment must be tested before public rollout while the public testable definition requires that precise cap. A public research build is defensible; an answer-first production promise is not until that gate passes.

## Finding summary

| ID | Severity | Perspective | Finding | Round-1 status |
|---|---|---|---|---|
| R2-B1 | **Critical** | Buyer | The cap equation is not valid when marginal tax or another cost varies with hammer, and no required worked fixtures were added. | Partially resolved; formula introduced, computability not resolved |
| R2-B2 | **Critical** | Buyer | `Under cap` includes equality while `At cap` also equals the cap; current hammer, next actionable bid, and “won now” all-in are inconsistent. | Regression in new normative semantics |
| R2-PC1 | **Critical** | Player/collector | Wanted-card value can be double-counted because the spec never defines whether personal value replaces or supplements base market/resale value. | Partially resolved |
| R2-B3 | **Major** | Buyer | Median and coverage quantiles lack a finite-sample/tie convention, so independent implementations need not produce the same cap. | New precision issue exposed by the normative rules |
| R2-B4 | **Major** | Buyer | A refreshed modeled cap may rise automatically whenever no optional hard cap exists. The saved rule is versioned, but the prepared dollar commitment is not. | Round-1 safeguard only partially resolved |
| R2-PC2 | **Major** | Player/collector | Wanted rows/groups have no overlap, allocation, joint-goal, or membership-version contract. | New detail issue exposed by wanted mode |
| R2-C1 | **Major** | Collector | “Acceptable printing group” and buy-the-single comparison are underspecified for multiple finishes, copies, prices, and unavailable exact observations. | Partially resolved |
| R2-B5 | **Major** | Buyer | The live wireframe is plausible at rest, but the cross-app/cold-restore/clipboard failure path is not a product contract and the seven-second gate is escapable. | Mostly resolved; feasibility residual |
| R2-B6 | **Major** | Buyer | The spec recognizes automation bias but does not make the experiment a hard implementation/rollout dependency. | Partially resolved |
| R2-PC3 | **Major** | Player/collector | Validation still lacks player/collector tasks and wanted-value counterexamples. | Unresolved from round 1 |
| R2-C2 | **Minor** | Collector | A “language assumption” inside exact identity can still look like an observed attribute; condition applicability is also detached from the exact-price display. | Minor residual |

## Critical findings

### R2-B1 — The cap is not hand-computable when costs depend on hammer

Revision 2 defines:

`raw maximum hammer = V - K`

`modeled financial cap = floor(max(0, raw maximum hammer) / t) × t`

It then says `K` includes modeled tax. Tax commonly depends on hammer, and may also depend on shipping and jurisdiction. In that case `K` is not known until a candidate hammer is known. Subtracting one previously estimated tax amount from `V` can produce a cap whose own all-in amount exceeds `V`.

Example: value target $24, $3 fixed marginal cost, 10% tax on hammer, and $1 tick. The written subtraction cannot be applied unless the app first invents a hammer at which to calculate tax. The correct constraint is `h + 0.10h + 3 ≤ 24`, so the largest supported hammer is $19, not `$24 - $3 - some unexplained tax`.

The adjudication explicitly required normative formulas, rounding, **worked counterexamples**, and boundary cases. Revision 2 contains the formula but no worked fixture. That leaves tax basis, cent rounding, a zero/negative result, and an exact-on-boundary result untestable by a human.

**Required correction:** model marginal buyer cost as a visible function `C(h, order state, jurisdiction)` and define:

`modeled cap = max { h in supported bid amounts : h + C(h) ≤ V }`

If costs are fixed, this reduces to the simple subtraction. If tax is a rate `r` on hammer and fixed costs total `F`, the hand-computable form is `floor_tick((V - F) / (1 + r))`. The spec must supply fixtures for fixed cost, hammer-dependent tax, tax including shipping, unknown tax/cost, `V ≤ cost`, and a cap exactly on a supported tick. `No modeled cap — additional cost unknown` and `No financial room to bid` should be distinct states.

This is critical because the primary output is a dollar ceiling and the current equation can authorize an all-in spend above its own selected value target.

### R2-B2 — The comparison states overlap, and “won now” names the wrong amount

The normative rules say:

- `Under cap by $X`: next bid **≤** cap;
- `At cap`: next bid **=** cap;
- `Over cap by $X`: next bid **>** cap.

Equality therefore produces two valid states. A boundary implementation can render either label while still claiming spec compliance. This is a direct regression introduced in revision 2.

There is a second mismatch. The live wireframe asks for `NEXT AVAILABLE BID`, but displays `All-in if won now`, while the formula defines that value from **current hammer**. A buyer who is not currently leading cannot win at the current hammer; the next actionable amount is the next available bid. A buyer who is already leading does not need to place that bid. The interface has not modeled bidder-leading state, so “if won now” is false or ambiguous in one of those cases.

**Required correction:** define one effective ceiling and mutually exclusive comparisons after currency normalization:

- `effective total Max Bid = min(modeled cap, confirmed user hard cap)` when a hard cap exists;
- `Under cap` only when `next actionable total < effective cap`;
- `At cap` only when equal;
- `Over cap` only when greater.

Show `All-in at next bid = next bid + C(next bid)` and `All-in at cap = cap + C(cap)`. Show `All-in at current hammer` only as an observational amount, or only after the user explicitly says they are currently leading. The counterexample suite must test equality, a next increment that crosses the cap, and a current hammer below cap whose next legal bid is above cap. The existing suite's first case demands the latter result but uses the word “over” without repairing the normative `≤` error.

### R2-PC1 — Wanted-card utility has no non-double-counting rule

Revision 2 calls personal wanted-card utility a separate value mode, but then says duplicates beyond the useful-copy limit are valued under the “selected market/resale mode.” It never says what happens to useful wanted copies:

- Does a user's `$20 per useful copy` replace that copy's $12 market value?
- Is it an additional $20 premium, producing $32?
- Are all non-wanted cards still assigned market/resale value in personal mode, or zero?
- If a wanted exact printing has no price, does personal value remain usable while financial value is unavailable?

Each interpretation produces a different distribution and cap. The same ambiguity affects a competitive player who values one playable copy and a collector who values one missing treatment. The copy-limit field prevents the fifth copy from receiving unlimited personal value, but it does not prevent every useful copy from receiving both personal and financial value.

**Required correction:** name the user-authored amount as either **total personal value per useful copy** or **incremental premium over base value**; do not support both without an explicit mode. The safer narrow contract is a replacement rule:

`outcome value = base value of unmatched copies + user total value of copies allocated to unmet wanted needs`

where base is explicitly either modeled market or modeled net resale. If the desired product is “wanted utility only,” state that every non-wanted copy is valued at zero. Show financial and personal results separately before any explicitly selected hybrid. Add fixtures proving that the fifth copy receives no personal value, that a useful copy is not double counted, and that missing market price preserves wanted probability without silently becoming $0 financial value.

## Major findings

### R2-B3 — Coverage and median rules need exact order-statistic semantics

`Q(1-c)` is not one universally defined operation. Libraries use different empirical quantile interpolation conventions. With an even sample count, “median” can mean the lower middle, upper middle, or their arithmetic mean. The interpolated value may be an outcome that never occurs. Ties and point masses at zero further affect the promised coverage statement.

For sorted simulated values `x(1)…x(N)`, the spec should define the exact index used. One defensible coverage implementation is the largest observed target whose empirical meet-or-exceed frequency is at least `c`, equivalently `x(N - ceil(cN) + 1)` before currency rounding. It should then report the measured frequency after rounding. Typical likewise needs a stated lower/upper/interpolated median convention. Monte Carlo seed/sample revision belongs in provenance because a near-tick estimate can move the cap.

A four-outcome hand fixture such as `[0, 10, 20, 40]` should be computable for all three rules. Without it, the named rules are conceptually better than round 1 but still fail the spec's own “public test seam” requirement.

### R2-B4 — The hard cap safeguard is optional, so a prepared cap can still ratchet upward

Revision 2 says a price/source/rule refresh never raises a saved hard cap. That resolves the case only when the buyer happened to author a second cap below the model. Most buyers following the preferred path will simply save a cap rule and copy the resulting number. A favorable price refresh can then raise the modeled dollar cap while leaving the rule unchanged. Under time pressure, that is functionally an unrequested increase in the user's precommitment.

The prepared artifact needs its own immutable dollar snapshot and evidence revision. A recomputation may lower the usable ceiling immediately when material adverse evidence appears, but it must not raise the active ceiling without affirmative confirmation. The UI may show “new analysis supports up to $27; saved limit remains $24.” This safeguard matters independently of whether the user created an extra hard-cap field.

### R2-PC2 — Wanted rows can overlap and target completion is not mathematically defined

An exact-printing row can be a member of an acceptable-printing group, and two acceptable groups can overlap. One pulled card could then satisfy two copy goals or receive two user values. The spec also does not define whether “3 in 100 modeled openings meet your target” means every row's copy goal, any row, or the selected row. For several wanted cards, competitive-player and collection-completion value often depends on the joint event.

Require either non-overlapping target groups or a deterministic one-copy-to-one-need allocation rule. If overlapping is allowed, use a visible allocation priority or a maximum-value matching rule that is stable and testable. Show per-target completion and the joint “all selected targets” result separately. `Useful copies needed` should be labeled **additional useful copies wanted**, so a player who already owns three of a four-of knows to enter one.

### R2-C1 — Acceptable printings and buy-the-single comparison are too loose for collectors

Canonical exact printing is materially improved: set, collector number, finish, treatment/frame, language, promo/stamp/serialized state, and source slot are named, and image/price proxying is forbidden. The residual problem is the escape hatch `explicit acceptable-printing group`.

A collector must be able to see the group's complete enumerated canonical membership. Membership must be pinned to the source revision; a data refresh must not silently add a newly discovered treatment. Every simulated member must retain its own exact image and price state. A generic name-, art-, or set-based group is not exact enough.

The “observed exact-single price” comparison is also singular while a goal can require several copies or accept several printings. The relevant comparator is a dated, quantity-aware acquisition set assembled from acceptable exact printings, with shipping/condition limitations stated; otherwise display “single comparison unavailable.” It must not imply the cheapest listing is attainable net delivered cost.

### R2-B5 — The first viewport improved; the live task still lacks failure-path contracts

At normal text with Safari chrome, the reduced wireframe is credible. At keyboard-open, showing the edited input, cap, and gap is also plausible if those elements form one keyboard-aware region. Revision 2 correctly stops requiring the entire screen at 200% text.

The remaining risk is the cross-app chain. Whatnot recommends Max Bid/pre-bid because short auctions move quickly, and Sudden Death does not extend; the dossier therefore supports preparation, not dependence on a heroic live context switch. Revision 2 tests app switching and restoration, but does not specify:

- warm return versus Safari/process eviction and cold local restore;
- clipboard denied/unavailable and a selectable-number fallback;
- stale restored plan, wrong seller/spot detection, and visible plan identity after return;
- whether the measured task starts with the correct prepared plan already cached;
- whether seven seconds includes switching, authentication interruptions, keyboard, and test-bid submission;
- a fixed test fixture for “where auction mechanics allow,” which is currently an exclusion loophole.

The live comparison should remain explicitly non-essential. The release gate should separately measure prepared pre-bid/Max Bid transfer and live fallback. A failed live p90 must narrow the live claim, not pressure the UI toward smaller targets or hidden evidence.

### R2-B6 — Automation-bias testing exists, but its result does not yet control rollout

Revision 2 makes an important improvement: it compares precise-cap, cap-range, and distribution-only treatments; measures clustering, limit violations, bad-advice compliance, and regret; and says a precise-cap design fails if it causes harmful anchoring. This substantially addresses round 1.

However, the Definition of testable V2 already requires a precise cap on the public URL. The wording “before public precise-cap rollout” is not connected to an implementation dependency or fallback product. If the precise treatment fails, the spec does not say which experience ships or how stories depending on `Copy total Max Bid` are re-scoped.

Make this a named go/no-go gate before production-default rollout. A public URL may host a clearly identified research build, but a failed study must select cap range/distribution-only or another validated treatment. The rule picker must have no preselected normative default, and treatment assignment/order must avoid making “Typical” look officially recommended. The primary result should identify itself as a user-selected rule outcome, not only “YOUR TOTAL MAX BID.”

### R2-PC3 — Player and collector claims still lack persona-specific validation

The validation plan measures generic cap-rule comprehension and comparison accuracy. It does not require a player to determine whether the wanted card routes to the selected spot, set an incremental copy need, avoid paying an unwanted finish premium, or compare target completion with buying singles. It does not require a collector to distinguish two treatments with the same card name, notice an unavailable exact price, or detect an acceptable-group membership error.

Add persona fixtures and gates, or narrow testable V2's player/collector claim to “user-authored wanted probabilities.” Required counterexamples should include:

1. one useful copy plus four duplicates;
2. exact row overlapping an acceptable group;
3. wanted card routed outside the selected auction spot;
4. same card name with two treatments and only one acceptable;
5. exact wanted printing with unavailable price but known pull frequency;
6. two target rows where per-target success differs from joint success;
7. a collector value that replaces, rather than adds to, market value.

## Minor finding

### R2-C2 — Exact identity should distinguish declared assumptions from observations

“Language assumption” is useful provenance but is not an observed printing attribute. A collector can read an exact identity row as stronger evidence than the seller declaration supports. Present observed canonical attributes and seller/source assumptions separately. Likewise, condition is not part of printing identity, but the price observation's condition applicability must sit beside the exact price rather than only in a global value-mode explanation.

## Round-1 critical-issue verification

| Round-1 issue | Revision-2 result |
|---|---|
| Undefined Balanced/Chase ceiling | **Direction resolved.** Replaced with typical, coverage, and mean rules. Exact finite-sample and cost-function math remains blocking. |
| Reading speed substituted for full auction task | **Mostly resolved.** Same-phone start-to-submit study added; cold restore, clipboard failure, and fixed fixture remain. |
| Current hammer changed recommendation / stale `Bid` instruction | **Resolved in direction.** Cap is invariant and action verbs removed. Current/next/all-in labels still conflict at the boundary. |
| “Max next bid” ambiguous | **Resolved.** `total Max Bid` and `next available bid` are separate. Equality logic regressed. |
| Hidden shipping/tax/realization assumptions | **Partially resolved.** Unknown-cost refusal and named modes added; hammer-dependent tax arithmetic is invalid/undefined. |
| Impossible crowded first viewport | **Resolved enough to prototype.** Detail moved behind one tap and zoom contract relaxed. Keyboard/cross-app gates must still be operationalized. |
| Generic Bid/Conditional/Pass authority | **Resolved.** Literal under/at/over language replaces it, subject to the equality bug. |
| Missing evidence materiality rule | **Resolved.** Decision-boundary sensitivity is now normative. |
| Shared plans/provenance/preferences conflated | **Resolved.** Unverified source revision, local diff, and buyer/seller noninterference are explicit. |
| Automation-bias and corrupted-advice risk ignored | **Substantially resolved in study design, not rollout sequencing.** |
| Player/collector value reduced to generic EV | **Direction resolved.** Narrow wanted mode exists; its aggregation/allocation contract is incomplete. |
| Exact printing could silently proxy image/price | **Resolved for exact rows.** Acceptable groups and acquisition comparison need stronger contracts. |
| Chase Map blocked buyer usefulness | **Resolved.** It is outside the V2 testable core; ranked exact-printing evidence comes first. |

## Regressions introduced in revision 2

1. `next bid ≤ cap` and `next bid = cap` define two outputs for equality.
2. `All-in if won now` uses current hammer while the wireframe's actionable input is next available bid.
3. The new personal-value mode refers back to a “selected market/resale mode,” although the earlier section presents all three as separate modes. This creates a hybrid without defining it.
4. The precise-cap experiment is a pre-rollout requirement, while the public testable definition assumes the precise cap has already won.

## Required disposition before implementation of the buyer engine

**Act before coding the normative engine:** R2-B1, R2-B2, R2-PC1, R2-B3, R2-B4, and R2-PC2. These define the dollar result and must be acceptance fixtures, not implementation guesses.

**Act before production-default buyer rollout:** R2-B5, R2-B6, and R2-PC3. A research build can precede their empirical completion, provided it is labeled and does not claim validated sub-ten-second safety.

**Act in the exact-printing/wanted-card story:** R2-C1 and R2-C2.

## Marginal-return assessment

Another full seven-perspective antagonistic review **before** repairing the critical math is unlikely to yield meaningful new product direction. Revision 2 has converged on the right boundaries: stable user-owned cap, prepare-first workflow, no demand inference, explicit provenance, exact-printing evidence, narrow wanted mode, conditional seller economics, and no Chase Map dependency. Most remaining buyer findings are formal contract gaps that should be closed with worked fixtures and counterexamples.

A targeted final review is justified after those edits, not another broad review now. It should be limited to three independent checks:

1. a hand-calculation audit of cap/cost/quantile/equality fixtures;
2. a wanted-card allocation audit across overlapping exact-printing groups and copy limits; and
3. a physical-device protocol audit of the prepared and live same-phone tasks plus automation-bias rollout gate.

The precise residual blockers are: a hammer-dependent cost equation; mutually exclusive current/next/at-cap semantics; a no-double-counting wanted-value rule; empirical quantile/tie definitions; immutable prepared-cap adoption rules; target-group allocation/joint-completion semantics; enumerated versioned acceptable-printing groups; and an explicit fallback if precise-cap experimentation fails. Once those are repaired and the targeted audits pass, another full review round is likely to produce refinements rather than materially different requirements.
