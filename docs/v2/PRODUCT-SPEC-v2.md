# ColorBreak V2 product specification — revision 3 (final)

Date: 2026-08-13
Status: Approved for implementation after three review rounds and mechanical re-audit
Supersedes: `PRODUCT-SPEC-v1.md`
Inputs: primary research dossier and `ROUND-1-ADJUDICATION.md`

## 1. Product boundary

ColorBreak V2 is two products sharing product/collation/price evidence while preserving private economic boundaries:

- **Bid Check** prepares the buyer treatment selected by the safety gate: a precise modeled cap, a conservative modeled range, or a buyer-authored hard cap beside the outcome distribution; it compares an optional next hammer only under that treatment's contract.
- **Seller Studio** calculates conditional break economics, validates launch readiness against a dated ruleset, and generates revision-consistent launch/run assets.

The shared truth engine owns only composition, routing, collation, public prices, omissions, and outcome simulation. Buyer costs/preferences never affect seller outputs. Seller acquisition cost, price targets, or private assumptions never affect buyer outputs.

V2 does not predict auction demand, fill, clearing price, seller performance, delivered condition, personal play/collection utility, or policy approval. It does not automate a bid. Every decision is conditional on named inputs.

## 2. Release promises

### 2.1 Buyer promise

“Prepare a buyer-owned limit using the validated treatment; compare a manually observed next bid without chasing the auction.”

The preferred path is Prepare → save the validated precise/range/hard-limit artifact → use Whatnot Max Bid/pre-bid when the treatment permits copying. Live comparison is a fallback. ColorBreak never asks users to chase a changing hammer.

### 2.2 Seller promise

“Know the gross revenue and declared prices required to clear your modeled costs; expose weak spots and sealed-inventory risk; publish one internally consistent plan.”

The result is not a fill forecast. `Economics clear target` means only that declared full-fill prices cover the selected cost basis and target under the pinned fee profile.

### 2.3 V2 testable scope

Required: one rollout-gate-selected buyer treatment and its comparison contract, evidence sensitivity, input/viewport stability, seller conditional economics, full-fill/unsold-set stress, launch-ready rules, versioned exports, mobile redesign, and public iPhone testability.

Explicitly deferred: Chase Map, generic Chase stance, demand/fill forecasting, automatic scenario optimizer, seller reputation, inferred playability/collector premiums, deck/collection imports, direct Whatnot API, and automatic policy approval.

## 3. Provenance and noninterference

Every input has one owner:

| Owner | Examples | Share behavior |
|---|---|---|
| Source-owned | normalized sealed contents, printing identity, observed price/time, fee/policy documents | immutable; refresh may create a new evidence revision |
| Seller declaration | physical product, routing, spot map, what ships, fixed contents, fulfillment promise | shareable, individually labeled, versioned, never called verified identity |
| Buyer choice | cap rule, marginal cost, wanted cards, personal values/copy limits | private/local; never inherited from seller |
| Seller private | acquisition/opportunity costs, targets, labor, promotion, actuals | private; excluded from buyer links/results |

Invariants:

1. Changing seller-private data cannot change buyer analysis.
2. Changing buyer-private data cannot change Seller Studio or launch assets.
3. Seller declarations that conflict with source-owned facts create a blocking conflict, not an override.
4. Shared plans are labeled **Unverified shared plan** and carry payload hash, plan revision, source revision, policy revision, and timestamp.
5. Local edits show **Edited on this device**, a diff, and Reset to shared plan.
6. Buyer defaults for cost/value/cap are always local and independent.

Protected sinks include displayed output, serialized state, URL/public projection, plan hash, export, cache key, analytics/diagnostic event, worker request, and network request. Canonical public projection occurs before hashing/sharing. Sentinel tests require opposite-side byte equivalence and no private-value-dependent external request. Seller declarations remain visible per value-moving field; when removing one crosses the decision boundary, it is the primary reason.

## 4. Canonical break and printing identity

A launch-ready break contains:

- exact product lines and quantities;
- sales mechanic: PYT BIN/offer, PYT auction, or random auction;
- ordered spot list;
- assignment method;
- routing for mono, multicolor, colorless, lands, double-faced cards, promos, toppers, tokens/art cards, and every product-specific exception;
- fixed disclosed contents;
- what ships, bulk/base definition, minimum-card fulfillment, handling/packing declarations;
- fee/policy region and revision.

A canonical printing identity contains set, collector number, finish, treatment/frame, language assumption, promo/stamp/serialized attributes when present, and source pack slot. Image and price must match that identity. An unavailable exact price remains `price unavailable`; it is never silently proxied or displayed as $0.

## 5. Buyer value and cap contract

### 5.1 Financial value modes and Release-A resale transform

