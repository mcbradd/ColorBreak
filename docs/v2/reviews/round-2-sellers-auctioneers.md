# Round 2 antagonistic review — sellers and auctioneers

Date: 2026-08-13
Reviewed artifact: [ColorBreak V2 product specification — revision 2](../PRODUCT-SPEC-v2.md)
Prior review: [Round 1 — sellers and auctioneers](round-1-sellers-auctioneers.md)
Adjudication checked: [Round-1 review adjudication](../ROUND-1-ADJUDICATION.md)
Evidence base: [ColorBreak V2 primary research dossier](../../research/colorbreak-v2-primary-research-2026-08-13.md) and the primary Whatnot sources linked below
Perspectives kept deliberately separate: **ordinary/aspiring seller** and **popular high-volume Whatnot operator**

## Executive verdict

Revision 2 removes the most dangerous round-1 claims. It no longer derives fill demand from card EV, no longer presents a partly filled break as executable, no longer gives an unqualified Run recommendation, and no longer calls a necessarily incomplete calculation net profit. It adds cash and decision bases, mechanic-specific pricing branches, dated fee and policy profiles, readiness attestations, exact artifact types, show-level planning, and imported actuals. Those are material corrections rather than copy changes.

The seller design is nevertheless **not implementation-ready**. The revision has moved the false precision one layer down into contracts that are still underspecified:

1. For auction formats, the spec does not define which seller-authored revenue assumption—start, required average, assumed hammer vector, or actual hammer—is allowed to drive **Economics clear target**. A start or a mathematically required average is not attainable revenue.
2. The complete-cost gate can be satisfied by a checklist that merely “includes” categories. It does not distinguish measured zero, not applicable, included elsewhere, estimated, and unknown, so an incomplete plan can still acquire the stronger **net profit** label.
3. “Decision basis” lets a seller choose replacement cost *or* attainable sealed-sale proceeds without specifying the governing alternative, evidence, or non-double-counting rule. The original opportunity-cost blocker is narrowed but not closed.
4. “Exact candidate unsold set(s)” does not say who chooses the sets, which sets must be shown, or how a 75-spot combinatorial space is reduced without hiding the seller's worst funding concentration.
5. Seller what-if output includes “modeled buyer surplus” without defining a seller-owned public-value contract. That either consumes buyer-private inputs, violating the product's first invariant, or invents a representative buyer the evidence does not support.
6. The high-volume workflow has immutable plan revisions but no show-state model. A “read-only” run sheet also has a sold/remaining tracker, and no contract explains how live operational state can change without mutating the launched plan or creating version drift.

An ordinary seller could still receive an authoritative green economic status from a planning assumption that was never identified as theirs. A high-volume operator could still export consistent-looking launch files, change one live fact, and leave the host, Break Manager, buyer link, and fulfillment handoff on different effective versions.

**Round-2 disposition: reject the seller/operator portion for implementation until the six residual blockers at the end of this review are made normative and testable.** Most lower-severity feedback should now be moved into stories rather than trigger another full product rewrite.

## Severity summary

