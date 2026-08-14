# ColorBreak V2 implementation backlog

Status: Approved for implementation after round-3 mechanical conformance
Method: vertical TDD slices; acceptance and gates precede code
Release definition: `PRODUCT-SPEC-v2.md` section 15

## Public-preview progress — 2026-08-13

- [x] Chase Map impossible-domain clamp and plot-bound marker geometry, with regression fixtures.
- [x] V2 buyer value-rule math, hammer-dependent cap solver, action mapping, and immutable-cap primitives.
- [x] Buyer product → color/taken → options sequence and warm/cold bid-cost persistence.
- [x] Bid Check command-center reset with a single live decision surface, flat setup rail, and one optional evidence rollout.
- [x] Seller complete-cost arithmetic and first-result run/change/do-not-run feasibility screen.
- [x] Flat mobile presentation and 440×956 preview geometry pass.
- [ ] Treatment-study gate and all production fallback variants.
- [ ] Immutable PlanRevision/ShowRun operations, rules pipeline, and launch-package export.
- [ ] Physical iPhone 17 Pro Max acceptance evidence; simulator evidence cannot close this gate.

## Global definition of done

Every story requires: red test first at a public seam; counterexample fixtures where relevant; focused green tests; affected regression suite; `npm run build`; `git diff --check`; no debug artifacts; 320 px/200% reflow; 440×956 target viewport; keyboard/focus/scroll check; accessible name/state; and no unrelated changes. Release stories additionally require full CI, public asset verification, and physical-device evidence where specified.

## Sprint 0 — Foundation and safety contracts

### V2-001 Buyer treatment domain

**Outcome:** Pure module returns the rollout-selected `Precise`, `Range`, `HardCap`, or refusal treatment and never conflates current hammer, next bid, or all-in values.

**Acceptance:** Implements median/coverage/average order statistics; hammer-dependent `C(h)` solver over declared domain; empty-domain refusal; strict under/at/over; SavedCap/ActiveCeiling transitions; range/hard fallbacks; exact fixtures 1–6, 9–10, 22.

**Unit tests before code:** `src/domain/buyer-treatment.test.ts` uses literal fixtures from spec; property tests assert cap safety/maximality, comparison exclusivity, cap invariance to current hammer, no upward adoption, and no-copy refusal.

**Gate:** No UI consumes old `buyerVerdict` for V2.

### V2-002 Provenance and evidence sensitivity

**Outcome:** Immutable result identity, source/seller/buyer/private ownership, current eligible evidence, joint uncertainty decision.

**Acceptance:** Protected-sink projections exclude opposite-side sentinels; stale seller revision cannot drive buyer; joint bound crossing refuses; nonmaterial bounded omission remains Ready; fixtures 7–8, 10, 14–15.

**Tests:** `src/domain/provenance.test.ts`, `src/domain/decision-sensitivity.test.ts` written red first.

**Gate:** serialized/public/cache/worker projections audited; no private value in URL/analytics/export.

### V2-003 Workspace state stability harness

**Outcome:** Buyer costs, selected/taken slots, prepared artifact, focus, and scroll survive recalculation/restore.

**Acceptance:** threshold/mode/slot/product updates do not clear buyer numeric input; unsupported repeat state immediately evicts stale cap; cold local restore is one action.

**Tests:** React seam tests plus browser script asserting input/focus/scroll; existing persistence tests stay green.

## Sprint 1 — Bid Check decision foundation

### V2-101 Compact composition and slot control

**Outcome:** One unboxed composition header; colors immediately after product; one-tap taken/undo.

**Acceptance:** no add button in global upper-right; input order matches spec; 44 px targets; selected/taken state readable without color.

**Tests:** DOM order, accessible labels, input persistence, target-size CSS gate.

### V2-102 Prepare treatment picker

**Outcome:** User explicitly selects Median, Coverage, or Average-dollar rule and acknowledges costs; no normative default.

**Acceptance:** plain controlling statement; unknown costs refuse; saved artifact immutable; feature flag selects precise/range/hard treatment.

**Tests:** interaction fixtures, reload/adoption/no-cap transitions.

### V2-103 Live first viewport

**Outcome:** At 440×956, tagged treatment result, next bid, comparison, costs, taken/undo appear without explanation-dependent UI.

**Acceptance:** no total-break EV/Break Balance/Chase Map/contributor grid; tabular stable values; keyboard keeps edit/result visible; no viewport jump.

**Tests:** rendered content/exclusions, exact three variants, equality/crossing, Playwright geometry and scroll assertions.

### V2-104 Ranked risk/evidence detail

**Outcome:** One-tap detail exposes rule-tied distribution, loss frequency/shortfall, zero mass, ranked exact printings, concentration, evidence ledger.

**Acceptance:** exact finish/treatment/price state; unavailable price is not $0; list/filter precedes any chart; Chase Map omitted from V2.

**Tests:** fixtures for unavailable chase, source identity, list sorts, accessible semantic summary.

### V2-105 Wanted-card composite

**Outcome:** Non-overlapping versioned target groups, copy limits, deterministic heterogeneous allocation, joint/per-target frequencies.

**Acceptance:** fixtures 4 and player/collector scripts; routing shown; residual mode explicit; buy-single limitations.

**Tests:** public wanted evaluator with homogeneous/heterogeneous/ties/overlap/missing price.

### V2-106 Bid Check command-center reset

**Outcome:** Replace the explanation-heavy buyer dashboard with one fast workspace: editable break setup beside a live decision surface on large screens, and the complete live decision first on the target phone.