1. **Modeled card market value**: sum of exact-printing market observations. This is not cash proceeds.
2. **Modeled net resale**: deterministic banded transform. Defaults are versioned, editable, and never presented as observed liquidity:
   - `<$2`: unsold floor $0;
   - `$2–<10`: group same-printing copies into one lot, 55% realization, $0.30 lot friction;
   - `$10–<50`: one printing/finish per lot, 75% realization, $0.30 friction;
   - `≥$50`: one card per lot, 82% realization, $0.30 friction.

For each lot, `net = max(0, gross market × realization - fixed friction - seller-paid outbound cost declared for that band)`, rounded to cents after lot calculation. Condition assumption defaults to Near Mint, time horizon is a visible user choice, and no time-to-sale prediction is made. Values below the minimum net threshold remain $0. One $100 card and one hundred $1 cards therefore cannot be treated as equivalent cash. This algorithm is a conservative sensitivity model, not a liquidity fact.

3. **Wanted-card composite**: a separately selected personal layer over one explicit residual mode: `zero`, modeled card market value, or modeled net resale.

### 5.2 Cap rules

The buyer chooses and affirmatively saves one versioned rule in Prepare:

- **Median-value cap (`median-v1`)**: value target is the lower empirical median defined below. Literal meaning: at least half of modeled outcomes are at or above it and at least half are at or below it.
- **Coverage cap (`coverage-v1`)**: buyer chooses required empirical model coverage `c` (50%, 75%, or 90%); value target is the greatest observed sample value whose measured meet-or-exceed frequency is at least `c`.
- **Average-dollar cap (`average-v1`)**: value target is the mean of the chosen value-mode distribution. It is labeled chase-sensitive and requires acknowledging that most outcomes may be lower.

There is no generic Balanced or Chase-upside rule. No rule is called optimal.

For sorted sampled values `x₁…xₙ`, coverage uses `x[n - ceil(cn) + 1]` with one-based indexing. The lower median uses `x[ceil(n/2)]`. No interpolation creates an unobserved outcome. The UI reports achieved empirical frequency after currency/cap rounding and says “modeled samples,” not population certainty. Seed, sample count, engine version, and a deterministic near-boundary refinement tolerance are part of provenance. Source/model uncertainty is governed separately by section 6.

For value target `V`, the added-cost function `C(h, orderState, jurisdiction)` returns every buyer cost added if hammer `h` wins: marginal shipping, tax, and other known charges. `D` is the ordered set of amounts accepted by the platform Max Bid field, or currency-minor-unit amounts when platform acceptance is unverified.

`modeled financial cap = max { h ∈ D : h + C(h, orderState, jurisdiction) ≤ V }`

Fixed-dollar costs reduce to `floor_D(V - F)`. Fixed costs `F` plus hammer tax rate `r` reduce to `floor_D((V - F)/(1+r))`. Stepwise/tiered costs are solved monotonically over `D`; non-monotone cost schedules are rejected. Unknown cost never becomes zero. A buyer may choose a documented conservative upper-cost bound or receive **No modeled cap — additional cost unknown**. An empty feasible set produces **No financial room to bid**, equivalently `V < min_{h∈D}(h+C(h))`. Internal zero is never a copyable Max Bid.

`SavedCap` is an immutable accepted record containing dollars and rule/evidence/cost/simulation revisions. `ActiveCeiling = min(SavedCap.acceptedDollars, latestSafeModeledCap)` only while current analysis permits a cap. Favorable reanalysis cannot raise it without adoption; adoption creates a new superseding SavedCap. Adverse $21 analysis preserves accepted $24 history but derives active $21. A new no-cap state immediately invalidates ActiveCeiling and all copy/comparison actions. Records/transitions persist through cold restore. A lower user hard cap further limits ActiveCeiling.

### 5.3 Current/next auction comparison

Current hammer is manual and timestamped. It cannot alter the cap.

- **Your total Max Bid:** modeled cap/maximum hammer.
- **Next available bid:** optional manually observed platform total.
- **Under cap by $X:** next bid < cap.
- **At cap:** next bid = cap.
- **Over cap by $X:** next bid > cap.
- If next bid is unknown: show cap only, no action verb.

`All-in at cap = cap + C(cap)`. `All-in at next bid = next + C(next)`. `All-in at current hammer` is observational and appears only after the user says they are leading. These never share a label. Copy action says **Copy $X total Max Bid**.

### 5.4 Hybrid-value warning

ColorBreak models pull/value outcomes, not rival information. It never raises value because other people bid. When public evidence is materially uncertain, show: “This cap does not use information other bidders or the seller may have.” No numeric winner's-curse discount is invented.

### 5.4a Feature-gated fallback contracts

The production buyer treatment is selected by the preregistered gate in section 12:

