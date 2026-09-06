# Editable cost assumptions

Checked September 6, 2026. Buyer fields contain shipping and sales tax only. Seller commission and processing never reduce a buyer's bid ceiling. Color slots, Large Break and the seller's buyer preview share the same assumptions, shipping control and arithmetic. Currency entry uses the shared right-aligned numeric field; quantities remain centered. Actual receipt fields are never populated with estimates.

## Shipping evidence

[Whatnot US buyer shipping](https://help.whatnot.com/hc/en-us/articles/16369289657741-Shipping-for-buyers-in-the-US) and [Ground Advantage seller rates](https://help.whatnot.com/hc/en-us/articles/16810912324877-USPS-Ground-Advantage-shipping-for-sellers) give these label totals including operational fees: through 4 oz $4.47, through 8 oz $4.85, through 12 oz $5.25, below 16 oz $6.75, and 1–5 lb $7.75. The negotiated rates exclude Alaska, Hawaii and other noncontiguous destinations. These are the July 31, 2026 rates.

[Smart Bundling](https://help.whatnot.com/hc/en-us/articles/16285911553677-How-Smart-Bundling-works) combines eligible purchases and charges only increases. The 0–1 oz TCG profile adds 0.5 oz per subsequent item; that special small-item profile cannot safely represent a full color's cards from a box. [Shipping profiles](https://help.whatnot.com/hc/en-us/articles/4407962164621-Choose-shipping-profiles-for-your-listings) use packed weight and can override bundling and incremental weights.

Our inference uses expected physical cards, evenly divided among spots, 1.8 g per card, and 1 oz packaging (4 oz for larger parcels). Unresolved products use pack counts and inferred family card counts. Foils, sleeves, uneven color counts, tokens, accessories, seller profiles and existing purchases can alter actual weight. Above 5 lb we estimate multiple 5 lb parcels, not a verified heavy-parcel quote. The price filter never reduces physical card count.

Flat fee is the default approximation to one combined label. The displayed amount covers already-owned spots plus the next one; the bid ceiling deducts only its increase over the previous estimate. An overridden flat fee charges once, whereas per-item charges every purchased auction spot. Seller flat shipping is per expected combined shipment, prorated across transactions solely for the processing-fee base. It never becomes seller revenue. Buyer-paid postage defaults to zero seller expense; packaging defaults to $2, or $3 above 150 cards per shipment. Those packaging amounts are planning guesses, not Whatnot charges.

## Tax evidence and limitations

[Tax Foundation July 2026 data](https://taxfoundation.org/data/all/state/2026-sales-tax-rates-midyear/) supplies population-weighted combined state/local rates, including the 7.53% US fallback. Common US device time zones select a representative regional average. This is intentionally labeled a coarse guess: a time zone is not a delivery address, and no precise location or IP address is requested or sent to a third party. Unknown or non-US zones use the disclosed US fallback for this US marketplace preset. The user can enter the checkout rate directly.

[Whatnot tax collection](https://help.whatnot.com/hc/en-us/articles/27262271523597-How-tax-is-collected-from-purchases-on-Whatnot) and [shipping tax](https://help.whatnot.com/hc/en-us/articles/4412099990157-Taxes-on-shipping) depend on addresses and local rules. We apply the editable rate to hammer plus added shipping; exemptions are disclosed. Buyer sales tax is distinct from seller tax on business fees or permits.

## Persistence and layout contract

Store overrides separately from derived defaults. Deliberate zero values count as edits. Product and filter changes, new buyer decisions and component remounts preserve edits within the browser session. Clear local app data removes them. Financial assumptions remain private in session storage, outside URLs and durable storage. Old nonzero shipping migrates with its per-purchase meaning; old seller fees are discarded from buyer calculations. Unedited shipping can improve with composition data.

Compact assumption fields pair labels and amounts on one row. The value-filter label sits immediately before its input. Currency alignment is an explicit NumericInput property inferred by NumberField's dollar prefix, never a blanket alignment of all numbers or graphics. Shipping reuses one component with pressed-state buttons and one amount input. The existing mobile visual-viewport focus and Done behavior remains authoritative.
