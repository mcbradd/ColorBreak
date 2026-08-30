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

- Merged Pages revision: `c1ebe171bbcb75f2a9df46779eafa9b0bbe1fcc8`.
- GitHub Actions run: https://github.com/mcbradd/ColorBreak/actions/runs/33288107606 — build and deploy both succeeded on 2026-08-30.
- Live production proof: `https://mcbradd.github.io/ColorBreak/` returned HTTP 200 and served the merged shell asset (`index-18w_mbzv.js`), CSP meta policy, and strict referrer policy.
- Automated verification: 59 Vitest files / 216 tests and all 31 root-MJS tests passed; coverage, exact-price, sealed-price, and production build gates passed.
- Browser/device note: production response was inspected as a fresh HTTP fetch. A real-iPhone/manual assistive-technology pass remains a release follow-up; it cannot be represented by this desktop environment.