- **Precise-cap treatment:** uses SavedCap/ActiveCeiling and copy/comparison semantics above.
- **Cap-range fallback:** `SafeThrough` is the minimum modeled cap across the versioned joint uncertainty set; `PossibleThrough` is the maximum. Neither endpoint is called a recommendation. Only SafeThrough may be copied after explicit “use conservative end” confirmation. Next bid is `below safe range`, `inside assumption-sensitive range`, or `above modeled range`. A saved range preserves both endpoints/revisions; adverse refresh can lower/invalidate SafeThrough immediately and cannot raise endpoints without adoption.
- **Distribution + hard-cap fallback:** no modeled cap is displayed or copied. Buyer enters an immutable hard maximum; next bid compares only against that buyer-authored amount. Distribution/evidence remain visible and never receive cap provenance labels.

Each fallback must independently pass corrupted-advice/limit-violation gates. A failed precise treatment cannot be restored by an implementation story or feature default.

### 5.5 Wanted-card mode

Optional target groups are non-overlapping, fully enumerated sets of pinned canonical printing identities. A source refresh cannot add membership silently. Each pulled physical copy may satisfy at most one need. Overlap is rejected. Within a heterogeneous group, allocate needs to eligible copies in ascending residual value to maximize declared composite value; tie-break by canonical printing identity. This objective and membership revision are provenance-stable. Target rows contain:

- canonical exact printing or an explicit acceptable-printing group;
- useful copies needed;
- **total personal value per useful copy**, which replaces—not adds to—the residual value for that allocated copy;
- an independently selected residual mode for non-wanted and excess copies;
- actual seller routing destination;
- modeled absolute frequency of meeting the copy goal.

Outcome value equals residual value for every physical copy, except the first copies deterministically allocated to unmet non-overlapping wanted needs use the user total value instead. Excess copies receive residual value only. `Useful copies needed` means additional copies wanted. Show financial-only and wanted-composite results separately.

Primary results show each target's frequency and the joint “all selected targets” frequency: “3 in 100 modeled openings meet all targets.” Missing market price preserves wanted probability and personal value but makes the financial residual unavailable, never $0. A buy-the-single comparator must enumerate a dated, quantity-aware acquisition set of acceptable identities and state shipping/condition limits; otherwise it says unavailable. No format legality, playability, completion synergy, or treatment preference is inferred.

### 5.6 Existing positions

Random-assignment analysis accepts positions already owned and computes incremental without-replacement portfolio outcomes and marginal costs. Until implemented, repeat-position cases must display **No modeled cap for another position** rather than reuse a single-position cap.

## 6. Evidence materiality and uncertainty

### 6.1 States

- **Ready:** all material inputs resolve and plausible sensitivity does not change the cap relationship/economic status.
- **Sensitive:** the result is stable only within named bounds or one assumption is near the decision boundary. Show the switching assumption.
- **No modeled cap / Launch blocked:** plausible bounds cross the decision or a material structural fact is unknown.

### 6.2 Materiality rule

Every result identity separately binds: historical reconstruction revision, current decision-evidence revision, evidence-policy revision (eligibility/freshness/proxy), joint-uncertainty-rule revision, simulation engine/seed/sample/tolerance, declarations revision, and private choice revision. Evidence eligibility, freshness, proxy prohibition, and parameter bounds are engine-owned—not seller choices. Seller links preserve historical reconstruction evidence, but buyer decisions use the current eligible revision. A material historical/current divergence suppresses the precise result until acknowledged locally; featured cards change presentation order only.

For every omission or stale/thin observation, the engine constructs a versioned joint feasible uncertainty set with declared parameter dependencies, conservative envelopes, source rule, and simulation tolerance. Evaluate the decision over the joint set rather than one variable at a time. An item is decision-material if the resulting range can:

- change under/at/over-cap state;
- change the chosen rule's controlling quantile or wanted-card routing;
- change seller target-clearing status;
- change policy/launch readiness.

Unknown routing/product/collation without defensible bounds is automatically material. A missing low-value price is not automatically material. Unpriced rare treatments preserve probability and wanted odds; they never appear as $0. `Ready` requires conclusion stability across the joint set. `Sensitive` is used only when a robust conservative result remains available but the modeled range is near/conditional on named bounds. If the set crosses under/at/over or target-clear/miss state, the output is **No modeled cap / Missing sales assumptions**, never “Sensitive/no cap.”

### 6.3 Resolution and domains

Displayed precision cannot exceed uncertainty support. Dollars round to practical currency ticks; percentages avoid false decimals. Gross card value and probability axes start at zero. Net resale, buyer surplus, and seller contribution profit may be negative and use a visible zero reference.

## 7. Bid Check experience

### 7.1 Entry and restore

Home puts **Check a bid** and **Plan a break** first. A one-tap **Last bid plan** restores the exact local product/rule revision with stale/conflict check; no mode chooser intervenes. Recent plans show product, seller label if user-authored, rule revision, and age.

