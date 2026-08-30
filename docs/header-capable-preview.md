# Header-capable preview deployment

GitHub Pages remains an **analysis-only** static demo. Its normal responses do
not provide the response headers below, so a Pages deployment cannot be called
commercial-production-secure or anti-framing protected.

`public/_headers` is a Cloudflare Pages-compatible edge policy for the same
immutable `dist/` artifact produced by `npm run build`. A release operator with
an approved Cloudflare account must deploy that exact artifact (not rebuild in
the dashboard), restrict deploy identity to reviewed CI, bind an HTTPS custom
domain, and verify every response route before any preview promotion.

Required live probes: `/`, one hashed JS asset, `/privacy.html` if present,
`/sw.js`, and a missing route. Each must return CSP with `frame-ancestors
'none'`, HSTS after domain validation, `nosniff`, Referrer-Policy,
Permissions-Policy, and the deliberate COOP/CORP values in `_headers`. Test a
cross-origin iframe and record its browser failure. Do not claim this was
deployed until a real host URL, header capture, artifact digest, rollback owner,
DNS owner, privacy review, and monitoring owner are recorded.

No accounts, payments, telemetry, server-held data, or transaction authorization
are in scope for this static demo. Introducing any of them requires a separate
server-side security and privacy architecture review.
