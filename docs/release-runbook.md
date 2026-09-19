# Release runbook

1. Install locked dependencies with `npm ci`, then generate current prices with `npm run data:prices` and `npm run data:sealed-prices`. `data/prices/*.json` is ignored generated data; do not force-add those shards to Git. Reviewed sealed definitions, corrections and source-policy changes remain committed inputs.
2. Run `npm run check` locally. If an older `dist/` exists from a different revision, run `npm run build` first so artifact tests inspect the current code and OCR assets.
3. Install the locked browser engines with `npx playwright install chromium webkit` (`--with-deps` on Linux), then run `npm run test:browser`. The runner starts and stops its own production preview. Both Chromium and WebKit check buyer/seller entry, retained panel state, nested information and viewport behavior; Chromium additionally checks membership, sorting, sharing, numeric entry and a failed deferred module. Screenshots are saved under `.browser-evidence/`. Use `npm run test:browser:chromium` or `npm run test:browser:webkit` for one engine.
4. Push `main`; the Pages workflow runs the full check and both browser engines before publishing, then verifies the deployed bytes against the commit SHA.
5. Repeat the changed flows against the public artifact: `npm run test:browser:chromium -- https://mcbradd.github.io/ColorBreak/` and `npm run test:browser:webkit -- https://mcbradd.github.io/ColorBreak/`. Review screenshots as well as assertions. Buyer shipping and tax are standing assumptions.
6. Record physical iOS Chrome acceptance separately using `docs/mobile-viewport-contract.md`. A browser engine or modeled keyboard pass is not a physical-device pass.

Increment `build-number.txt` by exactly one for each release. The Pages workflow regenerates and validates both price sources before the full checks and build. Its release manifest pins the deployed code SHA, source timestamps and checksums of the actual generated data, and the public-byte verification must match that artifact.

The app keeps the best available answer visible while evidence improves. Missing contents, stale prices and estimated pack rules qualify the bid ceiling and card values through the section's estimate note.