Cold restore after process eviction must recover locally in one tap. Clipboard failure leaves a selectable numeric cap and accessible instruction. The fixed device script tests warm return, cold restore, wrong seller/product/spot, stale revision, keyboard, clipboard denied, and submitted test bid. Prepared transfer and Live fallback are measured separately; Live failure narrows the claim rather than shrinking controls/evidence.

### 7.2 Prepare sequence

1. Exact break contents and seller declarations.
2. Slot or random remaining pool; mark taken and undo.
3. Value mode and one cap rule; optional wanted cards.
4. Marginal cost acknowledgement.
5. Gate-selected result: precise SavedCap, SafeThrough/PossibleThrough range, or buyer hard cap beside distribution; controlling reason, evidence, and only treatment-permitted copy action.

### 7.3 Live first viewport

At 440×956 with Safari chrome, normal text, the result block is a tagged treatment union:

```text
[compact product · slot/pool · evidence]

[precise] YOUR SAVED TOTAL MAX BID $24 [Copy]
[range]   MODELED RANGE $19–$23 [Use conservative $19]
[hard]    YOUR HARD MAXIMUM $20 [Edit]
[one treatment-specific reason]

NEXT AVAILABLE BID (optional manual)  [$ 21]
[precise] Under/At/Over active ceiling
[range]   Below safe / Assumption-sensitive / Above range
[hard]    Under/At/Over your hard maximum
[treatment-specific all-in]

[Taken colors / Mark taken]           [Undo]
[Risk and cards ›]
```

No total-break EV, Chase Map, Break Balance, contributor grid, three-quantile chart, or methodology appears here. Keyboard-open layout keeps the edited input, active treatment result, and comparison visible. At 200% text, content reflows vertically; the selected result remains first but the entire contract is not forced into one viewport. Precise labels/actions cannot appear in range/hard-cap variants.

### 7.4 Stability

Product, slot, taken, value, or threshold updates retain bid/cost inputs, focus, and scroll anchor. Cached acknowledgement is ≤100 ms median; prior valid result stays visible as “updating.” No selection changes document scroll unexpectedly. App/dialog headers cannot cover titles or close controls.

### 7.5 Buyer exploration

One tap opens:

- controlling distribution summary tied to the cap rule;
- loss frequency and average shortfall where relevant;
- point mass at zero and empirical distribution detail;
- ranked/filterable exact-printing list with contribution, price state, pull frequency, treatment, and wanted status;
- concentration and source/evidence ledger.

Chase Map is absent from V2 testable. Its V1 maintenance implementation may remain outside the core flow.

## 8. Seller Studio economics

### 8.1 Two stages

**Feasibility sketch** requires product, region, one explicit format template, cash/decision cost, and sales mechanic. It outputs required full-fill revenue, value balance, and unresolved launch questions. It never says Run or permits exports.

**Launch-ready plan** requires exact rules, every-buyer-card fulfillment, sales mechanic, declared prices, complete/acknowledged costs, fee profile, and operational attestations. It can output conditional target status and launch assets.

### 8.2 Cost bases and result language

- **Cash basis:** actual acquisition paid. Used for cash recovery/accounting context.
- **Decision basis:** a discriminated selection. For inventory not yet owned, use committed landed acquisition. For owned inventory, use the highest credible foregone net benefit among user-declared feasible replacement or attainable sealed-sale alternatives after selling friction. Alternatives remain visible with source/date; dismissing one requires a reason.

Cash and decision product bases are alternative views and never summed for the same units. Without a decision basis, output says **Cash margin only** and cannot produce target-clearing status.

Every cost line has state `measured`, `estimated`, `not-applicable` with reason, `included-in:<line-id>`, or `unknown`. Blank is unknown; zero is explicit. Inclusion cycles are invalid. Default economic result is **modeled contribution profit**:

`declared hammer - commission - processing - acquisition/decision cost - supplies - seller shipping - promotion - declared variable operating costs`

The typed cost ledger is an acyclic graph. **Planned net profit = named revenue scenario − selected product basis − every resolved leaf cost**, including fees, labor/time, tax on fees, minimum-card fulfillment, giveaways, refunds/cancellations/damage allowance, and allocated fixed show overhead. `included-in:<line-id>` contributes exactly once through its resolved ancestor. Planned net is available only when every required leaf is non-unknown for a named show scope.

**Actual net profit** applies the same no-double-counting ledger to reconciled actual revenue/cost events; it permits no estimated or unknown leaf. Otherwise the output is explicitly provisional and not called actual net. Incomplete plans display itemized **Unmodeled costs**.

Every result serializes `{stage, salesMechanic, revenueScenarioType, costBasis, costCompleteness, targetType, targetValue, feeProfileRevision, evidenceTime}`. The status vocabulary:

