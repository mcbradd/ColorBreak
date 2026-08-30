# Loop 1 release evidence

## Delivered release controls

- Buyer decisions now use the typed `DecisionEligibility` gate. An observation is eligible through exactly six hours; stale, missing/invalid timestamps, unavailable sources, and material omissions remove the actionable hammer recommendation.
- `dist/data/release-manifest.json` inventories deployed data with SHA-256 hashes, source observation metadata, build runtime, source SHA, and the six-hour threshold.
- `npm run check` discovers the root MJS data suites as well as application tests. The Pages workflow prints the manifest identifier and discovered suite count.
- Default pricing remains snapshot-only: a missing snapshot is an unavailable/incomplete result and does not contact Scryfall at evaluation time.
- Financial bid/shipping values are session-only. Public links are explicit and exclude financial values. The home screen has an explicit clear-device control for ColorBreak storage and caches.
- The service worker caches only successful same-origin GET responses and rolls old versioned caches forward. The production shell includes an interim CSP meta policy and strict referrer policy; GitHub Pages response headers remain an infrastructure limitation.

## Verification before merge

- Targeted changed-surface tests: 40 tests passed across buyer safety, snapshot isolation, disclosure affordances, valuation eligibility, and seller ledger/workflow modules.
- Root MJS discovery: 6 files discovered; 31 tests passed.
- Production build generated a manifest and completed successfully.

## Deployment record

Populate this section only after the final merge and GitHub Pages deployment, including merge SHA, manifest ID, Pages run URL, fresh-profile network inventory, 320/393/desktop smoke results, and real-device keyboard verification.
