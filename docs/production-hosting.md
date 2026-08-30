# Production hosting boundary

The current GitHub Pages deployment is a **non-commercial demo only**. GitHub Pages cannot set the response headers needed for ColorBreak's production security boundary, and its terms are not a fit for commercial SaaS hosting.

Before a production launch, deploy the committed `dist/` artifact to a header-capable static host or CDN. The deployed document and static assets must send a server `Content-Security-Policy` that includes `frame-ancestors 'none'`, plus `X-Content-Type-Options: nosniff` and a restrictive `Permissions-Policy`. Validate all `/ColorBreak/` routes and assets on the actual host, and prove an external-origin iframe is blocked by the browser.

The Pages workflow intentionally verifies committed price snapshots rather than rebuilding live data. That makes a deployed manifest reproducible from the reviewed commit. Refresh, review, and commit snapshots separately; the application withholds buyer limits whenever exact-printing prices are older than the six-hour decision-ready freshness contract.
