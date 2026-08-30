# Release runbook

GitHub Pages is a non-commercial, browser-local demo. It cannot enforce the required response headers or anti-framing policy, so it is never production-approved.

1. Refresh price data only in a separately reviewed and committed change.
2. Run the normal reproducibility checks for every demo deployment. If the price observation is older than six hours, the release posture is **analysis-only**: buyer ranges and evidence may ship, but no live bid-cap claim may be made.
3. There is no decision-ready dispatch in this repository. `releasePosture` for every Pages artifact is **analysis-only**, even when observations are fresh. Do not promote or describe the Pages URL as production-ready.
4. A future production pipeline requires a named header-capable host, protected environment, exact reviewed SHA/observation tuple, whole-artifact verification, CSP (`frame-ancestors 'none'`), anti-framing browser test, nosniff, restrictive permissions/referrer policy, COOP/CORP, and HSTS. It is not authorized or implemented here.

The data-audit owner and alert routing remain a product decision; this repository intentionally does not invent a recipient.