- **Economics clear target at these declared prices**;
- **Economics miss target by $X**;
- **Missing sales/cost assumptions**;
- **Launch blocked**.

No expected net, expected fill, easiest to fill, or demand-derived Run appears without a validated predictive model.

### 8.3 Fee profiles

Profiles carry platform, country/region, category, currency, commission tiers, processing base/rate/fixed charge, fee-tax treatment, promotion/tier overrides, source URL, effective date, checked date, and expiry. Plans pin an immutable version. Expired profiles create Sensitive state and require confirmation/update. Actual receipt reconciliation records real fees without rewriting the historical plan.

Economics operates on transaction rows or a named transaction scenario containing hammer, buyer-paid shipping, buyer-tax basis, promotion/coupon effects, and fee-tax assumptions. Commission and processing are calculated per transaction, then summed. Shipment grouping is separate fulfillment data and cannot merge incurred transaction fees. Unknown order-value inputs receive joint sensitivity bounds, never zero. The gate fixture includes two transactions bundled into one shipment.

### 8.4 Sales-mechanic branches

- **PYT BIN/offer:** `posted-minimum` scenario with posted ask and explicit minimum accepted offer by spot; conditional clear/miss may use either named vector.
- **PYT auction:** starts are listing floors only. `required-threshold` is model output and cannot establish status. An optional `seller-hammer-hypothesis` is manually entered by spot/flat, never prefilled from card value, and drives copy reading “clears only if your $X hypothesis is realized.”
- **Random auction:** same separation of start, required total/average, seller hammer hypothesis, achieved-to-date, and required remaining average.
- **Actual hammer:** immutable observed transaction value. Final clear/miss exists only after every accounted transaction and cost resolves.

`posted-minimum`, `seller-hammer-hypothesis`, `required-threshold`, `start`, and `actual-hammer` are a closed union and non-interchangeable. With no accepted/hypothesized revenue, auctions show requirements and **No conditional profit status**. Required hammer is never expected hammer.

### 8.5 Fill-delay and cancellation stress

The break remains sealed until every position is accounted for under platform rules. The seller, employee, or household is never suggested as an absorber of unsold positions.

For each unsold count `k`, the engine owns an adverse funding frontier: the exact `k`-spot set with the largest declared-revenue shortfall using deterministic price-descending identity tie-breaks, the minimum and maximum revenue over eligible sets, a seller-marked fragile set when provided, the actual current set, and any user-selected set. It never labels a set likely. Constrained/grouped cases use an auditable solver; unconstrained cases derive bounds from sorted prices.

Stress views show:

- full fill at declared terms;
- exact adverse, fragile, actual, and user-selected unsold sets—not a cherry-picked scalar percentage;
- revenue shortfall, cash tied up, delay/refund exposure, and next action;
- **Do not open until all positions are accounted for** gate.

For flat equal-price random spots, the view may also state “minimum N of N positions at $X,” but never implies opening at N−1. Editable sensitivity rows are funding stress, not executable profit outcomes.

### 8.6 What-if comparison, not optimizer

Seller Studio supports explicit side-by-side variants for product mix, quantity, spot map, assignment mechanic, asks/starts, shipping support, and fixed disclosed contents. It shows exact changes in contribution profit, required revenue, **gross card-market comparison excluding buyer costs/preferences**, frequency gross modeled card market value is below declared hammer, weakest lower tail, value concentration, and rules. It never consumes buyer-private inputs or calls this buyer surplus.

There is no automatic Highest margin/Easiest to fill/Most balanced/More chase scenario generation in testable V2. No variant can suppress spot-level harm behind aggregate EV.

## 9. Seller Studio operations and launch

### 9.1 Plans, shows, and roles

- Named cloneable templates and batches.
- Immutable `PlanRevision` freezes products, rules, routing, revenue hypotheses, cost/fee evidence, and artifact manifest.
- Append-only `ShowRun` events record listing started, position sold/assigned, cancellation/refund, accounted-for attestation, opening begun, and fulfillment handoff. Each carries show ID, plan revision, actor/device label, idempotency key, sequence/time, and conflict state. Derived `RunState` is mutable operational truth; sold events never mutate the plan.
- JSON import/export for backup and handoff.
- A show plan can contain multiple breaks and allocate shared promotion, labor, and overhead by `equal`, planned hammer, actual hammer, direct minutes, or fixed manual amounts; allocations must sum exactly. Planned and reconciled allocations remain distinct.
- Dense desktop single-writer operator; read-only mobile host view displays last-updated RunState. V2 does not claim live multi-writer collaboration. Offline conflicts refuse/queue rather than silently merge.
- Importing/editing a revision creates a new revision; conflicts require resolution.

