# V2 targeted final audit — buyer cap and wanted-card contract

Date: 2026-08-13
Reviewed artifact: [ColorBreak V2 product specification — revision 3](../PRODUCT-SPEC-v2.md)
Scope: buyer cap solver, empirical quantiles and ties, under/at/over comparison, saved-cap immutability, counterexamples 1–15, wanted-card non-double-counting/group allocation, and the precise-cap rollout fallback.

## Verdict

Revision 3 closes the round-2 defects in hammer-dependent tax arithmetic, empirical quantiles, equality handling, homogeneous wanted-copy double counting, and automatic upward cap changes. The core numeric examples for those repairs hand-check.

It is not yet implementation-complete. No Critical issue remains in this scope, but five Major contract gaps can still produce different buyer outputs from conforming implementations. In particular, the solver does not name the empty-feasible-set result for a positive minimum bid; “immutable accepted cap” is conflated with a lower mutable active ceiling; acceptable-printing groups do not define which heterogeneous copy fulfills a need; the required fallback has no product/math contract; and several required counterexamples are not executable fixtures.

## Finding summary

| ID | Severity | Finding |
|---|---|---|
| R3-CAP-1 | **Major** | The no-financial-room condition ignores the minimum accepted hammer, so the cap is undefined for an empty feasible set when `V > min C`. |
| R3-CAP-2 | **Major** | The immutable accepted snapshot and the active safety ceiling are not represented as distinct values, including invalidation when fresh analysis yields no cap. |
| R3-WANT-1 | **Major** | “First copies” does not determine allocation within a heterogeneous acceptable-printing group, so one outcome can have multiple composite values. |
| R3-GATE-1 | **Major** | The mandatory cap-range fallback has no endpoint, action, comparison, persistence, or validation contract. |
| R3-FIX-1 | **Major** | Counterexamples 10, 13, and 15 are not deterministic executable fixtures; fixture 5 does not test the immutable record it claims to protect. |

## Major findings

### R3-CAP-1 — Empty feasible bid domains have no defined state

The set solver is correct:

`max { h ∈ D : h + C(h) ≤ V }`.

The named refusal condition is not. The spec says `V ≤ min C` produces **No financial room to bid**. That only detects whether costs alone consume the value target; it does not detect whether any accepted positive hammer fits.

Hand counterexample: let `D = {$1, $2, …}`, `C(h) = $3`, and `V = $3.50`. Then `V > min C`, so the written refusal test is false. But the cheapest accepted amount costs `$1 + $3 = $4`, so the feasible set is empty and `max ∅` is undefined. Implementations could error, return zero, or incorrectly offer $1.

**Required correction:** define **No financial room to bid** whenever the feasible set is empty (or equivalently when `V < min_{h∈D}(h + C(h))`). If zero belongs to an internal computational domain, state that a zero cap is presented as no room rather than as a copyable Max Bid. Add the `$3.50`/`$3`/minimum-$1 fixture.

### R3-CAP-2 — “Immutable” saved cap and mutable active cap are one underspecified object

The spec first says the accepted prepared dollar cap is immutable, then says reanalysis may lower “it” immediately. Fixture 5 improves the intended direction by referring to an `active` value, but never requires the original `$24` accepted snapshot and its provenance to remain preserved after active falls to `$21`.

This needs two explicit concepts:

- immutable `SavedCap`, containing accepted dollars and the rule/evidence/cost/simulation revisions accepted with it;
- derived `ActiveCeiling = min(SavedCap.acceptedDollars, latestSafeModeledCap)`, available only while current evidence permits a cap.

A favorable recomputation to `$27` leaves the active ceiling at `$24`; adopting `$27` creates a new immutable saved record rather than mutating the old one. An adverse recomputation to `$21` leaves the accepted `$24` history intact but derives an active `$21`. A fresh **No modeled cap** result must invalidate the active ceiling and evict copy/comparison actions; “lower immediately” does not define this transition today.

**Required correction:** specify these records and transitions, including local persistence/cold restore, provenance display, history/supersession, and no-cap invalidation. Extend fixture 5 to assert both saved and active values before and after each transition.

### R3-WANT-1 — Acceptable groups still have an allocation ambiguity

Non-overlapping pinned groups correctly prevent one physical card from satisfying two target rows. Replacement rather than addition correctly prevents the homogeneous double count in fixture 4. But “the first copies deterministically allocated” does not define what `first` means inside one group containing exact printings with different residual values.

Hand counterexample: one group accepts printing A and printing B, one useful copy is needed, total personal value is `$20`, residual values are A=`$100` and B=`$5`, and the outcome contains both. Allocating A to the need yields `$20 + $5 = $25`; allocating B yields `$20 + $100 = $120`. Both comply with the present prose unless an unstated array/pull order defines “first.” That order would make economic output depend on storage order.

