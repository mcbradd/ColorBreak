# ColorBreak V2 antagonistic review, round 2 — game theory and auction economics

Date: 2026-08-13
Artifact reviewed: [PRODUCT-SPEC-v2.md](../PRODUCT-SPEC-v2.md)
Prior review: [round-1-game-theory-economics.md](round-1-game-theory-economics.md)
Evidence base: [primary research dossier](../../research/colorbreak-v2-primary-research-2026-08-13.md) and the primary sources linked below

## Review posture and verdict

This review treats the game theorist and auction economist as separate hostile reviewers. Both assume that users respond strategically, sellers can select favorable truthful statements as well as make false ones, distributions are discrete, simulations have error, auction costs can depend on hammer and bundle state, and a recommendation can change the behavior it purports to assist.

Revision 2 is a large improvement. It removes the unsupported demand optimizer and generic `Run`, separates seller-private and buyer-private data, replaces the opaque buyer recommendation with named rules, and makes fill results conditional. Those are genuine corrections, not wording patches.

It is not yet safe to turn into implementation stories unchanged. Four residual defects can still make the product confidently wrong:

1. The buyer formula `H = V - K` is valid only when additional cost is a fixed dollar amount independent of hammer. Tax, shipping tiers, credits, and some cross-border charges violate that assumption.
2. The seller auction branches can imply that economics “clear” from starts or required hammers even though neither is achieved revenue.
3. “Plausible bounds” and “candidate unsold sets” are not governed sets. A favorable source revision, narrow uncertainty interval, one-at-a-time sensitivity, or hand-picked unsold set can manufacture a Ready result.
4. The precise-cap anchoring experiment is described but is not an enforceable release gate. The public definition of V2 simultaneously requires a precise cap.

**Round-2 decision: revise again before implementation of buyer financial advice or seller target status.** Implementation may safely begin on evidence identity, provenance types, state preservation, accessibility, and non-advisory workflow shells while the contracts below are repaired.

Severity in this document:

- **Critical:** can reverse a cap/status, make a strategic manipulation look independent, or invalidate a core release claim.
- **Major:** ordinary inputs can create a misleading number or a gate that cannot be tested reproducibly.
- **Minor:** language or boundary ambiguity that should be fixed but need not stop non-advisory infrastructure.

## Round-1 criticals: resolution audit

| Round-1 finding | Round-2 status | Evidence in revision 2 | Residual issue |
|---|---|---|---|
| GT-C1 — cap versus next bid | **Substantially resolved** | Total Max Bid, optional next available bid, and under/at/over are distinct. | Cap arithmetic still fails when marginal cost is a function of hammer. |
| GT-C2 — advice as anchor | **Partially resolved** | Prepare precedes display; current/rival bids do not change value; the study compares precise cap, range, and distribution-only. | Harmful-anchoring failure is not a pre-public feature gate, while testable V2 mandates a precise cap. |
| GT-C3 — seller-authored assumptions | **Partially resolved** | Source facts, seller declarations, buyer choices, and seller-private inputs are separated; links are hashed and diffable. | The seller can still select or preserve favorable source/evidence revisions, featured evidence, and defensible-looking bounds unless selection is engine-owned. |
| GT-C4 — unsupported optimizer | **Resolved for testable V2** | Automatic optimization and demand/fill forecasting are explicitly deferred; only explicit what-if variants remain. | Comparison needs invariant spot-level harm fields, but no optimizer claim remains. |
| EC-C1 — incoherent buyer ceiling | **Partially resolved** | Three named rules replace the designer-authored blend. | Median language is false for discrete point masses; empirical quantile convention and cost-dependent cap equation are missing. |
| EC-C2 — scalar/expected fill | **Partially resolved** | Expected fill is removed; exact unsold sets and sealed-inventory stress are required. | “Candidate” sets do not define an adverse frontier and allow cherry-picking; auction starts/requirements are not realized sales. |
| EC-C3 — unpropagated uncertainty | **Partially resolved** | Ready/Sensitive/blocked states and materiality bounds are defined. | Bounds have no owner, construction rule, joint feasible set, confidence level, or Monte Carlo tolerance. |
| EC-C4 — scalar realization haircut | **Partially resolved** | Market, banded net resale, and personal utility are separated. | Band membership, lot formation, fixed-friction allocation, unsold floor, time horizon, and condition rules are not specified, so the required $100-versus-100×$1 result is not guaranteed. |

