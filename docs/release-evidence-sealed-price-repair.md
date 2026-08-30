# Sealed-price snapshot repair evidence

- Trigger: GitHub Pages run [33298163115](https://github.com/mcbradd/ColorBreak/actions/runs/33298163115) failed because the committed `data/sealed-prices.json` snapshot had been observed at `2026-08-28T16:52:20.400Z`, exceeding the 36-hour validation limit.
- Repair: regenerated only `data/sealed-prices.json` from its existing TCGCSV source. The replacement records 296 product prices observed at `2026-08-30T07:01:11.309Z`.
- Local release checks: `npm run test`, `npm run check:data`, `npm run check:prices`, `npm run check:sealed-prices`, `npm run build`, and `npm run test:deploy-path`.
- Release behavior: the Pages workflow verifies committed price snapshots and does not refresh them, so the deployed artifact is reproducible from this reviewed commit.

The succeeding Pages run and public-demo response verification are recorded with the release handoff for this repair.