**Required correction:** define a canonical allocation objective and stable tie-break. For a total-value replacement model, allocating needs to eligible copies in ascending residual value maximizes the declared composite without double counting; another rule is possible, but it must be explicit, provenance-stable, and tested. Add a heterogeneous two-printing fixture, an equal-residual tie fixture, and a multi-copy group fixture. Continue rejecting overlap across groups.

### R3-GATE-1 — The cap-range fallback cannot yet be built or tested

Section 12 correctly makes precise cap a gated research treatment and says failure mechanically selects cap range, then distribution plus buyer-authored hard cap. However, only the precise point-cap experience has normative semantics elsewhere in the spec.

The cap-range fallback does not define:

- how lower and upper endpoints are derived from the selected rule, uncertainty set, or simulation tolerance;
- whether either endpoint is safe/copyable, or whether the product must suppress `Copy total Max Bid`;
- how a next bid is labeled when below, inside, or above the range;
- whether saving/adoption and adverse refresh apply to one endpoint or the whole range;
- which corrupted-advice and limit-violation gates the range must pass before it becomes the production fallback.

The distribution-plus-hard-cap fallback likewise needs to state that comparison is against the buyer-authored cap, not a modeled financial cap, and must not inherit modeled-cap copy or provenance labels.

**Required correction:** add a complete fallback output/state contract and counterexamples before stories depend on it. Otherwise a failed precise-cap study cannot “mechanically” select a shippable experience.

### R3-FIX-1 — The required suite is not fully executable

Several rows are useful scenario prompts but do not provide one deterministic test oracle:

- **#5:** active `$24 → $21` is stated, but retention of immutable accepted `$24` plus provenance is not asserted.
- **#10:** no numeric value/tax bounds, cap, or next bid are supplied, and expected output is written as the two different states `Sensitive/no cap`. Section 6 says a plausible bound crossing the decision produces **No modeled cap**, while **Sensitive** describes a stable result within named bounds or a near-boundary assumption.
- **#13:** no existing-position distribution, bundled-cost schedule, or old/new cap is provided, so only stale-cap eviction is testable; the promised incremental update is not.
- **#15:** no bulk-value bound, cap, or comparison is provided, so “cannot move comparison” is assumed rather than demonstrated.

**Required correction:** turn these into literal input/output fixtures. #10 must choose one state according to section 6; #13 and #15 need numeric distributions/costs/bounds and exact cap/comparison results. This is necessary because section 14 is an implementation-acceptance gate, not merely a review checklist.

## Independent hand-check of counterexamples 1–15

| # | Result | Hand computation / audit |
|---:|---|---|
| 1 | **Pass for stated values** | `h + 3 + 0.10h ≤ 24` gives `h ≤ 19.0909…`; flooring to `$1` domain gives cap `$19`, all-in `$19 + $3 + $1.90 = $23.90`. Unknown tax correctly refuses. `V=$3` leaves no positive hammer. It does not expose R3-CAP-1's `$3.50` empty-set case. |
| 2 | **Pass** | `$23 < $24`, `$24 = $24`, and `$25 > $24` produce exactly one of Under `$1`, At, and Over `$1`. Current `$20` is observational and cannot change cap. |
| 3 | **Pass** | Sorted `[0,10,20,40]`, `n=4`: lower median index `ceil(4/2)=2` gives `$10`; 75% index `4-ceil(3)+1=2` gives `$10`; 90% index `4-ceil(3.6)+1=1` gives `$0`; mean is `$70/4=$17.50`. No interpolation occurs. |
| 4 | **Pass for homogeneous copies** | One useful copy contributes total personal `$20`; four excess copies contribute `4×$12=$48`; composite `$68`. Replacement prevents `$80` and additive double counting. Overlap rejection is explicit. It does not expose R3-WANT-1's heterogeneous-group allocation. |
| 5 | **Arithmetic pass; acceptance fail** | The intended active values are `$24` after a favorable `$27` recomputation and `$21` after an adverse `$21` recomputation. The fixture does not say whether immutable accepted `$24` still exists after the latter, so it cannot verify the stated immutability invariant. |
| 6 | **Pass** | The actionable next legal bid controls comparison. A lower current hammer has no effect; next above cap is Over and cap is invariant. |
| 7 | **Pass as invariant** | Section 4 includes display, serialization, URL/public projection, plan hash, export, cache, analytics, worker, and network sinks. A seller-private sentinel must therefore leave every buyer sink byte-identical and make no private-dependent request. |
| 8 | **Pass as invariant** | The symmetric buyer-private-to-seller noninterference requirement is explicit across the same protected sinks. |
| 9 | **Pass** | A: 75% index 2 gives `$0`; B: index 2 gives `$5`. Both sums are `$40`, hence both means are `$10`. This correctly distinguishes lower-tail coverage despite equal mean. |
| 10 | **Fail — no unique oracle** | A joint bound crossing the comparison should map to **No modeled cap** under section 6, not the unresolved `Sensitive/no cap`. Missing numeric bounds prevent a hand calculation of the switch. |
| 11 | **Pass** | One `$100` chase-band card: `$100×0.82−$0.30=$81.70` before outbound cost. Each `$1` card is below the `$2` floor, so 100 copies remain `$0`, not a grouped positive lot. |
| 12 | **Pass** | If one of `[50,30,20]` is unsold, the adverse unsold spot is `$50`, leaving minimum revenue `$30+$20=$50`. Unsold `$20` leaves maximum revenue `$50+$30=$80`. The sealed-product gate remains independent. |
| 13 | **Semantic pass; numeric fixture incomplete** | Section 5.6 requires incremental without-replacement analysis and refusal until supported; the row correctly requires stale single-position-cap eviction. No numeric input determines the promised updated distribution or cap. |
| 14 | **Pass as stated** | Current eligible `$95`, not historical `$180`, drives buyer evidence. The stipulated material divergence suppresses a precise cap until local acknowledgment; buyer preferences are unchanged. |
| 15 | **Semantic pass; numeric fixture incomplete** | Section 6 makes a non-decision-material omission Ready-with-note and material unknown routing no-cap. No bounds/cap/next bid are supplied to demonstrate that the common cannot move the comparison. |

