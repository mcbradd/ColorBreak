# ColorBreak contributor guide

Read `CONTEXT.md` for domain language and `SPEC.md` for the current acceptance contract before product-facing work.

## Commands

- Develop: `npm run dev`
- Test: `npm test`
- Production build: `npm run build`
- Full check: `npm run check`

The deployable output is `dist/`. GitHub Pages must receive the built assets plus `data/` and `public/` content.

## Architecture boundaries

- Keep marketplace and valuation rules pure in `src/domain/`.
- Keep remote-source shapes and caching in `src/data/`; UI components consume normalized domain values.
- Treat `data/corrections.json` as the reviewed override layer. Every correction needs a reason and authoritative source.
- Never silently skip or infer unresolved sealed contents, foreign printings, sheet weights, or finishes. Emit a named omission and lower confidence.
- Never let buyer shipping become seller revenue. Fees are per transaction; fulfillment is per shipment.
- Never calculate actual profit from target asks.

## Experience constraints

Mobile touch is the primary input. Preserve the buyer’s fast path: choose product, choose slot, enter bid and incremental shipping. Calculation starts on product selection. Keep dense evidence behind progressive disclosure. Incomplete data suppresses verdicts.

Maintain keyboard operation, visible focus, reduced-motion behavior, and a usable 320px layout. Slot meaning cannot rely on color alone.

## Data tooling

`tools/README.md` defines the frozen collation builder contracts. Builder failures must stay loud and named. Run relevant legacy data-pipeline tests when changing `tools/` or `data/sealed/`; the React application tests live under `src/`.
