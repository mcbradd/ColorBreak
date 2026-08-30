# ColorBreak contributor guide

Read `CONTEXT.md` for domain language and `SPEC.md` for the current acceptance contract before product-facing work.

## Commands

- Develop: `npm run dev`
- Test: `npm test`
- Production build: `npm run build`
- Full check: `npm run check`

## Delivery gate

Product-facing work is complete when the GitHub Pages deployment succeeds and the changed flow passes a live-site check. Treat local tests and builds as pre-deployment validation, not completion.

The deployable output is `dist/`. GitHub Pages must receive the built assets plus `data/` and `public/` content.

## Architecture boundaries

- Keep marketplace and valuation rules pure in `src/domain/`.
- Keep remote-source shapes and caching in `src/data/`; UI components consume normalized domain values.
- Treat `data/corrections.json` as the reviewed override layer. Every correction needs a reason and authoritative source.
- Never silently skip or infer unresolved sealed contents, foreign printings, sheet weights, or finishes. Emit a named omission and lower confidence.
- Never let buyer shipping become seller revenue. Fees are per transaction; fulfillment is per shipment.
- Never calculate actual profit from target asks.

## Experience constraints

Mobile touch is the primary input. Preserve the buyer’s fast path: choose product, enter bid and incremental shipping, then tap each assigned random remaining slot. Pick My Color is alternate mode. Calculation starts on product selection. Keep dense evidence behind progressive disclosure. Materially incomplete data never suppresses projections, verdicts, or outcome distributions. Show the result using resolved data, place a specific warning beside it, name every missing item in plain language, and explain how the gap may affect the result. If a result needs user input, link the message directly to the exact field.

Maintain keyboard operation, visible focus, reduced-motion behavior, and a usable 320px layout. Slot meaning cannot rely on color alone.

## Data tooling

`tools/README.md` defines the frozen collation builder contracts. Builder failures must stay loud and named. Run `npm run check:data` after changing `tools/` or `data/sealed/`; `npm run data:diff` produces the semantic upstream review artifact. The React application tests live under `src/`.
