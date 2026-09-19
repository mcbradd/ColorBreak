# Release runbook

1. Install locked dependencies with `npm ci`, then generate current prices with `npm run data:prices` and `npm run data:sealed-prices`. `data/prices/*.json` is ignored generated data; do not force-add those shards to Git. Reviewed sealed definitions, corrections and source-policy changes remain committed inputs.
2. Run `npm run check` locally. If an older `dist/` exists from a different revision, run `npm run build` first so artifact tests inspect the current code and OCR assets.
3. Push `main`; the Pages workflow builds, tests, publishes, and verifies the deployed bytes against the commit SHA.
4. Open the published site on a phone-sized viewport. Build a break, mark owned/taken slots, and confirm that the values and ceiling update. Open a color team or Large Break slot, sort its card list in both directions, and open a thumbnail's full-page details. Check clipboard sharing and stale-price refresh feedback. Buyer shipping and tax are standing assumptions.

Increment `build-number.txt` by exactly one for each release. The Pages workflow regenerates and validates both price sources before the full checks and build. Its release manifest pins the deployed code SHA, source timestamps and checksums of the actual generated data, and the public-byte verification must match that artifact.

The app keeps the best available answer visible while evidence improves. Missing contents, stale prices and estimated pack rules qualify the bid ceiling and card values through the section's estimate note.