Two of eight round-1 criticals are resolved enough to stop driving core risk; six are improved but incomplete.

---

# Perspective 1: antagonistic game theorist

## Critical findings

### GT2-C1 — The anchoring study is advisory, while the precise answer is mandatory

**Attack.** Section 12 says precise-cap, cap-range, and distribution-only treatments should be compared “before public precise-cap rollout” and says a precise design fails if it increases harmful anchoring. Section 15 nevertheless defines testable public V2 as a buyer choosing a rule and copying a total Max Bid. There is no flag state, minimum study quality, effect threshold, confidence requirement, or fallback that converts a failed study into a range/distribution release.

That contradiction is strategic, not procedural. A salient dollar cap can become a focal point for buyers and, indirectly, sellers. Clustering at a number is not itself proof of harm—the advice may be informative—but increased violations of an independently elicited limit or increased obedience to intentionally corrupted advice is harm. The implementation cannot decide what to ship without a normative gate.

**Counterexample.** A randomized study finds the precise-cap group completes 2.5 seconds faster but is 9 percentage points more likely than range-only to follow a deliberately corrupted high recommendation and 6 points more likely to exceed its pre-elicited maximum. Section 12 says the design fails; section 15 still requires it for public testability.

**Required revision — Act.** Make precise cap a feature-gated treatment until the study passes. Pre-register the primary harm outcome, non-inferiority margin, confidence interval, sample-size rule, corrupted-advice fixture, and fallback. If it fails, V2 public scope becomes a cap range or distribution-plus-user-hard-cap experience; no implementation story may silently restore the point estimate.

### GT2-C2 — Provenance is labeled, but evidence selection remains strategically manipulable

**Attack.** Revision 2 prevents a seller from overwriting an immutable source record. It does not prevent a seller from selecting which legitimate source revision, price observation, stale plan revision, acceptable-printing mapping, featured printing, or uncertainty interval reaches the buyer. Selective truth is sufficient for manipulation. A payload hash proves immutability after selection, not neutrality of selection.

The problem is sharpest when a shared link carries an old favorable price/source revision. Section 3 says refresh “may” create a new revision and section 7 gives a stale/conflict check, but it does not say that buyer analysis must run against an engine-selected current eligible revision or suppress the cap when the seller-pinned revision is materially stale. Likewise, “plausible” price bounds can be narrowed until a cap no longer switches unless the bound rule is source-owned and versioned.

**Counterexample.** Two links describe the same exact break and contain no false field. Link A pins yesterday’s thin $180 chase observation; Link B uses the current $95 observation. If A can yield a higher Ready cap because the buyer must manually refresh or inspect a diff, seller authorship still changes financial advice through evidence selection.

**Required revision — Act.** Distinguish **reconstruction revision** from **buyer decision revision**. Preserve the seller’s historical revision for audit, but compute the buyer result from the current engine-selected eligible evidence revision unless the buyer explicitly chooses otherwise locally. Evidence-source eligibility, freshness, proxy rules, and uncertainty bounds must be engine-owned, versioned, and included in the result hash. A material historical/current divergence must suppress the precise cap. Seller-selected featured cards may affect presentation order only; they may not affect the set, weights, bounds, value mode, or first-view conclusion.

## Major findings

### GT2-M1 — Noninterference needs an information-flow contract, not only output invariants

