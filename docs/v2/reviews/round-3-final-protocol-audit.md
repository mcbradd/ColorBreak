# Round 3 final protocol and economic audit

Date: 2026-08-13
Artifact reviewed: [`PRODUCT-SPEC-v2.md`, revision 3](../PRODUCT-SPEC-v2.md)
Scope: current decision evidence, joint uncertainty, private-data noninterference, readiness/transfer ordering, physical-device protocol, precise-cap rollout, and the 21 required counterexamples
Severity threshold: Critical and Major findings only

## Verdict

Revision 3 closes most of the round-2 contract failures. In particular, it makes evidence eligibility engine-owned, evaluates uncertainty jointly, enumerates protected noninterference sinks, separates plan preflight from post-generation consistency, and defines a credible fallback ladder for a failed precise-cap experiment.

It is not yet a final implementation contract. One Critical contradiction means a failed precise-cap study can mechanically select a fallback that the rest of the spec forbids. Five Major gaps leave evidence provenance, uncertainty-state authority, transfer freshness, physical-device measurement, and several mandatory fixtures non-deterministic.

## Finding summary

| ID | Severity | Finding | Consequence |
|---|---|---|---|
| FP-C1 | Critical | The precise-cap fallback is selected in section 12 but contradicted by the release promise, core screens, and Definition of testable V2 | A failed safety study has no shippable V2 contract; stories can still be judged against the unsafe point-cap UI |
| FP-M1 | Major | Historical reconstruction evidence, current decision evidence, and evidence-policy versions are not separately bound into one result identity | A cache/share/result can remain apparently current after the engine changes eligibility, freshness, proxy, or uncertainty rules |
| FP-M2 | Major | `Sensitive` versus `No modeled cap` is not deterministic when joint uncertainty crosses the decision | The same bound-crossing buyer case can legally produce advice or refusal; counterexample 10 explicitly accepts both |
| FP-M3 | Major | The physical iPhone requirements are a coverage checklist, not a reproducible test protocol | The public-device gate can pass under favorable preload, network, browser-state, timing, or repetition choices |
| FP-M4 | Major | The transfer profile has no dated lifecycle or stale-profile release behavior | A formerly valid zero-edit paste can still be released after Whatnot changes its UI contract |
| FP-M5 | Major | The 21-item counterexample suite is not acceptance-grade | Several required tests have no exact inputs or single expected result, so incompatible implementations can all pass |

## Critical finding

### FP-C1 - Failed precise-cap research has no coherent product contract

