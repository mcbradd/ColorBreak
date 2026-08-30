# Loop 3 maintainability review

Scope: independent read-only review of the deployed application at
`https://mcbradd.github.io/ColorBreak/` and source clone `6e71772`. No product
code was changed.

## Verdict

The deployed landing page and buyer entry flow work and produced no browser
console warnings/errors during this review. The chief maintainability risk is
not an observed user-facing failure: it is the concentration of distinct
workflows, persistence, async orchestration, pricing, and presentation in one
very large React module. Continued feature work is likely to create regressions
that are expensive to isolate.

## Concerns

### M1 — `App.tsx` is a change-amplifying god module

- **Evidence:** `src/App.tsx` is 3,582 lines / 174,558 bytes. It contains 18
  exported components, 21 local named components, 56 `useState` sites, and 25
  `useEffect` sites. It owns the launcher, buyer setup, calculation lifecycle,
  seller command center, seller experiments, display components, and some
  storage helpers.
- **Repro:** Open `src/App.tsx`; compare `SellerScenarioLab` (~2384),
  `SellerPlanArchive` (~2503), `SellerEnticement` (~2879), `SellerView`
  (~2985), `BuyerSetup` (~3183), and `Workspace` (~3257). An edit to any
  shared concept requires navigating a 3.5k-line file with unrelated views.
- **Concern:** Feature-specific state and calculations are embedded alongside
  rendering. Review diffs have a large blast radius and one module is the
  integration bottleneck for buyer and seller development.
- **Confidence:** High.
- **Loop value:** Extract `buyer/`, `seller/`, `shared-ui/`, and a
  `useWorkspace` orchestration hook before adding another substantial workflow.
  Preserve current public exports with thin re-export wrappers during the move.

### M1 — Seller economics state is duplicated across active and legacy paths

- **Evidence:** `SellerPlanArchive` begins at `src/App.tsx:2503` and declares
  cost/fee state for margin, buyer shipping, packing, covered shipping,
  shipments, labor, tax, giveaways, refund reserve, overhead, and all three
  fee values. `SellerView` at `:2985` independently declares nearly the same
  concepts (buyer shipping, packing, postage, shipments, labor, tax,
  giveaways, refund reserve, overhead, commission, processing, processing
  flat) and repeats the corresponding financial calculations.
- **Repro:** Search those component names and compare their state blocks and
  fee formulas. Altering a fee definition, shipping assumption, or output
  concept requires determining which seller implementation is still relevant
  and manually keeping formula variants coherent.
- **Concern:** The name `SellerPlanArchive` does not reliably establish
  ownership/deprecation: it remains a full interactive component and renders
  `SellerScenarioLab`. This is an invitation for stale business rules and
  accidental edits to dead-or-secondary UI.
- **Confidence:** High for duplication; medium for whether the archive is
  intentionally retained (no explicit deprecation contract found).
- **Loop value:** Decide whether the archive is truly supported. Delete it if
  not; otherwise route both views through a typed `SellerEconomicsInput` and
  pure calculation functions with shared tests.

### M2 — Persistence has two sources of implementation truth

- **Evidence:** `src/persistence.ts` defines `readSessionLines` and
  `writeSessionLines`, but `src/App.tsx:3158` has a second `storedLines`
  reader for the same `colorbreak:${mode}:draft:v1` key. `App.tsx:3306–3326`
  additionally owns writes and individual buyer preference reads/writes.
- **Repro:** Change the stored shape/version or introduce migration behavior.
  It must be updated in `persistence.ts`, the duplicate reader in `App.tsx`,
  the individual preference helpers, their UI effects, and tests. A partial
  change can silently discard a draft because the failure mode is `[]`.
- **Concern:** The existing persistence module is not the authority for its
  own data contract. Broad catch-and-default behavior makes compatibility loss
  difficult to distinguish from an empty first-time session.
- **Confidence:** High.
- **Loop value:** Move every storage key, parser, schema/version migration, and
  clear operation into `persistence.ts`; return an explicit `invalid` result
  for malformed current-version data so tests can assert recovery behavior.

### M2 — Workspace calculation results can race after rapid edits

- **Evidence:** `Workspace` starts `evaluateBreakAnalysis(lines, threshold)`
  in the effect at `src/App.tsx:3340`. Unlike `useOutcomeSimulation`, whose
  effect has a `current` cancellation guard at `:1335`, this calculation
  effect has no request/version guard before `setAnalysis(next)`, `setError`,
  or `setBusy(false)`.
- **Repro:** With a slower network/cache miss, add a product or change the bulk
  threshold, then immediately make another change. Each invocation issues an
  independent async evaluation. If the earlier promise resolves last, it can
  publish analysis for the earlier `lines`/threshold after the newer request
  has begun.
- **Concern:** This is a correctness hazard hidden inside a monolithic UI
  effect; it gets more likely as data loading and richer analyses increase.
- **Confidence:** Medium-high (the ordering is permitted by the code; this
  review did not artificially delay production requests to force it).
- **Loop value:** Put request identity/cancellation into a dedicated
  `useBreakAnalysis` hook and add a deferred-promise test that resolves the
  old request after the new one, asserting only the new analysis appears.

## Live evidence

- The launcher rendered `Value engine ready` and both buyer/seller choices.
- Selecting **Bid Check — should I bid?** navigated to `#buyer` and rendered
  buyer controls without captured console warnings or errors.

## Verification limitation

`npm test` could not run in this clone because its dependencies are absent
(`vitest` is not installed). I did not install dependencies because this was a
no-product-changes review. This is an environment limitation, not a test-suite
failure.