**Attack.** “Changing seller-private data cannot change buyer analysis” and its converse are good invariants, but “buyer analysis” and “Seller Studio” are not byte-level surfaces. A private value could still affect cache keys, shared URLs, telemetry, export metadata, recent-plan labels, ranking order, or timing without changing the headline cap. Seller cost could leak through a plan identifier or analytics payload.

**Required revision — Act.** Enumerate protected sinks: displayed output, serialized state, URL, plan hash, export, cache key, analytics/diagnostic event, worker request, and network request. Define canonical public projection functions before hashes or shares are produced. Require taint-style unit tests using sentinels in every private field and byte-equivalence of every opposite-side sink. Timing-channel equivalence is not realistically required, but private values must not select code paths that issue different external requests.

### GT2-M2 — Buyer-declaration influence is legitimate but insufficiently bounded

**Attack.** Seller declarations necessarily affect buyer outcomes because routing and what ships change the asset. The spec correctly exempts these from seller-private noninterference. That creates the main strategic opening: a seller can make optimistic but non-conflicting declarations (“all bulk ships,” generous ambiguous routing, specific fixed contents) and later perform differently. “Unverified shared plan” helps after careful reading but not during a ten-second decision.

**Required revision — Act.** The first buyer viewport must state which value-moving facts are seller declarations, not merely that the plan is unverified. A declaration with no source-verifiable counterpart must remain a declaration in every derived row and export. A cap may be produced, but its controlling reason must identify a seller declaration when removing that declaration crosses the decision boundary. Add a counterexample where deleting one optimistic declaration switches under/over-cap.

### GT2-M3 — The what-if comparator still permits persuasive omission

**Attack.** Section 8.6 requires exact changes in contribution, lower tail, loss frequency, and concentration. It does not require a fixed comparison baseline, complete display of all variants entered, or consistent axes/order. A seller can construct ten variants, export only the favorable one, and use “Featured by seller” graphics with mandatory but visually subordinate downside context. This is not an optimizer, but it remains a persuasion surface.

**Required revision — Act for integrity, dismiss universal neutrality.** Every comparison must name its baseline and use fixed metric definitions. A launch asset need not disclose abandoned drafts, but it must not use “best,” “safer,” “balanced,” or comparative improvement unless both denominator and baseline revision are included. Automated visual prominence must not be selectable for expected value without equally prominent downside probability. Do not attempt to make sales material non-persuasive; make claims falsifiable and revision-consistent.

### GT2-M4 — Repeat-position refusal is correctly safe but must precede any stale single-position result

**Attack.** Section 5.6 allows either incremental without-replacement analysis or “No modeled cap for another position.” This resolves the economic issue only if the refusal is atomic. A cached one-position cap retained as “updating” after the user marks an existing position could still be acted upon.

**Required revision — Act in acceptance criteria.** A state change that enters an unsupported repeat-position domain must immediately replace the old cap with refusal; “retain last valid result while updating” must not retain a result known to be for the wrong ownership state. Add this to counterexample 9.

## Minor finding

### GT2-m1 — Do not describe provenance controls as incentive compatibility

Revision 2 mostly avoids this claim. Preserve that restraint. Hashes, diffs, and immutable revisions improve manipulation evidence and consistency; they do not make a seller truthful or neutral.

---

# Perspective 2: antagonistic auction economist

## Formula audit

### Buyer cap

The stated formula is correct only under an unstated restriction:

`H* = floor(max(0, V - K) / t) × t`

is valid when `K` is a fixed, known dollar cost independent of hammer `H` and the utility/value mode is expressed in comparable dollars. The general contract is:

`H* = max legal H such that H + K(H, order state, jurisdiction) ≤ V`