**Attack.** [Section 12.1](../PRODUCT-SPEC-v2.md#121-buyer-usability-and-economic-validity-precise-cap-rollout-gate) says precise cap is not the production default until the research gate passes. Failure mechanically selects cap range; failure of range selects distribution plus a buyer-entered hard cap. That is the correct safety hierarchy.

However, the normative product remains point-cap-only:

- [the buyer release promise](../PRODUCT-SPEC-v2.md#21-buyer-promise) promises a maximum hammer;
- [the cap contract](../PRODUCT-SPEC-v2.md#52-cap-rules) requires the buyer to save a dollar cap;
- [the first viewport](../PRODUCT-SPEC-v2.md#73-live-first-viewport) is built around `YOUR TOTAL MAX BID` and a copy action;
- [the public test seams](../PRODUCT-SPEC-v2.md#13-public-test-seams) require the cap seam to return a cap or no-cap;
- [the Definition of testable V2](../PRODUCT-SPEC-v2.md#15-definition-of-testable-v2) requires choosing a cap rule and copying a total Max Bid.

No normative range or distribution-only first viewport, transfer behavior, comparison semantics, restore semantics, acceptance criteria, or public-device gate exists. A failed study therefore selects an experience that cannot satisfy V2.

**Counterexample.** The precise treatment exceeds the preregistered harm margin. The range treatment passes. Section 12 requires cap range to ship, while section 15 fails that same build because the buyer cannot copy one modeled total Max Bid.

**Required correction.** Make the release mode a closed, engine/config-owned union such as `precise-cap | cap-range | distribution-hard-cap`. Specify for every branch: first viewport, comparison language, what may be copied or transferred, saved-state migration, stale-result eviction, restore flow, research label, test seam, and Definition of testable V2. The production feature flag must be write-protected from ordinary stories and derived only from a versioned study decision record. Add fixtures proving a failed treatment cannot render or serialize its forbidden output.

The research protocol must also predeclare the exact primary harm estimand, comparator, non-inferiority margin, confidence level, and decision rule before treatment code is exposed to participants. "Pre-register later" is a required task, not yet an executable go/no-go gate.

## Major findings

### FP-M1 - Current decision evidence is named but not fully bound to result identity

**Attack.** [Section 6.2](../PRODUCT-SPEC-v2.md#62-materiality-rule) correctly distinguishes seller-link historical reconstruction from the current eligible evidence used for buyer decisions. It also makes eligibility, freshness, proxy prohibition, and parameter bounds engine-owned and versioned. But the serialized identities elsewhere carry only a generic `source revision` or `evidence revision`. The spec never requires a buyer result/cache key to bind all of:

1. historical reconstruction revision;
2. current decision evidence revision;
3. evidence eligibility/freshness/proxy-policy revision;
4. joint uncertainty-set rule revision and simulation-tolerance revision.

The sentence requiring canonical public projection before hashing protects privacy, not freshness. Engine ownership without explicit result binding still permits a result computed under yesterday's eligibility rule to be restored from a cache after that rule changes.

**Counterexample.** A price observation and source-data revision remain byte-identical, but an engine policy update shortens the eligible freshness window. The old cache key contains the generic evidence revision and still restores `Ready`; a fresh evaluation is `No modeled cap`. Both behaviors conform to the current wording.

**Required correction.** Define distinct normative identifiers, include all four in buyer result provenance, the accepted-cap tuple, cache key, restore validation, diagnostic record, and any result/share hash, and require atomic invalidation when any one changes. Historical reconstruction must remain displayable without being accepted as the current decision revision.

### FP-M2 - Joint uncertainty can produce either sensitivity or refusal

**Attack.** [Section 6.1](../PRODUCT-SPEC-v2.md#61-states) says plausible bounds crossing a decision produce `No modeled cap / Launch blocked`. [Section 6.2](../PRODUCT-SPEC-v2.md#62-materiality-rule) then says `Sensitive` names the switching combination and decision range. Mandatory counterexample 10 codifies the ambiguity as `Sensitive/no cap`.

This is not a copy issue. The presence or absence of a precise dollar cap is the safety boundary. `Sensitive with a cap`, `Sensitive with only a range`, and `No modeled cap` cannot be interchangeable outcomes.

**Counterexample.** The joint feasible set gives caps from $19 to $22 while the next legal bid is $21. One implementation displays a sensitive $22 cap and switching combination; another refuses a modeled cap. Both can claim conformance.

**Required correction.** Define an ordered state machine with one output authority per state. At minimum, specify whether crossing the under/at/over relationship always suppresses a point cap, whether a non-crossing but near-boundary set may retain one, and how this interacts with the release-mode fallback from FP-C1. Rewrite fixture 10 with numeric bounds and one exact state/output.

### FP-M3 - The physical-device gate is not reproducible

**Attack.** [Sections 7.1](../PRODUCT-SPEC-v2.md#71-entry-and-restore), [11](../PRODUCT-SPEC-v2.md#11-performance-and-device-gates), and [12.1](../PRODUCT-SPEC-v2.md#121-buyer-usability-and-economic-validity-precise-cap-rollout-gate) name the right conditions: physical iPhone 17 Pro Max, warm and cold return, Safari chrome states, keyboard, 200% text, wrong-plan cases, clipboard denial, and separate prepared/live timing. They do not define a runnable protocol.

Missing controls include the iOS/Safari build, network profile, cache/service-worker state, exact fixture and starting plan state, whether authentication/interstitial time is in scope, clock start/stop events for prepared and live tasks, required repetitions and aggregation, how chrome/keyboard/zoom states are established, expected observations per step, and retained evidence such as screen recording and build/asset identity.

**Counterexample.** A team prewarms the service worker and product data, starts on the correct restored plan, times only after app switch, and runs once. Another starts from an evicted process on constrained cellular and includes wrong-plan correction. Both report the required p90 even though they measured different tasks.

**Required correction.** Add a versioned physical-device script with fixed public build hash, device/OS/browser metadata, network/cache matrix, exact start and terminal events, participant/repetition rules, expected state after every adversarial step, recording/log artifacts, and separate pass/fail tables for prepared transfer and live fallback. A simulator may supplement but never satisfy the physical-device gate.

### FP-M4 - Transfer correctness has no freshness lifecycle

**Attack.** [Section 9.3](../PRODUCT-SPEC-v2.md#93-exact-export-contracts) resolves the wire-format problems from round 2: TSV encoding, header/order, escaping, price representation, artifacts, hashes, public/private split, and golden fixtures are explicit. It says fixtures are verified against the "current platform UI" and refers to a pinned transfer profile, but never defines that profile's source/effective/checked/expiry identity or what happens when it becomes stale.

This matters because platform paste behavior is external and mutable. A schema can be internally deterministic while no longer being accepted with zero edits.

**Counterexample.** Whatnot changes the custom-spot paste column order after the last golden verification. ColorBreak still generates a hash-consistent package and releases it because no expired/unknown transfer-profile state blocks release.

**Required correction.** Define an immutable `TransferProfile` carrying platform surface, field semantics, schema version, source/reference, verified UI build or observation date, checked date, expiry/recheck policy, and fixture hash. Unknown or expired profiles must block the zero-edit claim and export release or produce a clearly separate generic export that cannot satisfy the launch-ready gate. Put transfer-profile validation in preflight; post-generation verifies bytes against that pinned profile.

### FP-M5 - The required counterexamples are not all deterministic fixtures

**Attack.** [Section 14](../PRODUCT-SPEC-v2.md#14-required-counterexample-suite-before-implementation-acceptance) improves the suite to 21 cases, and the numeric cap, quantile, wanted-value, resale, funding-frontier, and opportunity-cost examples are hand-checkable. But several rows still describe a property rather than provide exact inputs and one expected output:

- **#7 and #8:** do not instantiate every protected sink or the canonical public projections, so a headline-only sentinel test can pass.
- **#10:** explicitly permits two terminal states (`Sensitive/no cap`) and supplies no numeric joint feasible set.
- **#13:** supplies no position population, collation distribution, owned positions, bundled-cost schedule, or expected incremental cap; "updates" is not an assertion.
- **#15:** defines materiality circularly (a bound that cannot/can move the comparison) without prices, bounds, dependency rule, cap, or expected provenance.
- **#19:** supplies transaction hammers but no fee-profile values, shipping/tax inputs, or exact total fees.
- **#20:** names one mismatched field but does not enumerate which artifacts must be regenerated/rejected or the exact manifest/revision result.
- **#21:** states an axis invariant but supplies no signed dataset, scale domain, zero-line representation, or semantic-alternative assertion.

The suite also omits required executable cases for (a) removing one value-moving seller declaration across the buyer decision boundary, (b) an evidence-policy-only revision invalidating a restored result, (c) precise-cap study failure selecting and enforcing each fallback, and (d) stale transfer-profile release refusal.

**Required correction.** Convert the section into named fixture records. Each must declare canonical inputs, relevant rule/revision IDs, exact expected numeric output or terminal state, serialized provenance, protected sinks or artifacts examined, and forbidden outputs. Split compound rows when they exercise different states. Do not permit alternatives such as `Sensitive/no cap` in an expected result.

## Controls that passed this audit

These areas do not have a remaining Critical or Major specification defect:

- **Private-data noninterference:** [section 3](../PRODUCT-SPEC-v2.md#3-provenance-and-noninterference) enumerates display, serialization, URL/public projection, plan hash, export, cache, analytics/diagnostics, worker, and network sinks; requires canonical public projection before hashing/sharing; requires opposite-side byte equivalence; and prohibits private-dependent external requests.
- **Readiness ordering:** [section 9.2](../PRODUCT-SPEC-v2.md#92-launch-readiness-checker) now orders plan preflight, attestations, deterministic generation, post-generation consistency, and release. Artifact mismatch blocks release rather than creating the round-2 generation cycle. The additional-prize blocker is correctly distinguished from the disclosed core random break.
- **Core transfer bytes:** [section 9.3](../PRODUCT-SPEC-v2.md#93-exact-export-contracts) is sufficiently exact about TSV encoding and fields, manifest hashes/classes, editable portrait source, public/private JSON separation, and run-sheet artifacts. FP-M4 concerns profile freshness and release authority, not those byte contracts.
- **Joint evaluation shape:** engine-owned bounds, declared dependencies, conservative envelopes, joint evaluation, and simulation tolerance are present. FP-M1 and FP-M2 concern result identity and terminal-state authority, not a return to one-variable-at-a-time sensitivity.

## Marginal-return assessment

Further review has **not yet** reached insignificant expected returns: this targeted pass found one Critical rollout contradiction and Major defects that can change whether a buyer receives a precise recommendation or whether a seller receives a supposedly current transfer package.

Another broad seven-perspective ideation round is unlikely to be useful. The appropriate remaining review is one surgical revision followed by a mechanical conformance audit of:

1. the three release-mode branches and feature-flag decision record;
2. evidence/result identity and invalidation;
3. the uncertainty state machine;
4. the dated transfer profile and readiness transitions;
5. a runnable physical-iPhone protocol; and
6. the completed executable fixture corpus.

If that audit produces no new Critical/Major counterexample, additional document review should stop. Remaining discoveries should come from implementation gates, physical-device observation, and the preregistered buyer study rather than more persona speculation.

---

## Re-audit after amendments

Date: 2026-08-13
Method: mechanical cross-section check of the six amendment targets and hand-check of fixtures 1-22
Relationship to prior verdict: this section supersedes the status of the findings above where marked resolved

### Re-audit verdict

Five amendment targets pass. One Major cross-section defect remains. The former Critical fallback defect is materially reduced because the fallback algorithms and Definition of testable V2 now exist, but the precise-cap presentation is still an unconditional normative requirement in four other sections. No other Critical or Major defect was found in the amended areas.

| Audit target | Result | Mechanical disposition |
|---|---|---|
| Fallback contract and Definition of V2 | **Fail - Major** | The branch contract and section 15 are corrected, but sections 1, 2.1, 2.3, 7.2, 7.3, and 13 still unconditionally specify the precise-cap experience |
| Result revision identity | **Pass** | Section 6.2 separately binds historical reconstruction, current decision evidence, evidence policy, joint uncertainty rule, simulation, declarations, and private-choice revisions |
| Deterministic `Sensitive` versus no-cap | **Pass** | Section 6.2 assigns crossing sets to no-cap/missing-assumptions and reserves `Sensitive` for a robust conservative result; fixture 10 has one result per stated case |
| Physical-device protocol | **Pass** | Section 11 requires a versioned physical-device script, fixed build/fixture, cache/network/browser state, exact clock events, repetitions, recordings/traces, checkpoints, errors, and committed evidence; desktop emulation cannot pass |
| Transfer-profile expiry | **Pass** | Section 9.3 makes profiles source-dated/versioned/expiring, pins revision and expiry in the manifest, and blocks zero-edit claims and release when expired or unverified |
| Executable fixtures 1-22 | **Pass** | The amended numeric and state fixtures now determine the intended result; structural fixtures are bounded by the normative sink, artifact, fee, and chart contracts they reference |

### Remaining Major defect - fallback mode is not propagated through the normative UI contract

[Section 5.4a](../PRODUCT-SPEC-v2.md#54a-feature-gated-fallback-contracts) now defines `precise-cap`, `cap-range`, and `distribution + hard-cap` behavior, and [section 15](../PRODUCT-SPEC-v2.md#15-definition-of-testable-v2) correctly makes public acceptance conditional on the selected treatment. Fixture 22 also makes the range and hard-cap transitions executable.

The following text still requires a point cap regardless of the selected treatment:

- [section 1](../PRODUCT-SPEC-v2.md#1-product-boundary) defines Bid Check only as preparing and comparing a modeled financial cap;
- [sections 2.1 and 2.3](../PRODUCT-SPEC-v2.md#2-release-promises) promise a maximum hammer, copy-total-cap workflow, and buyer cap/comparison as required scope;
- [sections 7.2 and 7.3](../PRODUCT-SPEC-v2.md#72-prepare-sequence) require `Prepared cap`, `Copy total Max Bid`, and a first viewport headed `YOUR TOTAL MAX BID` with precise under-cap copy;
- [public seams 2 and 3](../PRODUCT-SPEC-v2.md#13-public-test-seams) accept/return only a cap and precise under/at/over comparison.

**Counterexample.** The precise treatment fails and the range treatment passes. Section 5.4a and fixture 22 require `SafeThrough $19 / PossibleThrough $23` and `inside assumption-sensitive range`; section 7.3 simultaneously requires `YOUR TOTAL MAX BID`, one copied cap, and `Under your cap by $X`. An implementation cannot satisfy both normative first-view contracts without presenting the conservative endpoint as the precise recommendation that the fallback forbids.

**Required final amendment.** Make sections 1, 2.1, 2.3, 7.2, 7.3, and public seams 2/3 explicitly treatment-conditional. Provide three compact first-viewport contracts or one tagged union whose labels/actions are exhaustive for all modes. In the range branch, `SafeThrough` must not inherit `YOUR TOTAL MAX BID` or ordinary Copy-cap language; in the hard-cap branch, only the buyer-authored limit may drive comparison.

### Fixture 1-22 mechanical check

| # | Result | Determined assertion |
|---:|---|---|
| 1 | Pass | $19 cap, $23.90 all-in, unknown-tax refusal, and empty-feasible-set state |
| 2 | Pass | Exclusive under/at/over equality semantics; current hammer is non-authoritative |
| 3 | Pass | Lower median $10, coverage targets $10/$0, mean $17.50 |
| 4 | Pass | Replacement personal value totals $68; heterogeneous allocation and canonical tie-break are specified |
| 5 | Pass | Saved history, favorable/adverse adoption, no-cap eviction, and cold restore are distinct |
| 6 | Pass | Next legal bid drives comparison without changing cap |
| 7 | Pass | All buyer protected sinks and external-request behavior are covered by the section-3 sink set |
| 8 | Pass | All seller protected sinks are byte-equivalent under buyer-private changes |
| 9 | Pass | Equal means do not erase distinct 75%-coverage targets |
| 10 | Pass | $19-$23 crossing interval yields no precise cap; stable conservative interval yields Sensitive |
| 11 | Pass | Release-A resale transform gives $81.70 versus $0 before outbound cost |
| 12 | Pass | Adverse set and $50/$80 remaining-revenue frontier are fixed |
| 13 | Pass | Existing W forces next U, evicts stale $10, and unsupported identity refuses immediately |
| 14 | Pass | Current eligible evidence controls and material historical divergence blocks precise cap |
| 15 | Pass | $20 invariant cap is Ready; $18-$25 routing interval crossing next $21 is no-cap |
| 16 | Pass | Start/requirement cannot create profit status; explicit $32 hypothesis can create conditional copy |
| 17 | Pass | Cash view is positive while $180 decision basis misses $170 contribution by $10 |
| 18 | Pass | Planned net is $60 and misses $75 by $15; blank/zero/include-cycle states are distinct |
| 19 | Pass | Two transaction rows incur two fixed processing charges despite one shipment; exact dollar amount is fee-profile-parameterized |
| 20 | Pass | Manifest mismatch blocks release; run event cannot mutate the plan hash |
| 21 | Pass | Signed domains contain the negative value and zero reference; gross/probability remain nonnegative and require semantic alternatives under section 10.4 |
| 22 | Pass | Failed precise treatment selects range labels/actions; failed range selects buyer-hard-cap mode and forbids modeled-cap labeling |

### Final marginal-return assessment

Further review has **not quite reached insignificant return** because the remaining fallback/UI contradiction can still put forbidden point-recommendation language into the production fallback. It requires a small cross-section amendment, not another research or persona round.

After that propagation edit, a final search confirming that point-cap labels occur only inside the precise treatment is sufficient. If it passes, additional document review will have insignificant expected return; subsequent learning should come from implementation gates, the physical-device run, and preregistered studies.

### Final propagation confirmation

Date: 2026-08-13
Result: **Pass - no remaining Critical or Major defect in the audited contracts**

This confirmation supersedes the preceding interim marginal-return assessment.

The final amendment closes the one Major issue left by the first re-audit:

- [section 1](../PRODUCT-SPEC-v2.md#1-product-boundary) defines Bid Check through the rollout-gate-selected treatment rather than an unconditional point cap;
- [sections 2.1 and 2.3](../PRODUCT-SPEC-v2.md#2-release-promises) promise a buyer-owned treatment artifact and permit copying only when that treatment allows it;
- [section 7.2](../PRODUCT-SPEC-v2.md#72-prepare-sequence) returns the selected tagged variant and only its permitted action;
- [section 7.3](../PRODUCT-SPEC-v2.md#73-live-first-viewport) exhaustively renders `precise`, `range`, and `hard` labels, comparisons, and actions, and explicitly makes precise labels/actions unavailable in the fallback variants;
- [public seams 2 and 3](../PRODUCT-SPEC-v2.md#13-public-test-seams) accept and return the tagged union, with impossible cross-treatment labels/actions unrepresentable;
- [section 15](../PRODUCT-SPEC-v2.md#15-definition-of-testable-v2) remains conditional on the rollout-selected treatment.

A final text search found the ordinary `Your total Max Bid`, `Under/At/Over cap`, and copy-total-cap semantics only in the precise-cap contract that the tagged union references. The range branch owns `SafeThrough/PossibleThrough` and below/inside/above language; the hard-cap branch owns the buyer-authored limit. Fixture 22 agrees with those types and labels.

All six re-audit targets now pass: fallback/Definition of V2, result revision identity, deterministic uncertainty state, physical-device protocol, transfer-profile expiry, and fixtures 1-22. The prior Critical and Major findings are closed by the amended normative text.

**Marginal-return conclusion.** Further speculative document or persona review now has insignificant expected return. Review should stop. Remaining evidence must come from story acceptance tests, protected-sink and counterexample fixtures, the versioned physical-iPhone run, transfer-profile validation, and the preregistered buyer safety study.
