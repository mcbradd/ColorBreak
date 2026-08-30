# ColorBreak demo release gate

ColorBreak Pages is a browser-local demo scenario, not a marketplace, live quote, or commercially decision-capable product. Its committed snapshots attest to source provenance and observation time, not present-market accuracy.

## Release checks

The Pages workflow verifies the committed price and sealed-price snapshots, runs the full check suite, and records the release manifest ID. The scheduled sealed-data audit rebuilds supported documents, writes rebuild/coverage/source-diff logs even when a prior step fails, and uploads those logs as `sealed-source-audit`.

The release owner reviews snapshot source/version, observation time, application SHA, and any anomaly before accepting changed data. If review fails, retain the previous reviewed snapshot; do not weaken `source-diff --check`. Roll back by redeploying the previous reviewed main commit.

## Production is a separate approved project

Before commercial claims, use an authenticated header-capable host and verify response headers on document, API, static, and error responses: a response-header CSP with `frame-ancestors 'none'`, `X-Content-Type-Options`, Referrer-Policy, Permissions-Policy, deliberate COOP/CORP, and HSTS. Test framing denial. Accounts, persistence, or refresh services require server-side credentials, authorization, retention/deletion controls, licensed data, validation, and rate limits.