| ID | Severity | Finding | Ordinary seller impact | High-volume operator impact | Disposition |
|---|---|---|---|---|---|
| R2-S-C1 | Critical | Auction revenue assumptions can still masquerade as realizable declared prices | Can treat a start or required average as a profit-bearing sales plan | Can allocate inventory against a target no show has demonstrated it can clear | **Act before implementation** |
| R2-S-C2 | Critical | Complete-cost truth is a checkbox, not a typed completeness contract | Can receive “net profit” while unknown labor/refund/overhead remains | Makes show and break P&L irreconcilable | **Act before implementation** |
| R2-S-C3 | Critical | Decision basis still permits the wrong opportunity-cost comparator | Can destroy more attainable sealed value than the break creates | Misallocates scarce inventory across shows | **Act before implementation** |
| R2-S-C4 | Critical | Seller “buyer surplus” output is undefined and can violate noninterference | Can optimize against a fictional buyer | Can institutionalize discriminatory or misleading spot-pricing logic | **Remove or redefine before implementation** |
| R2-S-M1 | Major | Exact unsold stress has no selection/frontier contract | Weak spots can be omitted from the stress view | Combinatorial plans can present favorable subsets | **Act** |
| R2-S-M2 | Major | Fee profiles omit the transaction/order-value inputs needed to execute the published formula | Fixed processing and buyer-paid shipping/tax can be understated | Bundled shipments can be confused with separately charged transactions | **Act** |
| R2-S-M3 | Major | Readiness has a generation-order cycle and an overbroad purchase-triggered-chance blocker | Can be blocked by a legitimate random break or pass before generated assets exist | Batch export cannot have a deterministic preflight/postflight pipeline | **Act** |
| R2-S-M4 | Major | Feasibility/launch terminology still leaves target, cost basis, and price type implicit | Green language remains hard to audit | Different operators can read the same status differently | **Act** |
| R2-A-C1 | Critical | Immutable plan revision and mutable live show state are not separated | Limited impact for a solo first show | Host, operator, and fulfillment can silently diverge | **Act before operator claim** |
| R2-A-M1 | Major | “Exact” launch package is not wire-exact and omits its promised editable graphic source | Requires retyping or repair | Prevents zero-edit batch transfer and deterministic validation | **Act** |
| R2-A-M2 | Major | Show-level allocation and reconciliation rules are named but not specified | Limited impact | Per-break contribution can be changed arbitrarily by allocation choice or duplicate imports | **Act before operator claim** |
| R2-A-M3 | Major | Operator scope can silently collapse to “solo plan” while still satisfying V2 definition | No effect if clearly solo | Makes high-volume validation optional despite being a stated stakeholder | **Choose scope explicitly** |
| R2-S-m1 | Minor | Expired fee confirmation can conflict with materiality rules | Confirmation may look like accuracy | Operators may pin stale economics across a batch | **Clarify** |
| R2-S-m2 | Minor | Seller launch workflow omits title/category/tag transfer requested in round 1 | Leaves recurring setup work outside the tool | Adds manual show setup edits | **Act as a story, not a blocker** |

## Round-1 blocker audit

