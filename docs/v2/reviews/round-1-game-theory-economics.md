# ColorBreak V2 antagonistic review, round 1 — game theory and economics

Date: 2026-08-13
Artifact reviewed: [PRODUCT-SPEC-v1.md](../PRODUCT-SPEC-v1.md)
Evidence base reviewed: [ColorBreak V2 primary research dossier](../../research/colorbreak-v2-primary-research-2026-08-13.md)

## Review posture

This is intentionally not a usability review. It asks whether the proposed answers remain defensible once users are strategic, values are partly common and partly private, the data-generating process is uncertain, and the app's advice changes the auction it is trying to help users navigate.

The two perspectives below are separate:

1. The **game-theory review** attacks mechanism assumptions, strategic response, information asymmetry, and incentive compatibility.
2. The **economics review** attacks welfare semantics, risk measurement, valuation, profit/fill modeling, false precision, and the validity of the proposed studies.

Severity means:

- **Critical:** a core recommendation can be directionally wrong, strategically self-defeating, or misleading even when the implementation matches the draft.
- **Major:** the result may be useful, but an important class of ordinary users can misread it or receive an invalid comparison.
- **Minor:** terminology, boundary behavior, or a deferred issue that should not block the first testable release.

Recommendations use **Act**, **Dismiss**, or **Defer**. “Act” means revise the next specification; it does not mean every mitigation belongs in the first code slice.

## Executive verdict

The product split and the rejection of mean-EV-only advice are sound. The draft is not yet safe to implement as a “truth engine,” however. Its most important quantities—bid ceiling, Balanced risk, expected net, expected fill, and break-even fill—do not yet have stable economic semantics. The draft also treats a seller-supplied model as neutral information despite the seller's direct incentive to select optimistic assumptions and persuasive graphics.

The minimum acceptable revision should:

1. Replace “max next bid” with a **total platform Max Bid cap** rounded down to a legal increment, while separately showing whether the *next available bid* fits under it.
2. Define a buyer ceiling as a user-owned **certainty-equivalent/value rule**, not an unexplained blend of median and mean, and keep private utility separate from modeled resale proceeds.
3. Model a break as a **hybrid private/common-value auction** and explicitly state what ColorBreak does—and does not—condition on when the buyer wins.
4. Make seller links adversarially robust: source-owned evidence is immutable, seller assertions are labeled individually, and buyers begin from independent defaults rather than seller-selected realization or risk assumptions.
5. Replace scalar fill metrics for unequal spots with revenue-contingent fill frontiers and explicit unsold-spot sets; remove “expected fill” until a validated seller-specific model exists.
6. Propagate price, collation, condition, fee, tax, shipping, and realization uncertainty through results and round displayed decisions to a resolution justified by those uncertainties.
7. Pre-register incentive-compatible buyer and seller studies with comparison baselines, confidence intervals, decision-quality outcomes, and anti-automation-bias measures.

Without these changes, the app can be fast and comprehensible while still making users confidently wrong.

---

# Perspective 1: antagonistic game theorist

## Critical findings

### GT-C1 — “Max next bid” conflates a valuation cap with an action in an ascending auction

**Attack.** Sections 5.3–5.6 call the result “max next bid” and define the ceiling as the maximum hammer after costs. Whatnot's Max Bid is a **total maximum bid**, while the user's immediate feasible action is the platform's next increment. Those are not interchangeable. In an ascending/proxy auction, a bidder can enter a private total cap and pay less; saying “additional hammer amount” can be read as either the next bid, an increment, or the total hammer.

The draft also defines `Bid` as current all-in being at or below the ceiling. That is insufficient: the current price can be below the ceiling while the next legal bid is above it. Conversely, entering a total proxy cap at the ceiling does not mean the buyer expects to pay the ceiling.

**Falsifiable failure scenario.** Let the total hammer ceiling be $31, current hammer $30, and next legal bid $32. The draft's rule returns `Bid` because current all-in is within the ceiling, but there is no permissible bid the buyer should place. In a second test, the UI labels $31 “max next bid”; a participant types $31 as an *increment* rather than a total cap. One such induced overbid is a critical failure.

**Recommendation: Act.** Specify three distinct outputs:

- **Your total Max Bid:** a total hammer cap, rounded down to an actually accepted platform amount.
- **Next bid:** the current platform-required total bid, entered by the user or inferred only from a verified increment table.
- **Action:** `Bid` only when next bid ≤ total cap; otherwise `Pass`. If no next-bid amount is known, say `Cap $X` rather than instructing `Bid`.

