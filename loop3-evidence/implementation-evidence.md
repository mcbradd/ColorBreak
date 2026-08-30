# Loop 3 implementation evidence

## Release decision

This release deliberately keeps GitHub Pages as a **non-commercial public demo**. The application and README now state that it must not be used for commercial transactions or financially consequential decisions. `docs/production-hosting.md` records the production acceptance boundary: a header-capable host must provide a response CSP including `frame-ancestors 'none'`, `X-Content-Type-Options: nosniff`, and restrictive `Permissions-Policy`, plus a real external-frame check.

## Implemented safeguards

- The Pages workflow no longer regenerates live price inputs during deployment. It verifies committed snapshots, so a deployed artifact and its release manifest are reproducible from the reviewed commit.
- The existing six-hour runtime eligibility gate remains authoritative: stale exact-printing data yields no buyer limit rather than a fabricated fresh answer.
- The public clear-data and privacy disclosures now distinguish app-controlled storage/cache from browser history, HTTP cache, clipboard, and host-visible first-load share queries.
- Buyer mode controls expose a selected `aria-pressed` state; async analysis publication is request-identity guarded; the mobile verdict has bounded type/wrapping rules.

## Local verification

Run on 2026-08-30 before merge:

- Type/build: `npm run build` — passed; release manifest generated.
- Data checks: `npm run check:data`, `npm run check:prices`, `npm run check:sealed-prices` — passed.
- Vitest: all 60 application suites passed when run in two bounded groups (218 tests total).
- Root MJS tests: passed (29 node tests plus 6 root Vitest tests).
- Deploy-path smoke: passed (2 tests).

The production deployment and live check must be appended after the `main` workflow completes.
