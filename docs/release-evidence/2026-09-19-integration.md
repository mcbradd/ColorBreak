# Outstanding-work audit — build 16

## Intent and inventory

The audit starts at `a95632d6c90953bdb9a3d4a9facee51be1c8f648` (main, build 15). Sources of intent were the current `SPEC.md`, `CONTEXT.md`, `CLAUDE.md`, component-reuse and mobile-viewport notes, release runbook, branch commit histories, and PR descriptions. The buyer request adds one reusable, sortable membership list and full-page card details. Historical research proposals and earlier confidence-gate ADRs are subordinate to the current best-available-answer contract.

There was one registered worktree, no stashes, two local feature branches, ten remote feature branches, and one open PR. Uncommitted work consisted of the buyer membership UI and the staged migration of generated price snapshots out of version control.

## Integration decisions

| Work | Evidence and disposition |
| --- | --- |
| Local generated-price migration | Preserved in `4d032b6`. Ignore `data/prices/*.json`; generate and validate snapshots before development/release checks. CI already generates both price sources. The release manifest continues to checksum the published data. |
| Local team/slot membership UI | Preserved in `fb308da`, then audited and corrected. `CardMemberList` owns price-descending defaults, reversible Card/Price/Chance/Adds sorting, direction arrows, search, pagination, and thumbnail/name inspection. Team rail, value details, named Large Break slots, and residual slots consume it. |
| `claude/buyers-panel-share-price-refresh-jy8ap2` (`1a4f83c`, PR #17) | Merged in `0c2f9c6`. Retained actionable price refresh, explicit progress/results, browser-owned share URL detection, multi-paragraph help, and rejected-enrichment handling. The newer clipboard-toast sharing contract replaces the branch's native-share/readable-link design. Current per-product collation rules replace its earlier global color-balancing idea. |
| `codex/buyer-boundary` (`6f11812`) | Its canonical-composition and confirmation helpers are already byte-identical on main. Current persistence retains the relevant identity/restore protection. Mandatory demo-only, confirmation and no-bid gates conflict with the newer SPEC. `b8a6df1` records its ancestry with an ours merge while retaining current behavior. |
| `claude/color-break-number-entry-fmwvi1` (`c2b2654`) | Patch-equivalent to merged PR #15 (`60a6f81`); no distinct implementation remains. |
| `claude/color-break-ux-builds-u8bpyp` (`592948a`) | Patch-equivalent to merged PR #16 (`714b8a3`); no distinct implementation remains. |
| `claude/colorbreak-eval-revision-qnvf26` (`ad41d15`) | Patch-equivalent to merged PR #14 (`94f804f`); no distinct implementation remains. |
| `codex/afr-forward-sealed-accuracy` (`7f8f564`) | Already an ancestor of main. |
| `codex/freshness-closure` (`3af5d1c`) | Already an ancestor of main. |
| `codex/loop1-release` (`81307bf`) | Already an ancestor of main. |
| `codex/loop2-revision` (`7643560`) | Already an ancestor of main. |
| `codex/loop5-colorbreak-revision` (`ce703cc`, local and remote) | Already an ancestor of main. |
| `codex/loop6-truthful-readiness` (`ff910e3`) | Already an ancestor of main. |

All listed feature branches are eligible for pruning after delivery. The integration branch is temporary. The sole current worktree remains; there are no additional registered worktrees to remove. Preserve internal Codex refs.

## Standards

The independent standards review found two P2 issues, both resolved and rechecked:

- Pointer activation did not establish the card-details opener. The shared list now focuses the clicked thumbnail/name button before opening the existing owned dialog. The regression begins with another control focused.
- Price refresh announced success before applying the recalculated estimate. It now remains in Checking until the matching assessment succeeds, offers Retry on failure, and ignores work from an obsolete composition/threshold or unmounted workspace. Four lifecycle tests cover these cases.

No unresolved standards findings remain from the review. No baseline code smells warranted a finding.

## Spec

The independent spec review found one P2 issue: closing details could restore focus outside the invoking list. The shared opener fix above resolves it; the reviewer confirmed the correction. The four membership surfaces, exact-finish default price order, reversible sorting, arrows/accessibility state, full-page details, independent ownership controls, and current sharing behavior matched the request.

Standards: 2 findings resolved, 0 unresolved. Spec: 1 finding resolved, 0 unresolved.

## Validation and release

- `npm ci`, `npm run data:prices`, and `npm run data:sealed-prices` completed. Local data contains 42,183 exact printings across 176 sets and 296 sealed-product prices. Snapshot age remains disclosed; generation does not pretend the source observed newer prices.
- `npm run check` passed: 483 app tests in 103 files, 6 root Vitest tests, 42 root Node tests, shared-import/unused-code checks, data/collation/price checks, production build, deployment-path tests and lazy/same-origin OCR tests.
- The first run exposed an outdated raw-text assertion after tooltips gained paragraph markup; the assertion now checks paragraphs and deduplication. Stale local `dist` assets caused artifact checks to fail until the production build was regenerated; the subsequent full check passed.
- `tools/check-mobile-evidence.mjs` passes in Chromium at 320, 390 and 768 pixels, including team expansion, four sortable columns, independent owned/taken actions, full-page details, focus restoration, named/residual slots, sharing and price-refresh feedback.
- Screenshot review caught an image/text overlap in the constrained full-page grid. Content-sized grid rows now keep information below the full portrait. The browser check asserts no overlap. Phone tables retain the 17px text floor and scroll within their own region, with no page overflow.
- `git diff --check` passed. Build number advances once, from 15 to 16.
- The first CI run exposed a picker-test timing race: it clicked a refresh label before preparation finished enabling the control. Refresh tests now wait for the button to be enabled before activation; the user-facing implementation is unchanged.

Delivery requires the Pages workflow for the integration commit to succeed, public-byte verification to match its SHA, and the same browser flow to pass on the published site before cleanup. GitHub Actions records deployment evidence; local logs/screenshots and the pre-prune refs bundle are retained in `.git/integration-backup-20260919-015946/`.

These responsive Chromium checks are not a physical iOS device check.