**Acceptance:** Recommendation, maximum hammer, current bid, incremental shipping, risk stance, outcome range, and chance-to-cover share one named region; product/slot/evidence context stays visible; setup remains product → color/taken → value options; total break value, Break Balance, evidence, and ranked cards are closed under one optional rollout; Chase Map is absent; bid/shipping persist; no horizontal overflow or selection-triggered scroll.

**Tests before code:** `src/bid-check-command-center.test.ts` at the rendered workspace seam, plus the existing setup-order, buyer-persistence, bulk-filter, help-layout, and disclosure suites.

**Gate:** Focused regression suite green; production build and diff check green; at 440×956 the decision occupies y=141–694, body width equals scroll width, input values survive reload and risk changes, risk changes retain scroll y=0; at 1440×900 setup and decision form stable 510 px / 676 px columns.

## Sprint 2 — Seller conditional economics

### V2-201 Typed seller plan and revenue scenarios

**Outcome:** sales mechanic and closed revenue union prevent starts/requirements from becoming revenue.

**Acceptance:** fixture 16; no auction clear/miss without seller hypothesis/actual; literal conditional copy.

**Tests:** `seller-economics.test.ts` red first.

### V2-202 Cost ledger and decision basis

**Outcome:** typed acyclic costs, cash versus opportunity views, contribution/planned/actual labels.

**Acceptance:** fixtures 17–18; blank never zero; leaf cost subtracted once; status tuple serialized.

**Tests:** cycle, included ancestor, numeric target flip, actual rejects estimated.

### V2-203 Fee profiles and transactions

**Outcome:** dated/expiring fee profiles calculate per transaction, separate shipments.

**Acceptance:** fixture 19; unknown processing bases create sensitivity; expired profile blocks Ready.

**Tests:** exact Whatnot worked cases, two transactions/one shipment, tier/fee-tax override.

### V2-204 Feasibility and launch-ready Seller UI

**Outcome:** first viewport shows conditional economics, required revenue, declared scenario/basis/completeness, weak-spot action—without nested panels.

**Acceptance:** rough sketch cannot export/status; launch-ready names every assumption; negative values visible.

**Tests:** stage transitions, label correctness, mobile geometry.

### V2-205 Adverse funding frontier

**Outcome:** deterministic exact adverse/fragile/actual/user unsold sets with sealed gate.

**Acceptance:** fixture 12; no likelihood language; product cannot be marked open before accounted.

**Tests:** unequal/tied/flat prices and deterministic identity tie break.

## Sprint 3 — Seller operations and launch pack

### V2-301 PlanRevision / ShowRun

**Outcome:** immutable plan, append-only idempotent run events, single writer/read-only host view.

**Acceptance:** fixture 20; sold changes RunState not plan hash; conflicts queue/refuse.

**Tests:** reducer/event identity/idempotency/supersession/cold export.

### V2-302 Ruleset readiness pipeline

**Outcome:** preflight → attest → generate → postflight → release with dated ruleset.

**Acceptance:** core random break allowed; prohibited extra chance blocked; Needs Whatnot review; expired attestation behavior.

**Tests:** compliance fixtures and artifact mismatch.

### V2-303 Transfer package

**Outcome:** manifest, wire-exact TSV, notes, public/private JSON, SVG/PNG, host HTML/PDF, title/category/tag, buyer QR.

**Acceptance:** zero-edit current-profile paste; all hashes/revisions consistent; expired profile blocks claim; no private leak.

**Tests:** golden bytes, schema validation, public projection sentinels, render geometry.

### V2-304 Show allocation and actuals import

**Outcome:** exact allocations, idempotent mapped rows, correction/refund events, unresolved bucket.

**Acceptance:** 50-row fixture ≥98% automatic match; allocations sum; repeated import unchanged.

**Tests:** file hash/composite keys/timezone/currency/duplicate/refund/shipment cases.

## Sprint 4 — Modernization, validation, public release

### V2-401 Visual-system replacement

**Outcome:** Remove nested panels/pervasive radii/shadows; editorial hierarchy, functional containers only.

**Acceptance:** repository CSS gate prohibits panel nesting and unauthorized radius/shadow tokens; primary flows match spec; reduced motion.

**Tests:** modernization CSS/DOM tests and visual screenshots at 320/440/desktop.

### V2-402 Accessibility and performance

**Outcome:** WCAG 2.2 AA and task performance gates.

**Acceptance:** targets, focus/dialogs, VoiceOver labels, 200%, no shifts; LCP/INP/CLS and cached response targets.

**Tests/gates:** automated a11y/performance budgets plus manual protocol checklist.

### V2-403 Treatment validation flag

**Outcome:** feature flag ships the treatment supported by preregistered study; precise cannot bypass failure.

**Acceptance:** all three variants production-complete; corrupted-advice gate result maps mechanically; public label matches validation state.

### V2-404 iPhone 17 Pro Max public release

**Outcome:** Public URL satisfies spec §15.

**Gate:** CI/full suite/build; public asset hash; physical device script and evidence artifact for clean/warm portrait/landscape/chrome/keyboard/app-switch/clipboard/200%/home-screen; no Critical blocker. If physical hardware cannot be controlled autonomously, simulator/440×956 evidence is published as incomplete and task is not declared complete.

## Sprint sequencing rule

Stories run in listed dependency order, but each sprint ships a coherent vertical public increment. No later story can weaken a prior safety invariant. Every story begins by copying its acceptance bullets into a test file or gate checklist before implementation.
