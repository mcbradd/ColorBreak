# ColorBreak

**The price board for MTG color breaks.** Build a break from any mix of boxes, packs,
and bundles across sets, and ColorBreak prices all 8 Whatnot break slots — White, Blue,
Black, Red, Green, Multicolored, Colorless, Lands — from live market data: per-slot
expected value, the chase card each slot rides on, and your break-even after fees.

![ColorBreak board for Edge of Eternities](docs/board.png)

No other MTG EV tool splits value by color slot. That split is the whole product.

## What it answers

- **Sellers, pre-show:** what does each slot have to sell for so the run clears market
  cost + platform fees + fulfillment? The gold break-even line and the margin tile
  answer it at a glance.
- **Buyers, mid-auction:** is "Green at $22" +EV or a fade? Quick check gives a verdict
  in one glance — and tells you whether the slot's EV is one lottery card or steady
  spread (LOTTERY / STEADY, with the floor if the chase misses).

## Using it

1. Open the page (works from a plain `file://` open, GitHub Pages, or any static host).
2. Tap **+ Add product**: pick a set from the set-picker sheet, pick a product (box,
   pack, bundle, …) from that set's product-picker sheet, set a quantity. Repeat for
   any other sets or products in the break, then **Load board**.
3. Switch **Buyer** / **Seller** in the header to see the numbers that matter for your
   side of the transaction. In Seller view, type your actual slot sale prices into the
   desk — net vs. break-even updates as you type.
4. Share a live board — the URL updates to `?b=` encoding the full composition
   (`?b=EOE.play-box.2~TDM.collector-pack.1`); old single-set links (`?set=eoe&preset=play`)
   still resolve.

Data: card pool and prices from [Scryfall](https://scryfall.com) (TCGplayer market),
sealed box and product prices from [tcgcsv.com](https://tcgcsv.com). Sealed lookups run
through public CORS relays; for a permanent route, deploy the one-file Cloudflare Worker
shown under **Advanced** and paste its URL there. Seller cost basis is a fraction of the
sealed box price by default, falling back to loose-pack pricing (with a banner) when no
sealed listing exists. All cards count toward EV by default; an optional minimum card
value threshold under Advanced excludes bulk from EV (every EV figure then shows what
was excluded). Collation odds are editable estimates under Advanced — WotC doesn't
publish exact numbers.

Fees (Advanced, editable): 8% commission on the hammer, plus 2.9% + $0.30 payment
processing on the whole order (hammer + buyer-paid shipping & handling). Buyers pay a
flat S&H fee that's credited back to the seller and offsets their fulfillment cost —
sellers enter one fulfillment-cost-per-order number, not itemized shipping.

Everything is one `index.html`: vanilla JS, no build step, state in `localStorage`.
Design decisions live in [DESIGN.md](DESIGN.md).

## Development

Pure logic in `index.html` is fenced with `// @pure … // @end-pure` comments.
`test/extract.mjs` lifts those blocks out of the page verbatim (no build step) so
unit tests run against the exact shipped code:

```
node --test
```

Browser acceptance checks (standing gates G1–G4, iPhone 15 Pro Max descriptor) live in
`test/e2e/`; they need a local Playwright install — point `PLAYWRIGHT_DIR` at a
directory whose `node_modules` contains `playwright`, then `node test/e2e/run-all.mjs`.
The `test/` directory is repo-only; nothing in it ships to the page.