| Round-1 requirement | Revision-2 result | Audit |
|---|---|---|
| Unsupported fill cannot produce Run | Expected fill, Run, Easiest to fill, and the optimizer are removed; status is conditional on declared prices ([§2.2](../PRODUCT-SPEC-v2.md#22-seller-promise), [§8.2](../PRODUCT-SPEC-v2.md#82-cost-bases-and-result-language)) | **Resolved in principle; regresses if an auction start/required average is treated as declared realized revenue (R2-S-C1).** |
| Partial fill remains sealed and exposes delay/refund risk | The spec explicitly gates opening until every position is accounted for, bars related-party absorption, and names delay/refund exposure ([§8.5](../PRODUCT-SPEC-v2.md#85-fill-delay-and-cancellation-stress)) | **Resolved in principle; exact set selection remains underspecified (R2-S-M1).** |
| Contribution versus net profit | Default is modeled contribution profit; net requires a named category list ([§8.2](../PRODUCT-SPEC-v2.md#82-cost-bases-and-result-language)) | **Partially resolved; category presence is not category completeness (R2-S-C2).** |
| Cash versus opportunity/decision basis | Both are named, categorical status is barred without a decision basis ([§8.2](../PRODUCT-SPEC-v2.md#82-cost-bases-and-result-language)) | **Partially resolved; comparator selection and non-double-counting remain undefined (R2-S-C3).** |
| Exact sales mechanic | PYT BIN/offer, PYT auction, and random auction are separate branches ([§8.4](../PRODUCT-SPEC-v2.md#84-sales-mechanic-branches)) | **Partially resolved; the revenue hypothesis that may drive status is missing (R2-S-C1).** |
| Dated fee/policy versions | Fee profiles and readiness rulesets are dated, versioned, and pinned ([§8.3](../PRODUCT-SPEC-v2.md#83-fee-profiles), [§9.2](../PRODUCT-SPEC-v2.md#92-launch-readiness-checker)) | **Mostly resolved; execution inputs and stale-materiality behavior need clarification (R2-S-M2, R2-S-m1).** |
| Policy checker states what it proves | Deterministic blockers, seller attestations, and Needs Whatnot review are separated; approval language is banned ([§9.2](../PRODUCT-SPEC-v2.md#92-launch-readiness-checker)) | **Mostly resolved; one blocker is overbroad and artifact consistency is ordered incorrectly (R2-S-M3).** |
| Exact Break Manager transfer fields | `spots.tsv` names spot, price/start, and description and validates the 75-spot maximum ([§9.3](../PRODUCT-SPEC-v2.md#93-exact-export-contracts)) | **Partially resolved; serialization, field semantics, and fixtures are not wire-exact (R2-A-M1).** |
| Same revision across artifacts | Every package item carries the same revision/hash and a consistency gate compares core fields ([§9.3](../PRODUCT-SPEC-v2.md#93-exact-export-contracts)) | **Resolved for a static export; not for post-export live state (R2-A-C1).** |
| Multi-break planning without duplicate entry | Show plans, templates, batches, JSON handoff, allocation, and import mapping are named ([§9.1](../PRODUCT-SPEC-v2.md#91-plans-shows-and-roles), [§9.4](../PRODUCT-SPEC-v2.md#94-actuals-and-reconciliation)) | **Partially resolved; state, allocation, and import idempotency contracts are absent (R2-A-C1/A-M2).** |
| Operator success measured against current workflow | Seller/operator studies compare to spreadsheet and measure setup, edits, mismatches, handoff, and reconciliation ([§12.2](../PRODUCT-SPEC-v2.md#122-selleroperator-validity)) | **Resolved at metric-category level; numeric operator gates from round 1 were dropped.** |
| No unsupported optimizer or conversion claim | Explicit what-if comparison replaces optimization; launch assets make no conversion claim ([§8.6](../PRODUCT-SPEC-v2.md#86-what-if-comparison-not-optimizer), [§9.3](../PRODUCT-SPEC-v2.md#93-exact-export-contracts)) | **Resolved, except the undefined “buyer surplus” metric introduces a new optimization-authority risk (R2-S-C4).** |

## Perspective 1 — ordinary or aspiring seller

This seller is likely to have incomplete cost records, little observed auction history, constrained cash, and no robust way to estimate whether an auction start will become a profitable hammer. Their protection depends on the app preserving a strict boundary between deterministic requirements and seller-authored hypotheses.

### R2-S-C1 — Critical: auction economics still has no valid revenue-assumption contract

**Attack.** The seller promise says declared full-fill prices cover costs, [§8.2](../PRODUCT-SPEC-v2.md#82-cost-bases-and-result-language) defines the status **Economics clear target at these declared prices**, and the equation begins with `declared hammer`. But [§8.4](../PRODUCT-SPEC-v2.md#84-sales-mechanic-branches) gives auctions a starting floor and a required average/total hammer while correctly saying neither is a forecast. It never introduces a third, explicitly seller-authored assumed-hammer vector that could legitimately drive a conditional scenario. Therefore an implementation has only three choices, all bad:

1. treat starts as revenue, although starts are floors;
2. treat the required average as revenue, making the target prove itself by algebra; or
3. silently invent expected hammers, recreating the round-1 demand forecast.

**Concrete failure.** A six-position PYT auction needs $180 total hammer. The seller enters $5 starts. The interface can calculate “required average $30,” but it cannot honestly say the economics clear. If it uses $30 as the declared hammer, the green status is tautological; if it uses $5, it assumes every spot closes at start; if it predicts a close, it exceeds the evidence boundary.

**Required correction.** Define revenue scenario types as a closed union:

- `posted-minimum` for BIN/offer: posted asks plus explicit minimum accepted offers by spot;
- `seller-hammer-hypothesis` for auctions: seller-entered hammer by spot or a labeled flat assumption, never prefilled from card EV and never called likely;
- `required-threshold`: model output only, never eligible to establish clear-target status;
- `actual-hammer`: observed, immutable actual.

Every status must name its scenario type, basis, and revision: “Clears $40 decision-basis target **if your $32 average-hammer assumption is realized**.” With no seller hypothesis, auctions show required revenue/average and **No conditional profit status**. Starts remain a risk control/listing field, not forecast revenue.

### R2-S-C2 — Critical: “complete cost” can still be false

**Attack.** [§8.2](../PRODUCT-SPEC-v2.md#82-cost-bases-and-result-language) reserves net profit for a checklist that “includes” labor/time, fee tax, fulfillment, giveaways, refund/damage allowance, and allocated overhead. Inclusion does not establish knowledge. An unchecked row, a blank row coerced to zero, and an intentional measured zero must not be equivalent. Nor does a pre-show allowance become an actual net result.

**Concrete failure.** A novice checks labor and refunds, leaves both values blank, and sees net profit. After the show, three hours of sorting and a cancellation turn the result negative. The app did not merely miss a cost; it promoted unknown values into a stronger accounting label.

**Required correction.** Every cost line needs a typed status: `measured`, `estimated`, `not-applicable-with-reason`, `included-in:<line-id>`, or `unknown`. Zero must be explicitly entered and attributable. The plan may say **planned net profit** only when every required line is non-unknown and the time/show allocation scope is named. **Actual net profit** is reserved for reconciled actuals. Any unknown forces contribution-profit language and an itemized **Unmodeled costs** list. Add counterexamples for blank-as-zero, included-elsewhere cycles, and a refund allowance that changes target status.

### R2-S-C3 — Critical: the opportunity-cost decision can still be gamed

**Attack.** The decision basis is “replacement cost or attainable net sealed-sale alternative.” Those are not interchangeable labels for a number the seller may choose opportunistically. Replacement cost answers what it takes to replenish an operational input. Attainable net sale answers what the seller gives up by opening owned inventory. For an owned box with a credible sealed exit, using a lower historic replacement quote can still endorse value destruction. Conversely, for inventory the seller has committed to purchase for this plan, landed acquisition cost may be controlling. The formula's `acquisition/decision cost` also leaves open whether the two are alternatives or are summed.

**Required correction.** Define a `cost-basis` discriminated type and selection rule. At minimum show cash-basis output alongside one named decision comparator, store source/date/selling friction for attainable proceeds, and forbid adding acquisition and opportunity cost for the same unit. If multiple feasible alternatives exist, show each or use the highest credible foregone net benefit for the decision status; a seller may dismiss an alternative only with a visible reason. The status must say exactly which basis controls. Add a fixture where cash cost is $80, replacement is $150, attainable sealed proceeds are $180, and break contribution before product is $170: cash is positive, the economic decision misses by $10.

### R2-S-C4 — Critical: “buyer surplus” is a regression against private-variable separation

**Attack.** [§8.6](../PRODUCT-SPEC-v2.md#86-what-if-comparison-not-optimizer) promises spot-level modeled buyer surplus and loss frequency in Seller Studio. Yet [§1](../PRODUCT-SPEC-v2.md#1-product-boundary) and [§3](../PRODUCT-SPEC-v2.md#3-provenance-and-noninterference) state that buyer cost and preference inputs never affect seller outputs. Buyer surplus requires a value mode, tax, marginal shipping, copy utility, and often resale friction—all buyer-owned choices. The spec neither defines a public neutral comparator nor bars use of buyer data here.

**Concrete failure.** A seller reprices blue upward because the tool reports buyer surplus based on collection-market prices and zero buyer friction. A resale-motivated buyer actually has negative expected net value. The seller then presents the model as evidence that blue is a “good value,” even though ColorBreak computed no such buyer-specific fact.

**Required correction.** Remove “buyer surplus” from Seller Studio. Replace it with literal seller-safe metrics: `modeled gross card-market value minus declared hammer`, distribution below declared hammer, and concentration under a named public exact-printing evidence revision. Label these **card-market comparison, excluding buyer costs and preferences**. If any buyer-owned value/cost mode is selected, the calculation belongs exclusively in Bid Check and must remain byte-inert to Seller Studio.

### R2-S-M1 — Major: “exact candidate unsold sets” is not an algorithm or disclosure rule

**Attack.** [§8.5](../PRODUCT-SPEC-v2.md#85-fill-delay-and-cancellation-stress) correctly rejects scalar percentages for unequal prices, but “exact candidate unsold set(s)” allows a favorable implementation to show whichever subsets make the plan look robust. Exhaustive display is impossible for large custom lists. The spec needs a deterministic frontier and user-selected scenario contract.

**Required correction.** For every `k` from one to a practical display limit, compute and retain:

- the exact `k`-spot set producing the largest revenue shortfall (with deterministic tie-breaking);
- the exact set containing seller-marked fragile spots, if any;
- any user-selected exact set; and
- a compact revenue-at-risk frontier with access to the complete sorted spot table.

Never call a set “likely unsold.” Every row says the product remains sealed and distinguishes pending authorized sales, refundable exposure, realized revenue, and cash tied up. Define whether platform fees are incurred/reversed under cancellation rather than assuming either outcome. For flat random spots, the N-of-N shorthand remains secondary.

### R2-S-M2 — Major: fee profile metadata is richer, but fee execution inputs are incomplete

**Attack.** The primary research notes that Whatnot processing is assessed per transaction on total order value, generally including hammer, buyer-paid shipping, and buyer tax, while later shipment bundling does not merge those transaction fees ([Whatnot seller fees](https://help.whatnot.com/hc/en-us/articles/4847069165965-Whatnot-seller-fees)). [§8.3](../PRODUCT-SPEC-v2.md#83-fee-profiles) models rates and bases but never requires transaction count, buyer-paid shipping/tax estimates, or the distinction between transaction and shipment. A spot-level fixed fee cannot be accurately solved from gross break hammer alone.

**Required correction.** The economics input must carry transaction rows or an explicit transaction-count/order-value scenario, including hammer, buyer-paid shipping, buyer tax treatment, seller-paid shipping, and promotion/coupon effects where applicable. Fee calculations operate per transaction, then sum. Shipment grouping remains fulfillment data and cannot reduce already incurred transaction fees. Unknown order-value components get bounded sensitivity and materiality treatment, not zero. Include a two-spot fixture sold in two transactions but one shipment.

### R2-S-M3 — Major: readiness has a circular gate and one rule that can block the product itself

**Attack.** [§9.2](../PRODUCT-SPEC-v2.md#92-launch-readiness-checker) lists “prohibited outcome-contingent mechanics or purchase-triggered chance” as a deterministic blocker. A random card break necessarily contains purchase-linked uncertainty in assignment and pull outcomes; Whatnot's prohibition applies to additional purchase-based prizes/games and specified mechanics, not to the core disclosed break format. The broad wording invites a validator that blocks legitimate random breaks.

The same section blocks on “incomplete artifact consistency,” but [§9.3](../PRODUCT-SPEC-v2.md#93-exact-export-contracts) generates artifacts only after the plan is launch-ready. That produces a cycle: readiness requires consistent artifacts; artifacts require readiness.

**Required correction.** Narrow the blocker to prohibited *additional* prizes, bonuses, bounties, wheels, or games activated by purchase, while validating the core break against the pinned ruleset. Split readiness into:

1. plan preflight and seller attestations;
2. deterministic artifact generation;
3. post-generation consistency verification; and
4. export release.

Only steps 1 and 2 can block generation; step 3 blocks release. Attestations remain explicitly unverified declarations and expire or require renewal when their relevant plan fields/ruleset change.

### R2-S-M4 — Major: target and result language need a normative tuple

**Attack.** The phrase “Economics clear target at these declared prices” does not specify whether target is zero contribution, a dollar contribution, a percentage on cost, a percentage on revenue, or a show-level target allocated to the break. Nor does it name cash versus decision basis or planned contribution versus planned net.

**Required correction.** Every economic result must serialize and display a tuple:

`{stage, sales-mechanic, revenue-scenario-type, cost-basis, cost-completeness, target-type, target-value, fee-profile-revision, evidence-time}`.

Target types need exact formulas and denominator rules. Result copy is generated from this tuple, not authored ad hoc. Feasibility sketches may show cash and decision thresholds but never a clear/miss status unless their required inputs are present.

## Perspective 2 — popular high-volume Whatnot auctioneer/operator

This operator plans several breaks, moves between a desktop operator station and a streaming phone, delegates hosting/sorting/fulfillment, and reconciles repeated transactions. The unit economics are useful only if operational state is faster and more reliable than the operator's spreadsheet.

### R2-A-C1 — Critical: revision immutability and live state currently contradict each other

**Attack.** [§9.1](../PRODUCT-SPEC-v2.md#91-plans-shows-and-roles) specifies immutable plan revisions and a read-only host run sheet. [§9.3](../PRODUCT-SPEC-v2.md#93-exact-export-contracts) says that run sheet has a sold/remaining tracker, next listing label, and fulfillment handoff. Sold state must change. If the run sheet is literally read-only, it cannot be the live source of truth. If tapping sold mutates the plan, the revision ID no longer identifies the launched assumptions. If it creates a new plan revision after every auction, the host and exported platform artifacts instantly become stale.

**Concrete failure.** Break revision `7K3D` launches with eight spots. The operator sells three positions and changes the next listing. The host's phone still shows `7K3D` with two sold; the desktop shows five; the fulfillment export has four. Every document has the same revision label while representing different operational truth.

**Required correction.** Separate immutable `PlanRevision` from append-only `ShowRun` events and derived `RunState`:

- plan revision freezes product, rules, routing, price assumptions, artifact manifest, and ruleset/fee evidence;
- run events record listing started, position sold/assigned, cancellation/refund, break accounted-for attestation, opening begun, and fulfillment handoff;
- every event has show ID, plan revision, actor/device label, idempotency key, sequence/time, and conflict behavior;
- a changed plan field requires a new revision and explicit relaunch/supersession; a sold event does not;
- offline/manual handoff is allowed only with a visible last-updated state and deterministic merge/refusal rule.

The static V2 can choose a single-writer operator model and export a truly read-only host view. If so, say so. Do not imply shared live collaboration without synchronization infrastructure.

### R2-A-M1 — Major: the “exact” transfer package is still descriptive rather than wire-exact

**Attack.** [§9.3](../PRODUCT-SPEC-v2.md#93-exact-export-contracts) is much better than revision 1 but leaves interoperability decisions to implementation:

- `spots.tsv` does not define header presence/order, UTF-8/BOM, newline, quoting/escaping, blank values, decimal/currency format, duplicate names, field lengths, or whether auction “start” belongs in a Break Manager price column.
- `launch-portrait.png` is “editable-source-backed,” but no editable source file appears in the package.
- `run-sheet.html/pdf` does not say whether both are required or one is selected.
- the package omits the buyer shared-plan link/QR and the title/category/tag suggestions accepted in the round-1 review.
- “full portable non-secret launch plan” does not enumerate fields excluded as seller-private, so a JSON export could leak costs or omit data required for handoff.

Whatnot currently supports spreadsheet pasting for custom spots up to 75 and separates show notes/listing configuration from internal seller workflow ([Whatnot Breaks feature](https://help.whatnot.com/hc/en-us/articles/26596362677389-Breaks-feature-for-sellers)). That does not guarantee ColorBreak's invented TSV dialect will paste cleanly.

**Required correction.** Version schemas and provide golden fixtures validated against the current platform UI. Package an `artifact-manifest.json` with schema versions, canonical plan hash, per-file hashes, public/private classification, generated time, and superseded state. Include the editable source or remove the claim. Define separate public launch JSON/link payload and private operational backup. Require a real paste test with zero edits as a release gate; if Whatnot changes fields, expire the transfer profile just like a fee profile.

### R2-A-M2 — Major: show allocation and actuals import can produce arbitrary P&L

**Attack.** [§9.1](../PRODUCT-SPEC-v2.md#91-plans-shows-and-roles) allows shared promotion, labor, and overhead allocation “by an explicit method” but defines no methods, invariants, or treatment of an unrun/cancelled break. [§9.4](../PRODUCT-SPEC-v2.md#94-actuals-and-reconciliation) flags duplicates but does not define stable row identity, repeat-import idempotency, updates, refunds after settlement, time zone, currency, partial matches, or allocation recomputation.

**Concrete failure.** An operator allocates a $100 promotion by planned revenue before the show, then imports actuals twice and later receives a refund. Depending on import order and whether the cancelled break remains in the denominator, one break can show three different profits without any change to cash reality.

**Required correction.** Define allocation methods (`equal`, `planned-hammer`, `actual-hammer`, `direct minutes`, and manual fixed amounts), require allocations to sum exactly to the show cost, pin planned allocation in the plan revision, and record actual allocation separately in reconciliation. Imports need source-file hash, stable composite key, raw immutable rows, idempotent repeat behavior, correction/refund events, and an unresolved bucket that never disappears into totals. Add 50-row fixtures with duplicates, one cancellation, one later refund, two shipments, and one unmatched listing.

### R2-A-M3 — Major: operator support is simultaneously required and optional

**Attack.** [§9.1](../PRODUCT-SPEC-v2.md#91-plans-shows-and-roles) says that if multi-break/role features are incomplete the UI may call itself **solo plan** and make no high-volume claim. But the same section lists show plans, batches, host sheets, and handoff as seller requirements, while [§15](../PRODUCT-SPEC-v2.md#15-definition-of-testable-v2) only requires that a seller “can hand off the revision.” A manual JSON file can satisfy that sentence while failing the popular-auctioneer job entirely.

**Required correction.** Choose one release claim:

- **V2 solo/occasional seller:** single writer, immutable export, no shared live state; high-volume operator capabilities are explicitly post-V2 and not part of launch research success; or
- **V2 operator-capable:** batch/show plan, plan/run state separation, handoff conflict tests, show allocation, and idempotent actuals import are mandatory public-device gates.

The escape hatch cannot serve as acceptance criteria. Given the user's explicit popular-auctioneer review requirement, the recommended choice is to retain operator-capable V2 but use a single-writer run model rather than pretend to real-time collaboration.

## Feedback disposition after round 2

### Act before implementation

1. Introduce typed auction revenue scenarios and prohibit required/start prices from establishing clear-target status.
2. Make cost completeness typed and evidence-bearing; distinguish planned net from actual net.
3. Make decision-basis selection and non-double-counting normative.
4. Remove buyer surplus from Seller Studio or redefine it as a public card-market comparison that cannot consume buyer-owned inputs.
5. Define deterministic exact-unsold-set/frontier selection.
6. Separate immutable plan revisions from mutable run events/state.

### Act as implementation stories

1. Add per-transaction fee inputs and a transaction-versus-shipment counterexample.
2. Split readiness preflight, generation, postflight consistency, and export release; narrow the prize/chance rule.
3. Specify the economic result tuple and target formulas.
4. Version every transfer schema, add golden paste fixtures, include an artifact manifest, and resolve the editable-source contradiction.
5. Define show-cost allocation invariants and idempotent reconciliation imports.
6. Restore title/category/tag suggestions as seller-confirmed transfer fields; do not make conversion claims.
7. Reinstate numeric operator gates from round 1: two-minute median known-break clone, zero-edit spot transfer, at least 98% automatic matching after a valid 50-row mapping, and zero policy-critical handoff omissions.

### Dismiss

- **Dismiss any request to forecast which spots will remain unsold.** Exact worst-case and user-authored sets are funding stress, not demand predictions.
- **Dismiss an automatically selected “best” opportunity-cost number.** The tool may enforce consistency and surface credible alternatives, but the feasibility and friction of selling sealed remain seller declarations.
- **Dismiss real-time multi-device collaboration as a hidden requirement of a static V2.** A strict single-writer plus immutable/read-only handoff is credible; simulated synchronization is not.
- **Dismiss automatic allocation as economic truth.** Allocation is a declared accounting view and must remain visible beside aggregate show cash results.
- **Dismiss conversion or buyer-demand promises for the launch portrait, titles, or featured cards.** They are consistency and clarity tools until controlled evidence exists.

### Defer with trigger

- **Fill and closing-hammer forecasts:** only after representative seller history can be imported, separated by mechanic, and validated out of sample.
- **Shared multi-user live run state:** only after identity, authorization, durable storage, offline reconciliation, and conflict recovery exist.
- **Direct Whatnot integration:** only after a documented authorized interface exists; continue with user-controlled transfer/import fixtures.
- **Recommendation of graphics/titles for conversion:** only after randomized or credible within-seller tests measure joins, retained viewers, bids, and trust without misleading buyers.

## Marginal-return assessment

Round 1 produced large conceptual corrections: unsupported demand prediction, executable partial fill, incomplete “net,” opportunity-cost blindness, policy-approval language, and solo-workflow drift were all recognized. Round 2 found fewer but still material contract defects. These are not evidence that the product thesis needs another hard reset; they are evidence that normative types and state transitions must be specified before stories are written.

One targeted round 3 should review only the six blockers below against revised formulas, data types, counterexamples, and state diagrams. If those reviewers cannot produce a new Critical finding or a materially different counterexample, additional broad persona rounds are likely to yield insignificant returns. Lower-severity transfer, accessibility, and operator-throughput issues should then be caught by acceptance fixtures and observed usability tests rather than more speculative document review.

## Exact residual blockers

1. **Auction revenue authority:** no start, required threshold, or model-derived number may masquerade as attainable hammer revenue; the seller-authored/actual scenario driving status must be explicit.
2. **Cost truth:** unknown cost lines cannot become zero or unlock net-profit language; planned and actual net must be distinct.
3. **Decision cost:** cash, replacement, and attainable sealed-sale alternatives need a named selection/non-double-counting rule and visible controlling basis.
4. **Buyer/seller boundary:** Seller Studio must not compute “buyer surplus” from buyer-private values or an invented representative buyer.
5. **Unsold-set completeness:** the exact-set stress view needs deterministic worst-set, user-selected-set, and frontier semantics that cannot cherry-pick favorable subsets.
6. **Plan/run consistency:** immutable plan/export revisions must be separated from mutable sold/cancelled/accounted/fulfilled show state, with a credible single-writer or synchronization contract.