Tally: 11 full passes for the stated oracle (1–4, 6–9, 11–12, 14), one acceptance-contract failure (#5), one deterministic-state failure (#10), and two semantic-only rows lacking a numeric oracle (#13, #15).

## Additional boundary checks

- **50% coverage versus median:** on `[0,10,20,40]`, 50% coverage is the greatest value met by at least two outcomes, `$20`; lower median is `$10`. The difference is surprising but fully determined by the stated rules and is not a defect.
- **Ties:** on `[0,10,10,40]`, 75% coverage uses index 2 and returns `$10`, whose achieved meet-or-exceed frequency is exactly 75%. The index convention handles ties without interpolation.
- **Comparison equality:** strict `<`, `=`, and `>` definitions are mutually exclusive. No equality defect remains.
- **Wanted homogeneous duplicates:** replacement plus excess-copy residual valuation is unambiguous when all acceptable copies have the same residual value.

## Marginal-return assessment

Another broad seven-perspective ideation round is unlikely to be efficient: revision 3's conceptual direction is stable, and this audit found no new Critical product-direction failure. However, the return from one more **targeted executable-contract review** is still material because the five Major findings touch the safety ceiling, cap persistence, wanted-composite dollars, and the mandatory failed-study fallback.

After those corrections, rerun only: (1) solver boundary/property tests over `D`; (2) saved/active/no-cap state transitions including cold restore; (3) heterogeneous wanted-group allocation; (4) precise/range/distribution treatment state machines; and (5) literal fixtures 1–15. If that review produces only wording or additional low-frequency examples, further antagonistic review should have insignificant expected return.

## Re-audit after amendments

Date: 2026-08-13
Artifact re-audited: amended [ColorBreak V2 product specification — revision 3](../PRODUCT-SPEC-v2.md)
Scope deliberately limited to the five Major findings above and counterexamples 1–15 plus 22.

### Verdict

**Pass. No Critical or Major issue remains in this re-audit scope.** All five prior Major findings now have normative contracts and executable counterexamples. Counterexamples 1–15 and 22 each produce the stated result under hand calculation.

The expected return from further antagonistic review of this cap/wanted-card scope is now **insignificant**. The remaining useful work is implementation against the fixed contracts, property tests, and device/usability gates—not another specification-review round.

### Prior finding closure

| Prior finding | Re-audit | Mechanical result |
|---|---|---|
| R3-CAP-1 | **Pass / closed** | Empty feasible set is now the refusal condition: `V < min_{h∈D}(h+C(h))`; internal zero is not copyable. The `$3.50` value, `$3` cost, minimum `$1` bid fixture has no feasible hammer. |
| R3-CAP-2 | **Pass / closed** | Immutable `SavedCap` and derived `ActiveCeiling` are distinct. Favorable adoption supersedes rather than mutates; adverse analysis derives a lower active ceiling while preserving history; no-cap invalidates copy/comparison; cold restore persists the transition. |
| R3-WANT-1 | **Pass / closed** | Heterogeneous eligible copies allocate by ascending residual value with canonical-identity tie-break and pinned provenance. This determines multi-copy allocation without storage-order dependence. |
| R3-GATE-1 | **Pass / closed** | Cap Range now defines `SafeThrough`/`PossibleThrough`, comparison states, conservative-copy confirmation, saved/adverse-refresh behavior, and independent harm gates. Distribution + hard cap suppresses modeled-cap labels and compares only with the immutable buyer-authored maximum. |
| R3-FIX-1 | **Pass / closed** | #5 preserves both saved and active state; #10 chooses No modeled cap with numeric joint bounds; #13 supplies a numeric without-replacement case and stale eviction; #15 supplies numeric material/nonmaterial bounds. #22 supplies the complete treatment fallback oracle. |

### Final hand-check: counterexamples 1–15 and 22

| # | Result | Hand computation / deterministic oracle |
|---:|---|---|
| 1 | **Pass** | `1.1h+3≤24` gives `h≤19.0909…`, so `$1`-domain cap is `$19`; all-in is `$23.90`. With `V=$3.50`, fixed `$3`, and minimum `h=$1`, minimum all-in is `$4`, so the set is empty and the result is No financial room. |
| 2 | **Pass** | `$24=$24` is At; `$23<$24` is Under by `$1`; `$25>$24` is Over by `$1`. Current `$20` does not enter the cap function. |
| 3 | **Pass** | For `[0,10,20,40]`, lower-median index 2 gives `$10`; 75%-coverage index 2 gives `$10`; 90%-coverage index 1 gives `$0`; mean is `$70/4=$17.50`. |
| 4 | **Pass** | Homogeneous case is `$20+4×$12=$68`. Heterogeneous A=`$100`, B=`$5` allocates B to the one `$20` need, leaving A residual `$100`, total `$120`; equal residual uses canonical ID. Overlap is rejected. |
| 5 | **Pass** | R1 accepted `$24` remains historical. R2 modeled `$27` leaves active `$24` until a new SavedCap is adopted. From R1, R3 modeled `$21` derives active `$21` while preserving accepted `$24/R1`. No-cap removes ActiveCeiling/copy; restore retains removal. |
| 6 | **Pass** | Comparison uses next legal bid, so a next bid above cap is Over regardless of a lower current hammer; cap remains invariant. |
| 7 | **Pass** | Seller-cost sentinel is outside every buyer protected sink; byte equality and identical external-request behavior are the specified oracle. |
| 8 | **Pass** | Buyer-personal-value sentinel is outside every seller protected sink; the symmetric byte/request oracle is explicit. |
| 9 | **Pass** | A `[0,0,20,20]` has 75%-coverage target `$0`; B `[5,5,5,25]` has `$5`; both sum to `$40` and average `$10`. |
| 10 | **Pass** | Minimum cap is `floor((24−3)/1.10)=$19`; maximum is `floor((26−3)/1)=$23`. Next `$21` is Over at the low extreme and Under at the high extreme, so the joint set crosses state and yields No modeled cap. |
| 11 | **Pass** | `$100×0.82−$0.30=$81.70`; each `$1` copy is below the `$2` unsold floor, so 100 copies yield `$0`. |
| 12 | **Pass** | Unsold `$50` leaves minimum revenue `$30+$20=$50`; unsold `$20` leaves maximum `$50+$30=$80`; opening remains prohibited. |
| 13 | **Pass** | Before ownership, average of W=`$20` and U=`$0` is `$10`, hence cap `$10`. Once W is owned, without-replacement next value is U=`$0`, producing no financial room and immediate stale-cap eviction. Unknown ownership identity also refuses. |
| 14 | **Pass** | Current eligible `$95`, not historical `$180`, controls analysis; stipulated material divergence blocks the precise cap and cannot alter buyer preferences. |
| 15 | **Pass** | `V∈[$20.50,$20.75]`, zero cost, `$1` domain floors to cap `$20` throughout; next `$19` stays Under, so Ready-with-note. Routing bound `[$18,$25]` produces caps `$18…$25`; next `$21` spans Over/At/Under, so No modeled cap. |
| 22 | **Pass** | Range `$19–$23`: next `$18` is below SafeThrough, `$21` is inside the assumption-sensitive interval, and `$24` is above PossibleThrough. Only `$19` is copyable after conservative confirmation. Failed range selects distribution + immutable buyer hard cap with no modeled-cap label. |

Final tally: **16 of 16 pass; zero partial, zero fail; zero Critical or Major residuals.**
