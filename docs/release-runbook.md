# Release runbook

GitHub Pages is a non-commercial, browser-local demo. It cannot enforce the required response headers or anti-framing policy, so it is never production-approved.

1. Refresh price data only in a separately reviewed and committed change.
2. Run the normal reproducibility checks for every demo deployment. If the price observation is older than six hours, the release posture is **analysis-only**: buyer ranges and evidence may ship, but no live bid-cap claim may be made.
3. A decision-ready release additionally runs `npm run check:decision-freshness` after the reviewed snapshot commit and records the observation time, threshold, application SHA, audit disposition, and a live buyer verification.
4. Production approval is separate: deploy the identical artifact to a header-capable host and verify live CSP (`frame-ancestors 'none'`), anti-framing, nosniff, permissions/referrer policy, COOP/CORP, and HSTS. Do not infer this from Pages.

The data-audit owner and alert routing remain a product decision; this repository intentionally does not invent a recipient.