V2 is operator-capable under a single-writer model. Batch/show plans, immutable plan versus run state, handoff, allocations, and idempotent actuals import are mandatory; the previous solo escape hatch is removed.

### 9.2 Launch readiness checker

Result label: **Checked against ColorBreak ruleset [revision/date]**, never compliant or approved.

Pipeline order is plan preflight → seller attestations → deterministic generation → post-generation consistency → export release. Artifact consistency blocks release, not generation. Layer 1 blockers:

- prohibited additional prizes, bonuses, bounties, wheels, or games activated by purchase (not the disclosed core random break itself);
- conflicting/unresolved composition or routing;
- missing all-buyer-minimum-card rule;
- off-platform position sale in the described plan;

Layer 2 seller attestations:

- full break/tools/hands/product remain visible;
- every position accounted for before opening;
- same-show opening;
- inventory in hand;
- related-party exclusion;
- minimum-card fulfillment;
- custody, handling, and packing process.

Layer 3: unknown/exception mechanics show **Needs Whatnot review** and block export. Each result cites source date and unresolved items. Attestations are unverified declarations and expire when relevant fields or ruleset change. Post-generation hash/field mismatch blocks release.

### 9.3 Exact export contracts

Every transfer profile is schema-versioned, source-dated, has a required recheck/expiry date, and has golden fixtures verified against the current platform UI. An expired/unverified transfer profile blocks zero-edit claims and release until revalidated; plain-text/manual export remains available with a warning. One download package contains `artifact-manifest.json` with canonical plan hash, schema versions, transfer-profile revision/expiry, per-file hashes, public/private class, generation time, and superseded state, plus:

- `spots.tsv`: UTF-8 without BOM, LF newlines, header `spot_name\tprice\tdescription`, escaped tabs/newlines as spaces, unique ordered names, decimal price without currency symbol, blank auction price where transfer profile requires, validated ≤75 spots and zero-edit pasted through the pinned transfer profile.
- `show-notes.txt`: public rules/disclosures only.
- `seller-notes.txt`: private operational reminders.
- `public-plan.json`: enumerated public seller declarations/evidence only; never private costs/targets.
- `private-plan.json`: portable operational backup, explicitly private.
- `launch-portrait.svg` and rendered `launch-portrait.png`: 1080×1920 source/output with safe zones, thumbnail legibility test, rights metadata, exact product, assignment, selected featured printings, absolute odds/denominators, evidence time, downside/median context, and modeled-not-guaranteed label.
- `run-sheet.html` plus optional printed PDF: read-only host sequence with plan revision, RunState last-updated time, exact product count, verbal disclosure, next listing label, sold/remaining tracker, do-not-open gate, camera/custody/minimum-card checklist, and fulfillment handoff.
- seller-confirmed title/category/tag suggestions and public buyer plan link/QR.

Copy/download actions are separate and accessible. A consistency gate hashes/compares product, spot order, routing, rules, and revision across every artifact. Seller-selected cards are labeled **Featured by seller** and mandatory probability/context fields cannot be removed. No conversion claim is made.

### 9.4 Actuals and reconciliation

Manual entry remains available. Paste-grid/CSV import accepts user-downloaded transaction data through an explicit mapping preview. Imports store source-file hash, immutable raw rows, stable composite key, timezone/currency, idempotent repeat behavior, correction/refund events, and an unresolved bucket. Duplicates/unmatched spots are flagged; orders and shipments remain distinct; planned versus actual fees/allocations reconcile without altering the plan revision. No API relationship is implied.

## 10. Visual system

### 10.1 Character

Precise, calm, editorial, and fast. It avoids casino cues, gamer HUD density, dashboard maximalism, artificial urgency, near-miss framing, and decorative analytics.

### 10.2 Container rule

A border/fill is allowed only for an interactive group, selected state, warning/error, modal/sheet, or the single primary result context. Sections and rollouts do not receive boxes by default. No box inside a box. Tables, charts, and section divisions have zero radius; controls use a small radius; the primary result may use one medium radius. Shadows are for overlays only.

### 10.3 Type, color, motion

- One legible sans family, ≥16 CSS px reading text, tabular numerals.
- Literal labels and denominators; no uppercase prose or letter-spaced microcopy.
- State is text/icon/shape plus color, never color alone.
- No ambient/pulsing/drifting/confetti motion. Spatial transitions ≤200 ms and absent under reduced motion.
- Result values update without reflowing their container.

### 10.4 Responsive/accessibility

- Mobile portrait first; desktop can use controls/result columns.
- 44×44 primary targets, safe-area padding, dynamic viewport units, keyboard-aware sticky behavior.
- No page-level horizontal scroll at 320 CSS px or 200% text.
- WCAG 2.2 AA, visible/unobscured focus, correct focus trapping/restoration, VoiceOver labels with value/state/consequence.
- Charts require literal conclusion and semantic list/table alternative.