then apply any user hard cap. This matters because modeled tax is ordinarily a rate applied to hammer and sometimes shipping, while bundled shipping is a step function of accumulated package weight. Whatnot states that shipping and tax are added to hammer and that shipping changes with item, distance, seller settings, and bundle state ([bidding mechanics](https://help.whatnot.com/hc/en-us/articles/14932924544141-Bid-on-an-item-during-a-show), [buyer shipping](https://help.whatnot.com/hc/en-us/articles/13889209206925-Troubleshoot-shipping-costs-as-a-buyer)).

Worked example: `V = $100`, fixed marginal shipping `$5`, tax `10% × H`, and `$1` legal tick. Revision 2 cannot set `K` before knowing `H`. The correct inequality is `1.10H + 5 ≤ 100`, producing an `$86` cap. Using tax estimated at the current `$50` hammer gives `K = $10`, a `$90` cap, and `$104` all-in—above the selected value target. The displayed equation can therefore induce an over-cap purchase.

`all-in at cap = cap + K` and `all-in if won now = current hammer + K` have the same defect unless they evaluate separate `K(cap, state)` and `K(current, state)` values. A single acknowledged `K` is safe only when the UI explicitly selects fixed-dollar mode.

The hard-cap operation `min(user hard cap, modeled cap)` is coherent and the no-silent-raise invariant is sound.

### Quantiles and coverage

For a population distribution with lower quantile `Q(p) = inf{x : F(x) ≥ p}`, using `Q(1-c)` as a coverage value can conservatively yield at least `c` probability at or above the target when ties are handled by the left-limit. But revision 2 does not define this convention. Interpolating sample quantiles can produce a value never observed and alter empirical coverage in a discrete pull distribution; different standard quantile estimators return different answers ([NIST quantile reference](https://www.itl.nist.gov/div898/software/dataplot/refman2/auxillar/quantile.htm)).

The sentence “median … half of modeled outcomes are lower” is false for discrete distributions. If every modeled opening is worth `$20`, zero outcomes are lower than the median. The safe claim is: “at least half of modeled outcomes are at or above this value, and at least half are at or below it,” subject to the declared empirical quantile convention.

Simulation error and model uncertainty are separate. “90% coverage” may describe the empirical simulated distribution, the modeled latent distribution, or a lower confidence bound on true model coverage. The UI must say which. To promise only empirical model coverage, define the order statistic, ties, sample size, seed/reproducibility policy, and maximum Monte Carlo error near the decision boundary. To promise coverage with statistical confidence, select a conservative order statistic using a predeclared confidence procedure. It must not silently call 900 of 1,000 simulated outcomes “90%” as though collation/source uncertainty were included.

### Seller economics

The contribution formula is directionally correct but insufficiently typed. Whatnot’s current fee documentation says commission is a percentage of final sale price, while processing is a percentage of **total order value**, generally including buyer-paid shipping and tax, plus a fixed fee per transaction; fees remain separate even when transactions are later bundled ([Whatnot seller fees, checked July 2026](https://help.whatnot.com/hc/en-us/articles/4847069165965-Whatnot-seller-fees)). Therefore the calculation needs, for each transaction `i`:

`net_i = hammer_i - commission(hammer_i) - processing(hammer_i + buyerShipping_i + buyerTax_i) - feeTax_i - sellerFundedShipping_i`

and then subtract plan-level product, supplies, promotion, labor/overhead as declared. A fee-profile schema alone does not supply buyer shipping/tax or transaction grouping. If these are unknown and material, seller status is Sensitive or missing assumptions—not Ready.

`acquisition/decision cost` must be two separately computed views, never a slash operand. Cash and decision bases can differ; one number cannot subtract both or silently choose one.

## Critical findings

### EC2-C1 — Variable buyer costs make the normative cap equation wrong

**Attack.** As the worked example shows, tax and shipping cannot generally be collapsed into fixed `K`. This is a direct violation of the central promise, not an edge case.

**Required revision — Act.** Define a versioned added-cost function with fixed, proportional, and stepwise components, evaluated at candidate hammer and current order state. Solve over the platform’s legal bid domain, not by subtracting an estimate. If tax/bundle state is unknown and a defensible cost interval crosses the next-bid relationship, show No modeled cap or a conservative cap explicitly chosen by the buyer. Preserve separate all-in values evaluated at cap and current hammer.

### EC2-C2 — Auction starts and required hammers cannot establish target-clearing status

**Attack.** Section 8.2 says economics clear at declared full-fill prices. That is meaningful for accepted BIN/offer prices. For PYT auction, the seller declares a start and the tool calculates required average/total hammer. For random auction, it calculates required average across positions. A required value is not a predicted or achieved value. Calling economics clear because the required number was computed is circular; calling it clear at starts assumes every lot sells at least at the start and ignores unsold/canceled outcomes.

**Counterexample.** The tool calculates that 10 random positions require an average `$20` hammer. The seller enters `$1` starts. Nothing in the model establishes `$200` realized revenue, so neither “clear” nor “miss” is available before sales. The correct result is “Requires $20 average hammer / $200 total; actual outcome unknown.”

**Required revision — Act.** Branch status semantics:

- BIN/offer: conditional clear/miss at posted asks and, separately, at minimum accepted offers.
- Auction before sales: required total/average hammer only; no clear/miss status unless a seller-authored scenario is explicitly named “if every position closes at these assumed hammers.”
- Auction during/after sales: achieved-to-date plus required average for remaining positions; final clear/miss only after all accounted transactions and costs resolve.

No start, reserve, or required hammer may inhabit the realized-hammer type.

### EC2-C3 — Materiality bounds are not robust to joint uncertainty or strategic selection

**Attack.** The materiality rule evaluates lower/upper bounds “where defensible” for every omission. It does not define who defends them, whether parameters vary jointly, what correlations are feasible, or how Monte Carlo error is included. One-at-a-time sensitivity can label Ready even when plausible simultaneous changes cross the threshold. Conversely, naively combining every independent worst case can suppress nearly all results.

**Counterexample.** Price uncertainty lowers value by `$3` and marginal-tax uncertainty lowers the cap by `$2`; each alone leaves a `$4` under-cap gap, so one-at-a-time checks pass. Jointly the decision is `$1` over cap. Ready is false.

**Required revision — Act.** Define a versioned feasible uncertainty set by parameter class, with engine-owned source rules, dependencies/correlations, and a joint decision-range calculation. Report the switching combination, not merely one assumption. Distinguish aleatory pull variability, evidence/model uncertainty, and simulation error; a coverage cap handles only the first. If robust evaluation is too expensive, use a documented conservative envelope and label it as such.

### EC2-C4 — The net-resale contract is still not executable

**Attack.** “Banded realization,” “fixed per-lot friction,” and “time horizon” name ingredients but not an algorithm. The product cannot guarantee counterexample 7 without rules for band boundaries, whether percentage applies before or after fixed cost, which cards are grouped into a lot, how unsold cards are valued, card/order/shipment fee bases, condition loss, and how copy count affects sale lots.

**Counterexample.** A careless implementation applies 70% to every exact-printing price and subtracts one `$3` friction from the entire opening. One `$100` card produces `$67`; one hundred `$1` cards also produce `$67`, so the required counterexample still fails despite apparently implementing every named field.

**Required revision — Act.** Specify a deterministic Release-A liquidation transform, including default value bands, user-visible overrides, minimum net sale threshold, lot construction, percentage/fixed fee order, unsold/bulk floor, time horizon, condition assumption, and currency rounding. For each outcome, aggregate cash-equivalent resale proceeds only after the card/lot transform. Keep market collection value available as a separate noncash mode.

## Major findings

### EC2-M1 — Counterexample 4 asserts a false mathematical invariant

“Equal mean but different loss frequency under coverage rule → different cap” is not generally true. Two distributions can have equal means, different loss frequencies relative to an arbitrary threshold, and the same selected quantile. A coverage cap must differ only when the relevant `Q(1-c)` differs.

**Required revision — Act.** Replace it with a concrete fixture whose mean is equal and whose selected lower quantile differs, and assert the expected numeric caps. Test loss-frequency display separately at a named all-in threshold.

### EC2-M2 — “Candidate unsold sets” is not a fill frontier

**Attack.** Exact named sets are better than a scalar percentage, but “candidate” permits the interface or seller to choose favorable sets. For unequal spots, an adverse funding view must show how much revenue can be collected for a given number of accounted positions and which remaining sets produce the bound. No fill probability is implied.

**Required revision — Act.** Define the frontier for each count `k` of sold/accounted positions as at least the minimum and maximum declared/achieved revenue over eligible exact sets, with the exact set(s) producing each bound; show the actual current unsold set separately. For 75 spots this can be computed from sorted prices for unconstrained sets, with enumeration only where routing/group constraints matter. Label it **funding frontier**, not fill probability or executable partial-break profit, and retain the do-not-open gate.

### EC2-M3 — Fee arithmetic can still be Ready without transaction-level order value

Section 8.3 has a rich fee-profile schema, but Section 8.2’s formula and launch-ready inputs omit buyer-paid shipping/tax per transaction, seller tax on fees, and uncertainty created by bundling. These can be material across dozens of low-dollar positions because the fixed fee is per transaction.

**Required revision — Act.** Make fee inputs and transaction count/types explicit. A feasibility sketch may use a named conservative fee envelope. Launch-ready conditional economics must either resolve each processing base or show a robust interval; receipt reconciliation replaces estimates only for actuals.

### EC2-M4 — Personal wanted-card utility has an undefined residual-value mode

Section 5.5 says duplicates beyond the useful-copy limit are valued under “the selected market/resale mode,” but personal utility is itself one of the three selected value modes. It does not say whether unwanted cards and excess copies receive zero, market collection value, or net resale value. Different choices can materially change a cap.

**Required revision — Act.** Define wanted-card utility as a composite with an explicit residual mode chosen independently from `{zero, market collection value, net resale}`. Prevent double counting: each useful copy receives either personal incremental utility plus a declared residual value, or a total personal value—state which. Show the decomposition.

### EC2-M5 — Validation studies remain underidentified

**Attack.** The study section adds baselines, strata, confidence intervals, pre-registration, and corrupted advice. It still lacks a target estimand and makes “decision loss/regret” sound directly observable. A pre-elicited limit can change rationally after the tool reveals new evidence. Real auction outcomes are endogenous to competitors and cannot independently validate the cap if ColorBreak influences bids. P90 task time and 90% accuracy gates are uninterpretable without sample size and confidence criteria.

**Required revision — Act.** Split studies:

1. A controlled payoff task with known outcome distributions measures arithmetic errors, limit violations, corrupted-advice deference, and realized/regret loss against an incentive-compatible elicited rule.
2. A field usability study measures end-to-end time, wrong spot, transfer errors, state loss, and refusal under missing evidence; it does not claim causal welfare.
3. A randomized display study estimates precise-cap versus range/distribution effects with declared primary outcome, non-inferiority margin, power, confidence interval, exclusions, multiplicity plan, and no repeated-treatment contamination.
4. Model validation uses held-out products/source revisions and calibration/coverage by evidence class; ColorBreak-influenced closing prices are not independent ground truth.

Define gates on confidence bounds, not observed percentages alone. Retain motive/experience strata and report heterogeneity before pooling.

### EC2-M6 — “Sensitive” has no complete seller-language mapping

Section 6 defines Ready, Sensitive, and blocked for buyer and seller results. Section 8.2’s seller vocabulary omits Sensitive and can therefore collapse a bound-crossing result into clear, miss, or missing assumptions.

**Required revision — Act.** Add literal seller states such as “Target switches within [named fee/cost/hammer bound]” and make the switching assumption primary. “Economics clear target” is available only when robust across the joint feasible set for the chosen basis.

## Minor findings

### EC2-m1 — “Typical” remains a normative label

Median is mathematically clear once ties are repaired, but “Typical” can imply modal or representative outcome in a multimodal distribution. Prefer **Median-value cap** in the saved rule and first-view reason. “Typical” may remain explanatory copy only if comprehension testing distinguishes it from mean and mode.

### EC2-m2 — Rounding must use a declared legal bid domain

A currency tick is not necessarily the platform’s minimum next-bid increment, and Whatnot says increments can increase with current price. The Max Bid field may accept a different domain from swipe increments. Store currency minor unit and verified platform input domain separately. If the legal domain is unknown, floor to currency minor unit and do not claim platform-valid rounding.

---

# Hand-check of the 14 required counterexamples

“Pass” here means the normative text determines the right result; it does not mean code exists.

| # | Spec-level result | Hand-check |
|---:|---|---|
| 1 | **Pass, fixed-cost case** | Manual next bid over cap returns over-cap and cap is invariant. Add variable-cost evaluation and equality/tick fixtures. |
| 2 | **Pass** | Seller-private cost is explicitly noninterfering. Acceptance must test all protected sinks, not headline bytes only. |
| 3 | **Pass** | Buyer-private value is explicitly noninterfering. Same sink caveat. |
| 4 | **Fail as written** | Different loss frequency does not imply a different selected quantile. Replace with explicit equal-mean distributions whose controlling quantiles differ. |
| 5 | **Partial** | Expanded empirical distribution should differ, but no implemented tail-dependent cap rule exists. State the tail statistic and numeric expected result. |
| 6 | **Partial** | Bound crossing maps to Sensitive/no cap, but thin-price bound construction, joint uncertainty, and Monte Carlo tolerance are undefined. |
| 7 | **Fail contract** | Banded resale can distinguish the outcomes, but the algorithm does not require it. The naïve compliant transform above makes them equal. |
| 8 | **Partial** | Exact sets should differ, but “candidate” set selection is not an adverse funding frontier and can be cherry-picked. |
| 9 | **Pass with safety amendment** | Incremental model or explicit refusal is correct. Refusal must immediately evict a stale single-position cap. |
| 10 | **Partial** | Direct fact conflicts block and buyer defaults remain local. Add favorable-old-source and seller-selected-bound cases without an explicit contradiction. |
| 11 | **Pass** | Computed cap may rise; saved hard cap cannot. Test stale-plan UI and serialization as well as numeric output. |
| 12 | **Partial** | Decision materiality is the right criterion, but the lower/upper bound’s owner and joint feasible set are missing. |
| 13 | **Pass** | Artifact consistency mismatch blocks export. Test every artifact and recomputation after edit. |
| 14 | **Pass** | Gross/probability axes are nonnegative; signed metrics retain negative domain and a zero line. |

Current tally: **7 pass or pass-with-amendment, 5 partial, 2 fail.** Before implementation acceptance, every row needs a numeric fixture, exact input schema, expected output/state, and an assertion about provenance/version where relevant.

## Feedback disposition

### Act now

1. Replace fixed `K` subtraction with a hammer-dependent added-cost function and legal-domain solver.
2. Separate seller ask/start/required/assumed/achieved hammers as non-interchangeable types and revise conditional status language by sales mechanic.
3. Make evidence eligibility, freshness, proxy policy, and uncertainty sets engine-owned and versioned; evaluate uncertainty jointly.
4. Specify the Release-A net-resale transform so counterexample 7 has one reproducible answer.
5. Define an adverse funding frontier and actual-unsold-set view.
6. Make the precise-cap experiment an enforceable release flag with a documented fallback.
7. Expand noninterference to serialization, shares, hashes, exports, caches, analytics, workers, and network requests.
8. Repair the quantile convention, tie language, sample-error contract, and counterexamples 4–8.
9. Convert validation thresholds into powered, confidence-bound gates with separate controlled and field estimands.

### Dismiss

1. **Remove all numeric buyer guidance because anchoring is possible.** Dismiss. The hazard requires a comparative gate and fallback, not automatic abandonment.
2. **Invent one universally risk-averse cap.** Dismiss. Named user-owned rules are preferable; no economic theorem selects one for all buyers.
3. **Use rival bids as revealed truth.** Dismiss. In a hybrid-value auction they can reflect private tastes, strategic behavior, or the same anchor.
4. **Restore demand/fill prediction from card value.** Dismiss without seller-specific, out-of-sample predictive evidence.
5. **Call hashes verification or incentive compatibility.** Dismiss. They establish integrity of a payload, not truth of declarations.
6. **Require exhaustive enumeration of all `2^75` unsold sets.** Dismiss. Exact adverse bounds can usually be derived analytically from ordered prices; constrained cases can use auditable optimization.

### Defer deliberately

1. A numeric winner’s-curse adjustment or rival-information model.
2. Seller-specific fill, closing-price, demand-elasticity, and promotion-response prediction.
3. Card-level liquidity and time-to-sale prediction beyond the deterministic banded Release-A transform.
4. A social-welfare or fairness optimizer; preserve spot-level harm visibility instead.
5. Claims that seller declarations are verified identity or that launch graphics increase conversion.

## Marginal-return assessment and residual blockers

Round 2 produced meaningful returns: it found a directionally wrong cap equation, a circular seller status, an under-specified uncertainty set, and two non-executable counterexamples. Another antagonistic round is therefore warranted **after** revision 3, but it should be narrower and fixture-driven rather than another broad ideation pass.

Residual blockers for that round:

1. Does the hammer-dependent cap solver return the highest legal safe bid for fixed, proportional, stepwise, unknown, and interval costs?
2. Can any seller-selected revision, source, bound, featured card, or declaration silently raise a Ready buyer cap?
3. Can an auction plan display clear/miss before realized or explicitly assumed hammers exist?
4. Does every Ready/Sensitive/blocked result arise from one versioned joint uncertainty set including simulation tolerance?
5. Does the resale transform reproduce the one-$100 versus 100-$1 fixture and avoid double-counting personal utility?
6. Does the funding frontier expose adverse unequal-price sets without implying partial opening is allowed?
7. Does a failed anchoring/non-inferiority study mechanically select a non-point fallback?
8. Do all 14 counterexamples have exact numerical fixtures and deterministic expected results?

If revision 3 closes those eight items and a final reviewer can produce only terminology changes or deferred data needs, the expected return from another full seven-perspective review will be insignificant. Until then, the remaining issues are core contract defects, not polish.

## Primary sources relied on

- [Whatnot: Bid on an item during a show](https://help.whatnot.com/hc/en-us/articles/14932924544141-Bid-on-an-item-during-a-show)
- [Whatnot: Troubleshoot shipping costs as a buyer](https://help.whatnot.com/hc/en-us/articles/13889209206925-Troubleshoot-shipping-costs-as-a-buyer)
- [Whatnot: Seller fees](https://help.whatnot.com/hc/en-us/articles/4847069165965-Whatnot-seller-fees)
- [NIST: Quantile reference and estimator definitions](https://www.itl.nist.gov/div898/software/dataplot/refman2/auxillar/quantile.htm)
- [Milgrom and Weber, “A Theory of Auctions and Competitive Bidding” (1982)](https://doi.org/10.2307/1911865)
- [Myerson, “Optimal Auction Design” (1981)](https://doi.org/10.1287/moor.6.1.58)
- [Charness and Levin, “The Origin of the Winner’s Curse” (2009)](https://doi.org/10.1257/mic.1.1.207)
- [Adam et al., “Auction Fever!” (2015)](https://doi.org/10.1016/j.jretai.2015.01.003)
- [Maart-Noelck and Musshoff, “Anchoring effects in an experimental auction” (2015)](https://doi.org/10.1016/j.joep.2015.03.008)
- [Swaroop et al., “Primacy Effect of AI Recommendations” (2024)](https://doi.org/10.1145/3640543.3645206)