All-in-at-cap and all-in-if-won-now must remain distinct. Add invariant tests for equality, increment crossing, shipping thresholds, taxes, and currency rounding. Whatnot's own documentation distinguishes incremental swiping from entering Max Bid and says the platform bids incrementally up to the user's maximum ([Whatnot bidding mechanics](https://help.whatnot.com/hc/en-us/articles/14932924544141-Bid-on-an-item-during-a-show)).

### GT-C2 — A public numeric recommendation is an anchor and can change the market it models

**Attack.** The specification treats the ceiling as a passive estimate. It is also an intervention. If sellers use Seller Studio's price targets and buyers use Bid Check's ceilings from the same model, ColorBreak can create a public focal price. The seller can set starts just below a displayed ceiling; buyers can converge on it; then auction outcomes are no longer independent evidence that the ceiling was correct.

Experimental auction research reports that arousal under human competition can raise bids and that exogenous anchors and prior bids can alter later bidding. The dossier cites the former ([Adam et al., 2015](https://doi.org/10.1016/j.jretai.2015.01.003)); an extra-laboratory common-value auction experiment found presented anchors and previous bids affected bidding ([Maart-Noelck and Musshoff, 2015](https://doi.org/10.1016/j.joep.2015.03.008)). An AI-assisted decision experiment cited by the dossier found answer-first advice improved speed but increased overreliance ([Swaroop et al., 2024](https://doi.org/10.1145/3640543.3645206)).

**Falsifiable failure scenario.** Randomly assign otherwise identical prepared buyers to (A) a precise cap, (B) a cap interval plus value rationale, or (C) the same distribution without a recommendation. If group A's bids cluster significantly around the shown cap, exceed participants' pre-elicited willingness to pay more often, or show worse realized utility without better allocation, the recommendation is altering rather than merely revealing value.

**Recommendation: Act.** Treat anchoring as a product hazard:

- Elicit personal value/risk rule before showing the computed cap in Prepare.
- Never use current auction price, seller start, prior closing bids, or seller-suggested prices as evidence of a buyer's underlying value unless explicitly modeled as an informational signal.
- Never feed ColorBreak-influenced closing prices back into validation as independent proof.
- In research, compare precise cap, conservative range, and distribution-only treatments; record calibration and overreliance, not only speed.
- Keep seller targets private by default and exclude the buyer ceiling from seller exports.

Do **not** dismiss this because users ask for a number. A useful action aid can still be a causal market input.

### GT-C3 — Seller-authored assumptions are not incentive compatible

**Attack.** Sections 3.3 and 6.5 allow a seller link to preload the model and merely label it “Assumptions supplied by seller.” That disclosure does not align incentives. A seller benefits when the selected product mapping, routing rules, missing-price treatment, condition, realization, or chase framing raises perceived value. The seller bears only part of the buyer's downside. “Can edit locally” is not protection during a ten-second decision.

Mechanism design starts from the fact that a participant may strategically report private information. Myerson's original auction-design formulation makes incentive constraints part of the mechanism rather than assuming truthful reports ([Myerson, 1981](https://doi.org/10.1287/moor.6.1.58)). ColorBreak is not designing Whatnot's auction, but the lesson applies: a seller declaration is not evidence merely because it is structured.

**Falsifiable failure scenario.** Construct two seller links for the same physical break. Link A uses exact independent defaults. Link B uses a plausible but optimistic proxy product, 100% realization, favorable unrouted-card treatment, and a chase-forward graphic. If B can produce a higher buyer cap without an unavoidable first-viewport `No verdict` or itemized conflict, the bridge is strategically exploitable.

**Recommendation: Act.** Partition every input by provenance:

- **Source-owned facts:** exact product contents, card printings, observed market records, platform fees, and timestamp. Seller cannot overwrite these; a mismatch is a conflict.
- **Seller declarations:** actual products in hand, routing, bulk, assignment, shipping, fulfillment, and fixed contents. Each is individually labeled and versioned.
- **Buyer choices:** realization, personal utility, costs, and risk rule. These never travel from seller to buyer as defaults.

Shared links should include a content hash, seller-declaration version, and a diff against ColorBreak's current independent defaults. Material optimistic conflicts should produce `No verdict`, not merely `Caution`. Seller-generated graphics must be generated from the same locked declarations and include denominators. This is an **Act**, not a request for a meaningless “verified seller” badge.

### GT-C4 — The seller optimizer lacks a declared social objective and enforceable constraints

**Attack.** Section 6.4 offers “Highest margin,” “Easiest to fill,” “Most balanced,” and “More chase visibility.” This is not yet an optimization problem. It lacks objective functions, feasibility constraints, tie-breaking rules, and a definition of buyer harm. A Pareto label is meaningless until the dimensions are defined. A revenue-maximizing seller can exploit the same behavioral biases Bid Check is supposed to protect buyers from.

Myerson shows that seller-optimal mechanism design depends on bidder-value distributions and incentive constraints, neither of which ColorBreak observes ([Myerson, 1981](https://doi.org/10.1287/moor.6.1.58)). Milgrom and Weber show auction outcomes depend on the information/value structure and affiliation assumptions ([Milgrom and Weber, 1982](https://doi.org/10.2307/1911865)). Therefore “highest margin” cannot be inferred from card-value simulations alone, and “easiest to fill” cannot be inferred without demand.

**Falsifiable failure scenario.** Give the optimizer a format where one weak spot has a 90% chance of returning under 10% of its suggested price while a chase spot carries the plan. If “Highest margin” or “More chase visibility” is still recommended because total expected revenue meets target, despite no evidence that the weak spot will sell and no prominent buyer-downside disclosure, the optimizer launders harm through aggregation.

**Recommendation: Act.** In the next spec, define a constrained scenario engine rather than an optimizer:

- Inputs are auditable candidate formats, not inferred demand.
- Outputs are deterministic **what-if** consequences under user-entered prices.
- No “easiest to fill,” “expected fill,” “highest margin,” or recommended start is allowed without seller-specific demand evidence and out-of-sample validation.
- Hard constraints include complete rule evidence, platform policy, no hidden buyer class with negative modeled surplus under the declared rule, explicit concentration limits, and no selective probability framing.
- “More chase visibility” is a presentation variant, not an economic scenario; it cannot alter the price recommendation or omit base-rate/downside information.

Defer any automated price optimization until demand data and a welfare policy exist.

## Major findings

### GT-M1 — Winner's curse is invoked correctly as a warning but not operationalized as a model

**Attack.** Section 5.5 acknowledges risk but never specifies whether a break is private value, common value, or affiliated value. It is a hybrid:

- pulled cards and their resale proceeds contain a common-value component;
- color preference, deck need, collecting utility, entertainment, and seller trust are private components;
- each bidder may possess a noisy signal about market prices, product mapping, demand, or seller conduct;
- dropout prices in an ascending auction can reveal others' signals.

Winner's curse is not simply “the item is random” or “the mean is skewed.” It is adverse selection conditional on winning when others' information is relevant. Charness and Levin find persistent difficulty with contingent reasoning even in simplified winner's-curse problems ([Charness and Levin, 2009](https://doi.org/10.1257/mic.1.1.207)). English common-value experiments find bidders use dropout information, though behavior can still depart from Nash predictions ([Levin, Kagel, and Richard, 1996](https://www.jstor.org/stable/2118215)).

**Falsifiable failure scenario.** Participants receive independent noisy signals about a shared resale value. Compare a ceiling based only on ColorBreak's unconditional estimate with one that explicitly tells users that winning against informed bidders may be bad news. If the unconditional group systematically pays above ex-post resale value, the model's “defensible” label is false for that environment.

**Recommendation: Act.** State the model boundary: ColorBreak estimates the pull distribution and a market-value distribution but does not infer rival signals from live bids. Add a first-viewport caveat only when a material common-value uncertainty remains: “This cap ignores information other bidders may have.” Never raise the model value because others bid more. Treat suspiciously high competition as neither validation nor a reason to chase. Research the size of this effect in actual Magic breaks before implementing a numeric winner's-curse discount.

### GT-M2 — Repeated and multi-spot purchases make value portfolio-dependent

**Attack.** The draft speaks as if every spot has a stand-alone ceiling. In random remaining-color breaks and repeat purchases, marginal value changes with the buyer's existing exposure. Without-replacement assignment, bundled shipping, fixed per-transaction costs, duplicate utility, and diversification all matter. A user's second random spot does not generally have the same distribution or certainty equivalent as the first.

**Falsifiable failure scenario.** Six colors remain. A buyer already owns one random spot and considers a second; assignments are without replacement and shipping does not increase. If the app returns the same cap as for a buyer with no position, despite a different outcome distribution and marginal shipping, the ceiling is not a marginal willingness-to-pay measure.

**Recommendation: Act.** Add “positions already owned in this break,” assignment dependence, and incremental shipping/tax semantics to the domain model. Compute the distribution of the **incremental portfolio**, not another isolated spot. If V2 Release A only supports one purchase, say so explicitly and suppress a recommendation for repeat/random portfolio cases rather than silently reuse the one-spot cap.

### GT-M3 — The engine assumes strategic independence between seller and buyer workspaces

**Attack.** “One truth engine” sounds coherent but can collapse information boundaries. Buyer welfare and seller revenue are different objective functions. A seller's acquisition cost is irrelevant to buyer value; a buyer cap is commercially valuable to a seller; seller optimization inputs can reveal private targets. Shared code is desirable, shared objectives and data are not.

**Falsifiable failure scenario.** Change seller acquisition cost while holding product, buyer rules, price evidence, and buyer preferences fixed. Any change to buyer ceiling or risk display is a failure. Change buyer personal cap; any change to a seller scenario or generated launch asset is a privacy and strategy failure.

**Recommendation: Act.** Specify noninterference invariants between domains. Share only composition, routing, collation, and public evidence. Maintain separate buyer and seller evaluators, cache keys, persistence, and share schemas. Add property tests proving private seller variables cannot affect buyer results and private buyer variables cannot affect seller results.

## Minor findings

### GT-m1 — “Incentive compatible” should not be claimed for the product

**Attack.** The requested review topic includes incentive compatibility, but V2 cannot make Whatnot's auction or seller disclosure strategy-proof. At most it can make optimistic manipulation observable and reduce its payoff.

**Falsifiable failure scenario.** A seller can still benefit from truthfully selecting a more favorable but policy-compliant break format or withholding the link entirely. That alone disproves a broad incentive-compatibility claim.

**Recommendation: Act on wording; Defer mechanism claims.** Use “provenance-preserving” and “manipulation-evident,” not “incentive compatible,” unless a later mechanism is formally specified and tested.

### GT-m2 — “Conditional” is not a strategy

**Attack.** “Conditional” currently groups chase preference and personal value. It does not state a condition the auction action can test.

**Falsifiable failure scenario.** In a five-second task, participants interpret Conditional variously as “bid once,” “wait,” “ask the seller,” or “bid only if cheap.”

**Recommendation: Act.** Replace with the literal condition, e.g. “Pass for resale; within your cap only if you personally value this color at +$8.” If the condition is not already satisfied in the user's saved profile, do not issue an action verb.

---

# Perspective 2: antagonistic economist specializing in auctions and decision-making

## Critical findings

### EC-C1 — The three risk stances are arbitrary utility functions disguised as neutral presets

**Attack.** “Protect downside” uses an unspecified conservative anchor; “Balanced” is a “documented blend” of median and expected value; “Chase upside” allows a higher ceiling. A linear blend of median and mean has no established welfare interpretation. It can violate intuitive consistency across distributions and makes the product designer—not the buyer—the author of risk appetite.

Prospect theory demonstrates that observed choices depend on reference points and nonlinear weighting rather than mean value alone, but it does not justify any particular median/mean blend ([Kahneman and Tversky, 1979](https://doi.org/10.2307/1914185)). Nor does descriptive bias become a normative bidding rule. Ambiguity about the model is also distinct from risk within a known distribution; the classic Ellsberg setup demonstrates behavior that cannot be represented by simply choosing a different percentile of one known lottery ([Ellsberg, 1961](https://doi.org/10.2307/1884324)).

**Falsifiable failure scenario.** Distribution A is a certain $20. Distribution B is $0 with 50% probability and $40 with 50%; both have median conventions that can differ by implementation and the same mean. Distribution C moves 1% probability from $0 to $1 without changing the displayed P10/P50/P90. If the “Balanced” cap ranks these in an unexplained or non-monotone way, or if materially different distributions get the same cap, the label has no stable meaning.

**Recommendation: Act.** Define explicit value rules and let the buyer own them:

- **Resale-neutral:** expected *net realizable proceeds*, with no claim of safety.
- **Loss-frequency cap:** highest price for which `Pr(net proceeds < all-in)` is below a user-chosen threshold.
- **Downside cap:** a stated lower quantile or expected shortfall rule.
- **Personal-value cap:** resale rule plus explicit user-authored utility, kept separate in the display.

If simplified presets remain, publish their exact rule, worked counterexamples, monotonicity/invariance properties, and sensitivity. Rename “Balanced”—which implies endorsement—to the mathematical rule. Do not create “Chase” by moving the price toward the mean; show the tail and ask for an explicit entertainment/personal-value budget.

### EC-C2 — “Expected fill” is unsupported, while scalar break-even fill is undefined for unequal spots

**Attack.** Section 6.1 requires expected fill; sections 6.2–6.3 call recommendations “never fill predictions” and forbid inventing fill probability without historical data. Both cannot be true. Further, at pick-your-color prices, `80% filled` is not an economic state. Profit depends on **which** spots sell, their prices, transaction grouping, and what happens to unsold cards. A count or percentage destroys the variable that determines revenue.

**Falsifiable failure scenario.** A ten-spot break has two $100 spots and eight $10 spots. At 80% fill, revenue is either $80 (only cheap spots sell) or $260 (both expensive plus six cheap spots), before fees. If the app shows one profit number for 80%, it must be wrong for at least one ordinary fill composition. For random flat-price breaks, test whether a break can legally/operationally proceed with unsold assignments and who receives those cards; if not, “70% fill profit” is not a runnable outcome.

**Recommendation: Act.** Remove expected fill from the first result until seller-specific demand estimates exist. Replace scalar break-even fill with:

- required gross revenue;
- for flat-priced spots, the minimum sold count under explicit fee/shipping assumptions;
- for unequal spots, a **break-even frontier** and named unsold-set scenarios: weakest-demand-first, highest-revenue-unsold, seller-selected, and every feasible set when the spot count is small;
- operational status: can run, must cancel/restructure, or seller retains unsold assignments;
- explicit treatment of sunk product cost, cancellation/refund cost, and unsold card ownership.

Label all rows “what if these spots sell,” never probabilities, until calibrated historical models pass out-of-sample gates.

### EC-C3 — Model uncertainty is labeled but not propagated, creating false precision

**Attack.** The draft separates evidence confidence from outcome risk, but its decision math only displays the simulated pull distribution conditional on one chosen model. P10/median/P90 do not include uncertainty about collation, card condition, missing prices, thin sales, seller routing compliance, realization, fees, shipping, taxes, or future market movement. A `Caution` badge beside a precise $31.47 ceiling does not make that number economically cautious.

TCGplayer says Market Price is derived from recent transactions and distinguishes it from live listing measures; it does not promise liquidation at that amount ([TCGplayer Market Price](https://help.tcgplayer.com/hc/en-us/articles/213588017-TCGplayer-Market-Price), [TCGplayer price-point definitions](https://help.tcgplayer.com/hc/en-us/articles/222376867-What-do-the-different-price-points-on-TCGplayer-com-mean)). Wizards' own product explanations say booster structures and slot configurations vary by set ([Wizards on Play Boosters](https://magic.wizards.com/en/news/making-magic/what-are-play-boosters)). Simulation precision cannot cure model misspecification.

**Falsifiable failure scenario.** A $100 card with two thin sales drives the P90. Apply plausible condition/fee/shipping realizations of 55–85%. If the primary ceiling is unchanged and still shown to cents, despite a recommendation reversal across those assumptions, evidence confidence is cosmetic. Separately, run the same model at two Monte Carlo seeds; if the displayed cap changes, the app is exposing sampling noise.

**Recommendation: Act.** Introduce an uncertainty budget:

- Pull randomness and parameter/model uncertainty are reported separately.
- Missing or disputed material parameters produce a sensitivity interval or `No verdict`.
- Price distributions use volume/age/dispersion when available; thin or missing markets never inherit the same confidence as liquid cards.
- Monte Carlo reports convergence/error and uses deterministic seeds for repeatability; analytic quantities replace simulation where possible.
- The cap rounds **down** to platform-relevant increments and no finer than model support. Percentages use whole points unless sample/model quality supports more.
- A verdict is allowed only if it is stable across the declared plausible parameter set; otherwise state the exact switching assumption.

### EC-C4 — A scalar realization haircut is not a resale model

**Attack.** A user-authored realization percentage is better than calling market observations cash, but multiplying every card by one percentage assumes identical liquidity, fees, condition loss, postage, minimum viable listing value, and time-to-sale. Bulk cards often have zero marginal cash value; a chase may realize differently from dozens of low-value cards. Correlation matters: one expensive card is not economically equivalent to 100 cards each notionally worth 1% as much.

**Falsifiable failure scenario.** Compare two modeled outcomes with $100 TCG Market total: (A) one liquid $100 card; (B) 100 $1 cards. Under a flat 70% realization both become $70. If actual selling requires 100 listings, postage, fixed fees, and unsold inventory, their net proceeds and buyer utility are nowhere close.

**Recommendation: Act.** Separate three modes:

- **Collection value:** observed card-market total, not cash.
- **Net resale proceeds:** card-level or value-band realization, selling fees, fixed transaction/listing costs, shipping/materials, condition, and a time horizon.
- **Personal utility:** user-authored, never called realization.

For Release A, use conservative value bands (bulk floor, low-value, liquid mid, chase) and show sensitivity rather than pretending to know card-level liquidation. Defer a sophisticated liquidity model until source data and validation exist.

## Major findings

### EC-M1 — Expected value and distribution are still not connected to a coherent decision target

**Attack.** The draft displays P10/P50/P90 and makes mean secondary, but three quantiles can hide most of a multimodal or highly discrete distribution. P10 is not “maximum downside,” P90 is not “maximum upside,” and chance-to-clear is undefined unless “clear” names a net outcome and time horizon. Two distributions can share all four headline statistics and have materially different loss severity.

**Falsifiable failure scenario.** Construct two spot distributions with identical P10/P50/P90/mean, but one has a 9% chance of $0 and 1% chance of a huge loss after disposal costs while the other has bounded downside. If the same cap and risk sentence appear, the summary is insufficient for the decision rule.

**Recommendation: Act.** Tie the display to the selected rule. If the rule is loss frequency, show `x in 20 net less than cost` and average shortfall when losing. If it is downside, show the actual lower-tail statistic. Reserve “upside” for outcomes above a named threshold. Expanded evidence should expose the full empirical CDF or histogram and point mass at zero. The dossier already supports frequencies plus percentages and warns that no single risk graphic is universally best.

### EC-M2 — Buyer all-in cost omits economically material marginal-cost cases

**Attack.** The draft includes incremental shipping and modeled tax, but a Whatnot purchase can interact with bundled shipping, tax jurisdiction, coupons/credits, existing orders, per-order caps, and fees included in total order value. Seller fee calculations also distinguish transaction from shipment. One “shipping” field cannot serve first purchase, next purchase, and total-order allocation simultaneously.

Whatnot says buyers pay shipping and taxes in addition to hammer and that seller payment processing can be based on total order value ([Whatnot bidding](https://help.whatnot.com/hc/en-us/articles/14932924544141-Bid-on-an-item-during-a-show), [Whatnot seller fees](https://help.whatnot.com/hc/en-us/articles/4847069165965-Whatnot-seller-fees)).

**Falsifiable failure scenario.** A buyer already hit the show's shipping cap, so the next spot has $0 marginal shipping, but the app carries forward $4.25 and says Pass. In the opposite case, the buyer enters $0 because prior items bundle but this item changes package class, and the app says Bid. Both are directionally wrong.

**Recommendation: Act.** Rename the buyer field **additional cost if this wins**, with components for marginal shipping, tax mode, and other known charges. Preserve a saved default but require acknowledgment when bundle state is unknown and costs can flip the verdict. The seller model separately needs transaction and shipment grouping scenarios; never reuse the buyer field.

### EC-M3 — “Expected net” and “margin” use the wrong certainty language

**Attack.** Seller net from a user-entered selling plan is not expected net unless closing-price and fill distributions are estimated. It is projected net under a scenario. The app can calculate fee arithmetic exactly under declared hammers but cannot infer demand or closing prices from card EV.

**Falsifiable failure scenario.** Enter target prices totaling $1,000 with no sales history. If the app labels the resulting profit “expected,” ask ten sellers whether they infer a probability-weighted forecast. If a material fraction does, wording creates false authority.

**Recommendation: Act.** Use **planned net at these prices** and a deterministic reconciliation. Reserve “expected” for a documented predictive distribution with calibration data. “Run” should become “Plan clears your target if the named sales conditions occur.” This also makes later plan-versus-actual variance honest.

### EC-M4 — Scenario ranking can hide distributional harm behind aggregate buyer value

**Attack.** Showing a weakest-slot warning is necessary but not sufficient. Aggregate buyer EV can be nonnegative while most buyers lose and one chase spot captures the surplus. “Most balanced” needs a balance metric and can still be manipulated by pooling or splitting categories.

**Falsifiable failure scenario.** Repartition the same cards from six colors into five spots by combining the weakest color with a chase color. If the “balance” score improves solely because labels changed while individual assignment risk or price burden worsens, the metric is gameable.

**Recommendation: Act.** Publish scenario metrics and invariants: distribution of buyer surplus by spot, loss frequency, worst lower-tail shortfall, value concentration, and no worsening hidden by regrouping. Show all spot-level deltas for any recommendation. Treat equity/fairness as a constraint or explicit objective, not a decorative score. Defer the label “non-dominated” until dominance dimensions and tolerances are formally specified.

### EC-M5 — Proposed research gates measure comprehension and speed, not decision quality

**Attack.** Sections 10.1–10.2 could ship a confidently harmful recommender. Participants can find a cap in three seconds and accurately repeat its reason while blindly following it. Thresholds lack sample sizes, uncertainty intervals, baseline comparison, preregistered exclusions, auction incentives, experience strata, or protection against repeated measures and learning. A p90 estimate is especially unstable in a small usability sample.

**Falsifiable failure scenario.** A treatment reaches 95% recommendation identification and 2.5-second median time but causes more bids above pre-elicited willingness to pay, more negative realized surplus, or greater deference after intentionally corrupted advice than the no-recommendation baseline. The current gates still pass it.

**Recommendation: Act.** Split evaluation into:

1. **Usability:** task completion, time, input loss, viewport stability, and comprehension.
2. **Economic validity:** decision loss/regret against the participant's preregistered value rule, cap violations, expected and realized net surplus, sensitivity to intentionally wrong advice, and calibration of predicted frequencies.
3. **Strategic behavior:** clustering at the recommendation, response to rival bids, repeat-purchase behavior, and seller selection of optimistic assumptions.
4. **Seller forecast validity:** planned-versus-actual revenue/net error and interval coverage, evaluated out of sample and never on ColorBreak-influenced prices as if independent.

Use active buyers/sellers, real monetary stakes or incentive-compatible payoff tasks, a V1/no-tool baseline, randomized display treatments, confidence intervals, and a preregistered stopping rule. Report results by buyer motive and experience; do not pool until heterogeneity is assessed.

### EC-M6 — “Run / Reprice / Change mix / Do not run” exceeds the available evidence

**Attack.** These verbs sound like business recommendations, but the engine observes costs and card-side modeled value—not audience size, seller reputation, schedule, show retention, competing shows, bidder budgets, trust, or historical price elasticity. Those omitted variables can dominate fill and closing price.

**Falsifiable failure scenario.** Two sellers enter identical break economics. One has 2,000 regular viewers and the other is new with no audience. If both receive `Run`, the recommendation is not a viability forecast; if the app invents an audience adjustment without data, it is false precision.

**Recommendation: Act.** Until demand evidence exists, output **Economics clear target / Economics miss target / Missing sales assumptions**, followed by conditional actions. Let experienced sellers supply demand scenarios without calling them predictions. Defer seller-specific `Run` until historical forecasts demonstrate useful discrimination and calibration.

## Minor findings

### EC-m1 — “Chance-to-clear” and “break-even” need named denominators

**Attack.** The terms can refer to card market total, net liquidation, hammer, all-in, target margin, total revenue, or sold spots.

**Falsifiable failure scenario.** In comprehension testing, ask users “clear what?” If answers differ, the metric is not first-viewport-ready.

**Recommendation: Act.** Use literal labels: “Chance modeled net resale exceeds your $24 all-in,” “Gross revenue needed to recover declared costs,” and “Minimum flat-price spots if each sells at $X.”

### EC-m2 — The spec needs currency/time and discounting boundaries

**Attack.** Market observation date is required, but decision date, currency, time-to-sale, and price changes between preparation and auction are not fully specified. At short horizons discounting is small, but liquidity and market drift are not.

**Falsifiable failure scenario.** A saved cap prepared before a set release or ban announcement appears live weeks later with only a subtle age label and no recomputation.

**Recommendation: Act for staleness; Defer formal discounting.** Expire verdicts after source-specific freshness limits and force an explicit stale state when material prices or rules changed. A time-value-of-money model can wait; a resale time horizon cannot.

### EC-m3 — Zero is not the only economically feasible lower bound

**Attack.** Fixing negative chart axes is correct for card gross value and probability, but net proceeds or profit can legitimately be negative because of shipping, supplies, fees, disposal, and sunk costs.

**Falsifiable failure scenario.** A net-profit chart clamps a genuine −$12 scenario to zero after a global “no negative axes” implementation.

**Recommendation: Act.** Specify domain bounds per variable. Probability and gross card value start at zero; net surplus/profit axes may be negative and must show a zero reference line. The Chase Map's impossible negative coordinates are a chart-domain bug, not a universal economics rule.

---

# Disposition matrix

| ID | Severity | Recommendation | Next-spec disposition |
|---|---|---|---|
| GT-C1 | Critical | Act | Define total Max Bid, next legal bid, increment crossing, and all-in-at-cap separately |
| GT-C2 | Critical | Act | Add anchoring/feedback safeguards and experimental treatment |
| GT-C3 | Critical | Act | Add per-field provenance, immutable independent evidence, seller/buyer assumption separation |
| GT-C4 | Critical | Act + partial defer | Replace optimizer with constrained what-if engine; defer demand optimization |
| GT-M1 | Major | Act | Declare hybrid-value boundary; do not infer value from rival bids |
| GT-M2 | Major | Act | Model marginal portfolio value or explicitly exclude repeat purchases |
| GT-M3 | Major | Act | Add buyer/seller noninterference invariants |
| GT-m1 | Minor | Act wording + defer | Claim manipulation evidence, not incentive compatibility |
| GT-m2 | Minor | Act | Replace abstract Conditional with its literal condition |
| EC-C1 | Critical | Act | Replace mean/median blends with explicit user-owned decision rules |
| EC-C2 | Critical | Act | Remove unsupported expected fill; model revenue/unsold-set frontiers |
| EC-C3 | Critical | Act | Propagate model uncertainty and round to supported resolution |
| EC-C4 | Critical | Act | Replace scalar realization with value-band net-resale model |
| EC-M1 | Major | Act | Tie risk summary to decision target and lower-tail severity |
| EC-M2 | Major | Act | Model marginal purchase costs and bundle uncertainty |
| EC-M3 | Major | Act | Rename unsupported expectations as conditional plans |
| EC-M4 | Major | Act | Define buyer-surplus and balance metrics; expose all spot deltas |
| EC-M5 | Major | Act | Add incentive-compatible validity studies and baselines |
| EC-M6 | Major | Act + defer | Use conditional economics labels; defer viability predictions |
| EC-m1 | Minor | Act | Make every denominator and threshold literal |
| EC-m2 | Minor | Act + defer | Enforce staleness now; defer financial discounting |
| EC-m3 | Minor | Act | Define non-negative versus signed chart domains by measure |

## Feedback to dismiss

The following plausible responses to this review should be rejected:

1. **“The precise cap is harmless because the user chose a risk preset.”** Dismiss. The preset is not yet a preference elicitation instrument, and the displayed number can still anchor action.
2. **“A caution badge solves uncertain prices.”** Dismiss. A badge does not propagate uncertainty or reveal whether the verdict changes under plausible assumptions.
3. **“Break-even fill is only illustrative.”** Dismiss unless the exact unsold set and operational state are named. A scalar percentage is mathematically non-identifying for unequal prices.
4. **“Seller-supplied is enough disclosure.”** Dismiss. Under severe time pressure, provenance must change defaults and verdict availability, not merely add prose.
5. **“P10/P50/P90 is the distribution.”** Dismiss. These are three summaries and do not identify tail severity, multimodality, or model uncertainty.
6. **“Whatnot is English-like, so truthful value bidding is always optimal.”** Dismiss. That conclusion needs independent private values and mechanism assumptions that a hybrid resale/private-value break does not satisfy.

## Feedback to defer deliberately

1. A formal numeric winner's-curse adjustment: research actual bidder information first.
2. Automated demand, fill, and price elasticity prediction: require seller history and out-of-sample validation.
3. A fully card-specific liquidation model: start with conservative value bands and sensitivity.
4. Claims of incentive compatibility: the practical goal is provenance and manipulation evidence.
5. Formal time discounting: first define resale horizon and liquidity.

## Required counterexample and gate suite for revision 2

The next specification should include acceptance cases before implementation:

1. Current price is under cap but next increment is over cap → `Pass`, total cap unchanged.
2. Same model, seller cost changes → buyer result unchanged.
3. Same model, buyer personal premium changes → seller plan unchanged.
4. Same expected value, different loss frequency/severity → risk result differs according to the named rule.
5. Same P10/P50/P90/mean, different lower tails → expanded risk and any tail-sensitive cap differ.
6. Thin chase price changes across plausible realization → verdict becomes sensitivity/No verdict if sign changes.
7. One $100 card versus 100 $1 cards → net-resale model does not treat them as equivalent cash.
8. Unequal-price plan at 80% fill with different unsold sets → distinct revenue/profit rows.
9. Repeat random spot with bundled shipping and without-replacement allocation → incremental distribution and cost update.
10. Optimistic seller link conflicts with independent product evidence → unavoidable itemized conflict and no inherited buyer risk/realization defaults.
11. Precise-cap experiment shows harmful anchoring or corrupted-advice overreliance → precise answer-first design fails regardless of speed.
12. Predicted pull/value frequencies fail coverage or calibration across held-out products → no confident recommendation for that evidence class.

## Primary sources used in this review

- [Whatnot: Bid on an item during a show](https://help.whatnot.com/hc/en-us/articles/14932924544141-Bid-on-an-item-during-a-show)
- [Whatnot: Seller fees](https://help.whatnot.com/hc/en-us/articles/4847069165965-Whatnot-seller-fees)
- [TCGplayer: Market Price](https://help.tcgplayer.com/hc/en-us/articles/213588017-TCGplayer-Market-Price)
- [TCGplayer: price-point definitions](https://help.tcgplayer.com/hc/en-us/articles/222376867-What-do-the-different-price-points-on-TCGplayer-com-mean)
- [Wizards of the Coast: What Are Play Boosters?](https://magic.wizards.com/en/news/making-magic/what-are-play-boosters)
- [Milgrom and Weber, “A Theory of Auctions and Competitive Bidding” (1982)](https://doi.org/10.2307/1911865)
- [Myerson, “Optimal Auction Design” (1981)](https://doi.org/10.1287/moor.6.1.58)
- [Charness and Levin, “The Origin of the Winner's Curse” (2009)](https://doi.org/10.1257/mic.1.1.207)
- [Levin, Kagel, and Richard, “Revenue Effects and Information Processing in English Common Value Auctions” (1996)](https://www.jstor.org/stable/2118215)
- [Kahneman and Tversky, “Prospect Theory” (1979)](https://doi.org/10.2307/1914185)
- [Ellsberg, “Risk, Ambiguity, and the Savage Axioms” (1961)](https://doi.org/10.2307/1884324)
- [Adam et al., “Auction Fever!” (2015)](https://doi.org/10.1016/j.jretai.2015.01.003)
- [Maart-Noelck and Musshoff, “Anchoring effects in an experimental auction” (2015)](https://doi.org/10.1016/j.joep.2015.03.008)
- [Swaroop et al., “Primacy Effect of AI Recommendations” (2024)](https://doi.org/10.1145/3640543.3645206)

## Round-2 questions

1. Can every buyer action be derived from a named user-owned value rule, or does any designer preference remain hidden in a preset?
2. Does the buyer verdict stay invariant to seller costs, starts, targets, and private assumptions?
3. Does a seller link ever increase a cap merely by selecting a favorable default the buyer did not choose?
4. For unequal spots, can every profit/fill number name the exact sold/unsold set or revenue assumption that generated it?
5. Is every `expected` label supported by a probability model validated out of sample?
6. Does the recommendation remain stable across plausible model parameters; if not, is the switching assumption the primary result?
7. Could a seller scenario increase margin only by increasing buyer loss frequency, hidden concentration, or persuasive framing?
8. Would the product still pass if the study measured appropriate refusal of intentionally bad recommendations rather than only speed and recall?