## 11. Performance and device gates

- LCP ≤2.5 s, INP ≤200 ms, CLS ≤0.1 at mobile p75.
- Cached acknowledgement ≤100 ms median; useful cached buyer cap ≤2 s.
- Simulation/evaluation off main thread; last valid result retained while updating.
- Zero unexpected scroll jump for slot/taken/value/mode changes.
- Zero obscured focused controls under app header, Safari chrome, keyboard, or modal.
- Physical iPhone 17 Pro Max: portrait/landscape, chrome expanded/collapsed, keyboard open, same-phone app switch/restoration, 200% text, and home-screen mode when supported.

The physical-device protocol is a versioned script with fixed public fixture/revision, clean-storage and warm-cache runs, declared iOS/Safari/build/network, screen recording plus performance trace, viewport/chrome state, keyboard and clipboard-denied steps, exact start/end events, three repeated runs per state, screenshot checkpoints, console/network error capture, and pass/fail artifact committed under `docs/v2/device-runs/<build>/`. Approximate desktop viewport testing cannot satisfy this gate.

## 12. Validation studies

### 12.1 Buyer usability and economic validity; precise-cap rollout gate

Precise cap is feature-gated research output, not the production default until this gate passes. Begin in a Whatnot-like screen; end after entering/submitting a test Max Bid. Compare V2 with V1/no-tool and precise-cap versus cap-range versus distribution-only treatments. Pre-register primary harmful-advice compliance/limit-violation outcome, non-inferiority margin, confidence level, sample size/stopping, exclusions, multiplicity, and corrupted-advice fixture.

Measure:

- total task time, wrong auction/spot, cap/increment confusion, input loss, and viewport shift;
- cap-rule comprehension and ability to compute a worked fixture;
- under/over-cap accuracy and appropriate refusal under corrupted/missing evidence;
- violations of a preregistered personal limit, decision loss/regret, clustering at advice, and automation overreliance;
- confidence intervals, experience/motive strata, and preregistered stopping/exclusion rules.

Usability and economic-validity studies are distinct. Controlled incentive-compatible payoff tasks test arithmetic, limit violations, corrupted advice, and regret against a predeclared rule. Field-device studies test time/errors/refusal but do not claim welfare. Display experiments estimate treatment effects with confidence bounds. Model validation uses held-out product/evidence revisions, never ColorBreak-influenced closing prices as independent truth.

Proposed usability gates: ≥90% correct comparison, ≥85% correct transfer, p90 prepared whole-task ≤7 s under fixed auction fixture, zero induced over-cap action, zero lost inputs/jumps. The precise treatment fails if the upper confidence bound exceeds the preregistered harm margin. Failure mechanically selects the cap-range experience; if range also fails, distribution plus buyer-entered hard cap ships. Stories cannot bypass this flag. Public pre-validation builds say **Research preview** and make no validated sub-ten-second claim.

### 12.2 Seller/operator validity

Compare against the seller's spreadsheet/current process. Measure plan correctness, conditional-language comprehension, setup/clone time, export edits, cross-artifact mismatch, handoff errors, 50-row reconciliation match rate, and correct show/per-break contribution. No comprehension-only test can validate demand forecasts because V2 makes none.

Operator gates: clone/configure known break ≤2 minutes median; zero-edit spot paste under current transfer profile; ≥98% automatic matching after a valid 50-row mapping with duplicate, cancellation, later refund, two shipments, and unmatched listing; zero policy-critical host-handoff omission; allocations reconcile exactly to show totals.

Player/collector scripts test routing of a named target, one useful plus four duplicates, exact treatment distinction, unavailable exact price with preserved odds, overlapping group rejection, per-target versus joint completion, and buy-single comparison limitations.

## 13. Public test seams

1. **Shared evidence:** composition + declarations + sources → immutable analyzed break/provenance/conflicts.
2. **Buyer treatment (tagged union):** analyzed outcomes + buyer value/cost/rule + rollout flag → `Precise{SavedCap,ActiveCeiling}` or `Range{SafeThrough,PossibleThrough}` or `HardCap{buyerAmount,distribution}` or refusal, each with provenance/reason.
3. **Auction comparison:** treatment + optional next total → precise under/at/over, range below/inside/above, or hard-cap under/at/over; impossible cross-treatment labels/actions are unrepresentable.
4. **Seller economics:** analyzed break + format/cost/fee/declared prices → conditional contribution result.
5. **Fill stress:** price plan + exact unsold set → sealed funding stress.
6. **Readiness:** plan + dated ruleset + attestations → blockers/checks/needs-review.
7. **Launch pack:** ready immutable revision → consistent artifacts.
8. **Workspaces:** interaction → preserved private state, stable viewport/focus, first task result.

## 14. Required counterexample suite before implementation acceptance

