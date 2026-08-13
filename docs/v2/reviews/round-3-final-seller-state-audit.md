# Round 3 final seller-state audit

Date: 2026-08-13
Artifact reviewed: `docs/v2/PRODUCT-SPEC-v2.md`, revision 3 only
Scope: the six residual seller blockers named for final review, plus counterexamples 16–20
Method: antagonistic contract audit against the failure modes and required corrections from the round-2 seller/auctioneer review

## Verdict

**Five of the six seller-state blockers pass. Cost completeness/planned-net arithmetic has one Major residual. No Critical residual remains in this audit scope.** Revision 3 now has credible contracts for typed auction revenue, decision-basis selection, buyer/seller data separation, adverse funding sets, and immutable plan versus mutable run state. However, it still does not normatively define the arithmetic that turns contribution profit into planned net profit, and fixture 18 does not catch that omission.

| Audit target | Result | Basis |
|---|---|---|
| Revenue scenario types and status authority | **Pass** | §8.2 serializes `revenueScenarioType`; §8.4 defines a closed, non-interchangeable union. Starts and required thresholds cannot establish conditional status, seller hammer hypotheses produce explicitly conditional copy, and final clear/miss waits for complete actuals. |
| Typed costs; contribution, planned net, and actual net | **Fail — Major** | Cost-line states, blank/zero behavior, inclusion-cycle rejection, and planned-versus-actual labels are defined. The planned-net arithmetic itself is not. See R3-S-M1. |
| Decision basis and non-double-counting | **Pass** | §8.2 discriminates not-yet-owned landed acquisition from owned-inventory opportunity cost, selects the highest credible feasible foregone net benefit, preserves visible alternatives and dismissal reasons, and expressly forbids summing cash and decision product bases for the same units. |
| No buyer-private surplus in Seller Studio | **Pass** | §§1 and 3 establish noninterference; §8.6 uses only a public gross card-market comparison, explicitly excludes buyer costs/preferences, and does not call the result buyer surplus. Buyer-private changes are byte-inert to seller sinks under the required sentinel tests. |
| Deterministic adverse funding frontier | **Pass** | §8.5 requires the exact adverse `k`-spot set, deterministic price-descending identity tie-breaks, min/max revenue bounds, separately labeled fragile/actual/user sets, an auditable constrained solver, and the do-not-open gate. It does not infer likelihood or partial-opening permission. |
| Immutable plan versus append-only run state; single writer | **Pass** | §9.1 freezes `PlanRevision`, appends idempotent `ShowRun` events, derives `RunState`, prevents sold events from mutating the plan, names event identity/conflict fields, chooses one desktop writer, and makes mobile host state read-only with last-updated visibility. Offline conflict behavior is refusal/queueing, not silent merge. |

## Major residual

### R3-S-M1 — Planned net can be a relabeled contribution result instead of a complete-cost result

**Attack.** Section 8.2 gives an explicit contribution-profit equation that subtracts commission, processing, the selected product basis, supplies, seller shipping, promotion, and declared variable operating costs. It then says that result “becomes planned net profit” when labor/time, tax on fees, minimum-card fulfillment, giveaways, refund/cancellation/damage allowance, and allocated fixed show overhead are non-unknown. It never states that those newly complete costs are subtracted, nor gives a planned-net equation or cost-ledger summation rule. Labor and fixed show overhead cannot safely be assumed to be part of “declared variable operating costs.” An implementation can therefore satisfy the state gate, relabel the contribution number as planned net, and overstate the seller result while conforming literally to the current text.

**Counterexample gap.** Fixture 18 verifies blank labor, explicit zero, and inclusion-cycle behavior, but not arithmetic. It would pass even if a measured `$25` labor line and a measured `$15` refund/damage allowance unlock the planned-net label without reducing the result by `$40`. The round-2 requirement that a refund allowance change target status remains untested.

**Required correction before implementation acceptance.** Define planned net as revenue under the named scenario minus the selected non-double-counted product basis and every resolved leaf cost in the acyclic typed cost ledger, including labor/time, tax on fees, fulfillment minimums, giveaways, refund/cancellation/damage allowance, and allocated fixed show overhead. `included-in:<line-id>` contributes exactly once through its resolved ancestor. Define actual net by the same ledger over reconciled actual revenue/cost events, with no `estimated` or `unknown` leaf allowed unless the output is explicitly provisional and not called actual net. Extend fixture 18 with numbers that prove a refund/damage allowance (and preferably labor) changes both dollars and clear/miss status.

Severity is **Major**, not Critical, because revision 3 now blocks unknowns, distinguishes planned from actual, and itemizes unmodeled costs; the remaining defect is a normative arithmetic/test hole rather than permission to treat blank costs as zero.

## Counterexamples 16–20

| Fixture | Result | Audit |
|---|---|---|
| 16 — auction start/threshold/hypothesis/actual separation | **Pass** | Exercises the principal revenue-authority failure: start and required threshold produce no status, while a seller hypothesis is named in conditional copy and actuals stay separate. |
| 17 — cash `$80`, replacement `$150`, sealed net `$180`, pre-product contribution `$170` | **Pass** | Forces the `$180` owned-inventory decision comparator, a `$10` decision-basis miss, a separate positive cash view, and no summing of bases. |
| 18 — blank labor, explicit zero, included-in cycle | **Fail — Major** | Adequately tests typed state and cycle validation, but not planned-net cost arithmetic or the required target-status change from a refund/damage allowance. This is the executable manifestation of R3-S-M1. |
| 19 — two transactions, one shipment | **Pass** | Preserves two per-transaction fixed processing charges despite shipment bundling, matching §8.3’s transaction/shipment separation. |
| 20 — artifact mismatch and sold event | **Pass** | Blocks inconsistent artifact release and proves a sold event changes `RunState` without changing the `PlanRevision` hash. |

## Marginal-return assessment

Another broad antagonistic seller review is unlikely to produce proportionate value: the previously critical revenue-authority, opportunity-cost, buyer-private-output, and plan/run contradictions are now closed in normative language. One narrow correction and one targeted re-audit are still worthwhile because R3-S-M1 directly affects the profit number and acceptance test. After the planned-/actual-net ledger equation and numeric fixture are added, further seller-state review is expected to yield insignificantly meaningful returns relative to implementation and device testing.

## Re-audit after amendment

**R3-S-M1: Pass.** Amended §8.2 now defines planned net as the named revenue scenario minus the selected product basis and every resolved leaf cost in an acyclic typed ledger. It expressly includes the formerly ambiguous labor/time, fee-tax, minimum-fulfillment, giveaway, refund/cancellation/damage, and allocated-overhead lines, while `included-in:<line-id>` contributes exactly once through its resolved ancestor. Actual net applies the same non-double-counting ledger to reconciled actual events and rejects estimated or unknown leaves.

Amended fixture 18 is now red-capable against the former defect: starting contribution `$100` less measured labor `$25` and refund/damage allowance `$15` must produce planned net `$60`, changing a `$75` target from apparent clear to miss by `$15`. It retains the blank-versus-explicit-zero and inclusion-cycle/double-counting checks.

**Final seller-state verdict: Pass; no Critical or Major residual remains in the six audited blockers or fixtures 16–20.** Additional antagonistic review of this seller-state contract is now expected to yield insignificantly meaningful returns. Implementation, executable counterexamples, and public-device validation are the higher-value next gates.
