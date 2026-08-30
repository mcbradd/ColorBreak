# Release runbook

GitHub Pages is a non-commercial, browser-local demo. It cannot enforce the required response headers or anti-framing policy, so it is never production-approved.

1. Refresh price data only in a separately reviewed and committed change.
2. Run the normal reproducibility checks for every demo deployment. If the price observation is older than six hours, the release posture is **analysis-only**: buyer ranges and evidence may ship, but no live bid-cap claim may be made.
3. Every deployment runs `npm run release:posture`. Scheduled and push Pages deployments are always `analysis-only`. A proposed decision-ready promotion must be explicitly dispatched with `COLORBREAK_RELEASE_POSTURE=decision-ready`, run `npm run check:decision-freshness`, and include a committed `data/decision-ready-review.json` accepting the exact observation with reviewer, SHA, disposition, and live-smoke evidence URL. It fails closed when any record is absent.
4. Production approval is separate: deploy the identical artifact to a header-capable host and verify live CSP (`frame-ancestors 'none'`), anti-framing, nosniff, permissions/referrer policy, COOP/CORP, and HSTS. Do not infer this from Pages.

The data-audit owner and alert routing remain a product decision; this repository intentionally does not invent a recipient.