1. `V=$24`, fixed `F=$3`, hammer tax 10%, `D={$1,$2,…}` → cap $19; cap all-in $23.90. Unknown tax → no cap. `V=$3.50`, fixed $3, minimum accepted $1 → empty feasible set/no financial room.
2. Next bid $24/cap $24 → At; $23 → Under by $1; $25 → Over by $1. Current $20 never changes cap.
3. Samples `[0,10,20,40]`: lower median $10; 75% coverage $10; 90% coverage $0; average $17.50 before currency-domain flooring.
4. Wanted total value $20, residual market $12, one needed, five pulled → first copy $20, four copies $48, total $68—not $80 or $128. Heterogeneous accepted A residual $100/B $5 with one need allocates B → $120 total; equal residual tie uses canonical ID. Overlap is rejected.
5. Immutable SavedCap remains accepted $24/revision R1. Refresh computes $27/R2 → ActiveCeiling $24 until adoption creates SavedCap R2. Starting again from R1, refresh computes $21/R3 → SavedCap history remains $24/R1, ActiveCeiling $21/R3. Refresh no-cap → ActiveCeiling absent and copy disabled; cold restore preserves this state.
6. Current under cap, next legal bid over cap → over cap; cap unchanged.
7. Seller cost sentinel changes → every buyer protected sink byte-equivalent; no external request differs.
8. Buyer personal value sentinel changes → every seller protected sink byte-equivalent.
9. Equal-mean fixtures A `[0,0,20,20]` and B `[5,5,5,25]`: 75%-coverage targets $0 versus $5; average remains $10.
10. `V∈[$24,$26]` from chase evidence, fixed shipping $3, tax `r∈[0,.10]`, `D=$1`, next bid $21: caps range $19–$23 and cross next-bid state → No modeled cap; switching combination is primary. A stable cap interval entirely ≥$23 would be Sensitive with SafeThrough endpoint.
11. One $100 card → `$81.70` before outbound cost under chase band; 100×$1 → $0 under bulk floor.
12. Unequal declared prices `[50,30,20]`: one-unsold adverse set is `$50`; funding frontier names $50 minimum remaining revenue and $80 maximum; product stays sealed.
13. Random remaining values W=$20/U=$0, average rule, no added cost: isolated cap $10. Buyer records already-owned W; without replacement the next position is U=$0 → no financial room and stale $10 is evicted immediately. If ownership identity is unknown/unsupported, no cap immediately.
14. Historical seller link $180 chase versus current eligible $95 → current evidence drives buyer; material divergence blocks precise cap; buyer preferences unchanged.
15. Financial target bound `V∈[$20.50,$20.75]` from one missing bulk common, zero cost, $1 domain, next $19 → cap $20 throughout, Ready with bounded note. Unknown routing produces `V∈[$18,$25]` with next $21 → state crosses and yields No modeled cap.
16. Auction start and required threshold alone → No conditional profit status. Explicit `$32` seller hammer hypothesis → conditional copy names hypothesis. Actuals remain separate.
17. Cash $80, replacement $150, attainable sealed net $180, break contribution before product $170 → cash positive; decision basis misses by $10; bases never sum.
18. Starting contribution $100; measured labor $25 and refund/damage allowance $15 → planned net $60. If target is $75, status changes from apparent clear to miss by $15. Blank labor prevents planned-net label; explicit measured $0 is complete; included-in cycle fails and included child never double-counts.
19. Two $20 transactions with buyer shipping/tax bundled into one shipment still incur two fixed processing fees.
20. Plan field differs from artifact manifest → export release blocked. Sold event changes RunState but not PlanRevision hash.
21. Net negative seller/buyer metric → signed chart includes negative and zero line; gross/probability stays non-negative.
22. Precise treatment fails harm gate → feature flag selects Cap Range. Joint cap range $19–$23 and next $18 → below safe range; next $21 → assumption-sensitive range; next $24 → above modeled range. Only $19 can be copied after conservative confirmation. If range fails, distribution + immutable buyer hard cap ships and no modeled-cap label appears.

## 15. Definition of testable V2

From the public URL on iPhone 17 Pro Max:

- Buyer restores/configures an exact break, chooses/marks slots, chooses one explicit value rule, acknowledges marginal cost, uses the treatment selected by the rollout gate (precise cap, cap range, or distribution + hard cap), optionally compares next bid, changes state without data/viewport loss, and inspects ranked evidence.
- Seller creates a feasibility sketch, completes launch-ready rules/costs, sees conditional target economics and exact fill-delay stress, exports a consistent TSV/TXT/JSON/portrait/run package, and can hand off the revision.
- Shared links preserve provenance/conflicts without leaking seller private data or setting buyer preferences.
- All counterexamples, accessibility, responsive, performance, CI, and public-asset gates pass.
