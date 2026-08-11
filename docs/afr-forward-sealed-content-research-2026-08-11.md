# AFR-forward sealed-content evidence ledger

Date: 2026-08-11
Scope: paper sealed products in sets released on or after *Adventures in the Forgotten Realms* (`AFR`, 2021-07-23)
Corpus audited: MTGJSON `5.3.0+20260810` / committed ColorBreak coverage report before this work
Verification date for every linked source: 2026-08-11

## Executive finding

The starting report classified 64 AFR-forward products as incomplete. Most were not missing product contents:

| Root cause | Products | Disposition |
| --- | ---: | --- |
| Cross-set MTGJSON UUIDs not resolved by ColorBreak | 40 | Exact repair available from MTGJSON's declared `sourceSetCodes` |
| Accessory prose mistaken for unpriced playable cards | 6 | Reclassify as accessories; no EV content is missing |
| Exact fixed-card correction supported | 6 | Add DSK Nightmare Bundle lands and HOB Scene Box cards |
| Quantity/type known, exact printing distribution still unsupported | 12 | Retain an explicit omission; do not invent collector numbers |

Therefore, the evidence in this ledger can reduce the AFR-forward incomplete count from 64 to 12 without estimating an undocumented draw rate or land distribution. Those remaining 12 products should continue to produce `NO VERDICT` when the unresolved cards are material under the user's bulk threshold.

The corpus-wide starting report was 1,023 complete of 1,107 products, with 43 products carrying `missing-sheet-weight`, 33 carrying `prose-only-contents`, and eight carrying `missing-booster`. The name `missing-sheet-weight` was inaccurate for the products below: MTGJSON provided the sheet and weight, while ColorBreak failed to resolve one or more card UUIDs to printings.

## Source and correction architecture

MTGJSON remains the canonical structured starting point. Its `sealedProduct` model describes purchasable products and their `contents`; booster configuration records supply weighted variants and sheets. [MTGJSON sealed-product model](https://mtgjson.com/data-models/sealed-product/) and [booster model](https://mtgjson.com/data-models/booster/).

The best import order is:

1. Fetch the requested set document and pin its MTGJSON version, date, URL and checksum.
2. For every used booster configuration, fetch every set named in that configuration's `sourceSetCodes` before resolving sheet UUIDs. This is MTGJSON's own dependency declaration and is preferable to ColorBreak's release-window heuristic.
3. Build a UUID registry from those declared source sets. Use MTGJSON's global `AllIdentifiers` or `AllPrintings` only as an audited fallback for a dangling or undeclared UUID. MTGJSON documents `AllIdentifiers` as all set and token cards organized by UUID and `AllPrintings` as all set printings. [MTGJSON downloads](https://mtgjson.com/downloads/all-files/).
4. Apply narrowly scoped ColorBreak claims after the pristine import. A claim must include product UUID/key, operation, exact printings and finishes where applicable, source URL, retrieval date, confidence, reviewer and upstream checksum/version.
5. Never replace an unresolved exact printing or undocumented distribution with a generic rarity pool. Preserve the known lower bound and name the omission.

Suggested claim classes are `fixedCards`, `replaceOtherWithFixedCards`, `classifyAccessory`, and `productContentsOverride`. Source-set UUID resolution is import behavior, not a correction claim. This keeps MTGJSON facts distinct from ColorBreak research and makes upstream diffs reviewable.

Confidence used below:

- **High:** exact identity, multiplicity and finish are stated or jointly determined by MTGJSON plus an official product manifest.
- **Medium:** an established seller or repeated physical observations add detail absent from Wizards, but a first-party exact manifest is unavailable.
- **Unresolved:** count or broad class is known, but one or more exact printing, finish or multiplicity dimensions are not supportable.

## Exact MTGJSON resolver repairs

These are normalizer defects, not custom content overrides. The cited MTGJSON set exports contain the booster sheet, its total weight, card UUIDs and `sourceSetCodes`. After all declared source sets are loaded, every listed UUID resolves exactly.

| Set and product keys | Reported gap | Exact repair and evidence | Confidence |
| --- | --- | --- | --- |
| `SNC/bundle`, `bundle-case`, `set-booster-box`, `set-booster-box-case`, `set-booster-pack` | `set/theList`; one ALA UUID remained unresolved after the old heuristic | Resolve the `set` booster from its declared `ALA`, `NCC`, `PLST`, `SLX`, `SNC` sources. The formerly missing UUID is `Rafiq of the Many`, ALA 250. [SNC MTGJSON](https://mtgjson.com/api/v5/SNC.json), [ALA MTGJSON](https://mtgjson.com/api/v5/ALA.json). Wizards independently lists the 67-card SNC List, including the special Rafiq, and says the List slot appears about 25% of the time. [Wizards SNC List](https://magic.wizards.com/en/news/feature/whats-new-on-the-list-for-streets-of-new-capenna). | High |
| `DMU/bundle`, `bundle-case`, `set-booster-box`, `set-booster-box-case`, `set-booster-pack` | `set/theList`; eight SLX references unresolved | Resolve the `set` booster from declared `DMC`, `DMU`, `PLST`, `SLX`. [DMU MTGJSON](https://mtgjson.com/api/v5/DMU.json), [SLX MTGJSON](https://mtgjson.com/api/v5/SLX.json). | High |
| `DMU/collector-booster-box`, `collector-booster-box-case`, `collector-booster-pack` | `collector/lostLegends`; all 244 referenced printings unresolved | Resolve the collector config from declared `DMC`, `DMU`, `LEG`. All 244 UUIDs and all 1,128 MTGJSON weight units resolve in `LEG`. Preserve MTGJSON's weights as upstream modeled data. Wizards independently confirms that the cards are original 1994 English nonfoil Legends cards, appear in about 3% of Collector Boosters, replace a foil common, and publishes the exact 50 excluded cards. [LEG MTGJSON](https://mtgjson.com/api/v5/LEG.json), [Wizards Lost Legends](https://magic.wizards.com/en/news/feature/lost-legends), [Wizards DMU collecting guide](https://magic.wizards.com/en/news/feature/collecting-dominaria-united-2022-08-18). | High for identity and MTGJSON weights; Wizards does not independently publish individual card weights |
| `BRO/bundle`, `bundle-case`, `gift-bundle`, `gift-bundle-case`, `set-booster-box`, `set-booster-box-case`, `set-booster-pack` | `set/theList`; eight SLX references unresolved | Resolve the `set` booster from declared `BOT`, `BRC`, `BRO`, `BRR`, `PLST`, `SLX`. [BRO MTGJSON](https://mtgjson.com/api/v5/BRO.json), [SLX MTGJSON](https://mtgjson.com/api/v5/SLX.json). | High |
| `ONE/bundle`, `bundle-case`, `collector-booster-box`, `collector-booster-box-case`, `collector-booster-pack`, `collector-booster-sample-pack`, `compleat-bundle`, `compleat-bundle-case`, `draft-booster-box`, `draft-booster-box-case`, `draft-booster-pack`, `prerelease-pack`, `set-booster-box`, `set-booster-box-case`, `set-booster-pack` | Foreign concept Praetors, ONC treatments and SLX List cards left weight unresolved in several sheets | Resolve each booster from its own declared sources: `DMU`, `KHM`, `NEO`, `ONC`, `ONE`, `PLST`, `SLX`, `SNC` as applicable. [ONE MTGJSON](https://mtgjson.com/api/v5/ONE.json). Wizards confirms the five concept Praetors are cards from their prior sets, can occur in Set, Draft and Collector Boosters, and lists the four foreign step-and-compleat printings by source set and collector number. [ONE collecting guide](https://magic.wizards.com/en/news/feature/collecting-phyrexia-all-will-be-one), [ONE variant gallery](https://magic.wizards.com/en/news/card-image-gallery/phyrexia-all-will-be-one-variants). | High |
| `WOE/bundle`, `bundle-case`, `set-booster-box`, `set-booster-box-case`, `set-booster-pack` | `set/theList`; twelve SLX weight units unresolved | Resolve the `set` booster from declared `PLST`, `SLX`, `WOC`, `WOE`, `WOT`. [WOE MTGJSON](https://mtgjson.com/api/v5/WOE.json), [SLX MTGJSON](https://mtgjson.com/api/v5/SLX.json). | High |

This change repairs 40 product verdicts at their common source. It must not be implemented as 40 product-specific overrides.

## False-positive incomplete products

These entries already contain all economically relevant cards. The coverage detector is matching accessory text containing the word “card.”

| Product keys | Current prose | Disposition and evidence | Confidence |
| --- | --- | --- | --- |
| `AFR/2021-arena-starter-kit`, `2021-arena-starter-kit-amazon` | `First Game Walk-through Cards` | Classify the walk-through cards as teaching accessories. MTGJSON already expands the two exact 60-card decks. Wizards' WPN manifest describes two ready-to-play decks plus learning materials, deck boxes and a code card; it does not identify an additional sellable randomized card pool. [WPN 2021 Arena Starter Kit](https://wpn.wizards.com/en/products/magic-the-gathering-2021-arena-starter-kit). | High |
| `SNC/2022-arena-starter-kit`, `2022-arena-starter-kit-case` | `First Game Walk-through Cards` | Same treatment. MTGJSON already expands the `Earth Shakers` and `Up and Away` decks. [WPN 2022 Starter Kit](https://wpn.wizards.com/en/products/product-set-or-2022-starter-kit). | High |
| `SPM/marvels-spider-man-scene-box`, `marvels-spider-man-scene-box-case` | `6 Art Only Scene Cards` | Classify these six art-only cards and the easel as display accessories. The six playable traditional-foil scene cards are already fixed as SPE 21–26 in the normalized product. Wizards explicitly distinguishes six traditional-foil borderless scene cards from six art cards. [Wizards Marvel Super Heroes collecting guide](https://magic.wizards.com/en/news/feature/collecting-marvels-spider-man). | High |

The classifier should match punctuation and whitespace variants such as `art only`, `art-only`, `walk-through`, and `walk through`. It should remain phrase-specific; a broad rule that ignores every `card` in `contents.other` would hide genuine failures such as the HOB scene products.

## Exact custom content claims

### Duskmourn Nightmare Bundle

Affected keys: `DSK/nightmare-bundle`, `DSK/nightmare-bundle-case`.

MTGJSON correctly supplies six Play Boosters, two Collector Boosters and the dedicated Nightmare Booster, but leaves the fixed land pack as prose. Wizards states that the bundle contains 20 traditional-foil full-art lands, specifically four full-art manor lands of each basic-land type. The MTGJSON DSK set export identifies the five full-art manor basics as DSK 272–276. [Wizards Duskmourn collecting guide](https://magic.wizards.com/en/news/feature/collecting-duskmourn), [DSK MTGJSON](https://mtgjson.com/api/v5/DSK.json).

Exact correction, high confidence:

- Bundle: DSK 272, 273, 274, 275 and 276, traditional foil, four copies each.
- Case: the same five printings, traditional foil, 24 copies each.
- Replace only the prose `20 foil full-art lands`; leave booster contents and accessories unchanged.

### The Hobbit Scene Boxes

Affected keys: `HOB/scene-box-crack-the-plates`, `scene-box-treasures-of-smaug`, `scene-box-set-of-2`, `scene-box-case`.

Wizards states that each named Scene Box contains three HOB Play Boosters, six traditional-foil new-to-Magic borderless scene cards, six art cards and an easel. The HOC MTGJSON export contains the twelve scene-box cards as two sequential six-card scenes. [Wizards Hobbit collecting guide](https://magic.wizards.com/en/news/feature/collecting-the-hobbit), [HOC MTGJSON](https://mtgjson.com/api/v5/HOC.json).

Exact correction, high confidence:

- `scene-box-crack-the-plates`: HOC 1–6, one traditional-foil copy each.
  - Fíli and Kíli, Joyous; Gandalf, Party Guest; Thorin, King of Durin's Folk; Bilbo, Fellow Conspirator; Bag End Banquet; Ori, Plate Stacker.
- `scene-box-treasures-of-smaug`: HOC 7–12, one traditional-foil copy each.
  - Long-Lost Lances; Dragon-Cursed Halls; Smaug the Impenetrable; Bilbo's Burglaring; Dragon's Desire; Necklace of Girion.
- `scene-box-set-of-2`: HOC 1–12, one traditional-foil copy each.
- `scene-box-case`: HOC 1–12, two traditional-foil copies each, matching MTGJSON's two copies of each named Scene Box in the case.
- The six art cards in each box remain accessories and contribute no card-market EV.

HOB was still marked as a partial preview in the audited MTGJSON export and releases on 2026-08-14. Retain the normal prerelease/post-release recheck even though the named Scene Box contents are supportable now.

## Products that must remain printing-incomplete

### Aetherdrift Finish Line Bundle

Affected keys: `DFT/finish-line-bundle`, `DFT/finish-line-bundle-case`.

Wizards verifies 15 traditional-foil basic lands and five first-place foil basic lands. Its official card list identifies DFT 272–276 as the driver's-seat full-art lands, DFT 277–291 as the fifteen standard basic-land printings, DFT 507–511 as first-place driver's-seat lands, and DFT 512–516 as first-place panorama/racetrack lands. [Wizards Aetherdrift collecting guide](https://magic.wizards.com/en/news/feature/collecting-aetherdrift), [official DFT card list](https://media.wizards.com/2025/downloads/card-sets/DFT_Cardlist_03022025.pdf).

Card Kingdom calls the included first-place lands a “full cycle of First-Place Driver's Seat Basic Lands,” which supports one copy each of DFT 507–511, but its same manifest calls the other 15 lands full-art while Wizards calls them only traditional-foil basics. [Card Kingdom product manifest](https://www.cardkingdom.com/mtg/aetherdrift/aetherdrift-finish-line-bundle).

Disposition:

- It is supportable at medium confidence to replace the five first-place-land prose entries with one foil copy each of DFT 507–511; record the retailer evidence separately from the official printing identity.
- Do **not** assign the other fifteen to DFT 272–276 or DFT 277–291 without packaging photographs, a Wizards manifest, or multiple clear physical openings. The available sources do not state their per-printing multiplicity and the retailer wording conflicts with Wizards' component names.
- Keep both product and case incomplete until those fifteen exact printings are verified. The case multiplier is six after the base bundle is resolved.

### Draft Night land stations

Affected keys:

- `ECL/draft-night`, `draft-night-case`
- `TMT/draft-night`, `draft-night-case`
- `SOS/draft-night`, `draft-night-case`
- `HOB/draft-night`, `draft-night-case`

Official manifests verify 12 Play Boosters, one Collector Booster and 90 nonfoil basic lands for each Draft Night. [Lorwyn Eclipsed](https://magic.wizards.com/en/products/lorwyn-eclipsed/draft-night), [Teenage Mutant Ninja Turtles](https://magic.wizards.com/en/news/feature/collecting-teenage-mutant-ninja-turtles), [Secrets of Strixhaven](https://magic.wizards.com/en/news/feature/collecting-secrets-of-strixhaven), [The Hobbit](https://magic.wizards.com/en/news/feature/collecting-the-hobbit).

[Star City Games' SOS product manifest](https://starcitygames.com/secrets-of-strixhaven-draft-night-sld-mtg-dft-sos-en/) describes the land station as 18 of each basic-land type, so ColorBreak may store a separately sourced semantic quantity of W/U/B/R/G ×18. That is not enough for exact EV: none of the reviewed first-party sources specifies the collector-number/art distribution, and these sets have multiple basic-land printings. The case multiplier is six.

Disposition: store `18 each basic type` as medium-confidence non-priceable composition if useful for break routing, but keep printing identity unresolved and exclude it from exact price/EV. Do not choose a default-frame or full-art printing because it is convenient.

### Secrets of Strixhaven Codex Bundle lands

Affected keys: `SOS/codex-bundle`, `codex-bundle-case`.

Wizards verifies 20 traditional-foil basic lands but does not state the art or per-printing multiplicity. [Wizards Secrets of Strixhaven collecting guide](https://magic.wizards.com/en/news/feature/collecting-secrets-of-strixhaven) and [official SOS card list](https://media.wizards.com/2026/downloads/card-sets/SOS_Cardlist_04172026.pdf).

Secondary sources conflict: [CardTrader's product listing](https://www.cardtrader.com/en/cards/370614-secrets-of-strixhaven-codex-bundle-secrets-of-strixhaven) describes four of each mana type, while [The Expected Value's inventory](https://theexpectedvalue.com/bundle-ev/sos-codex) describes two copies of each SOS 272–281 normal-frame art. Those statements cannot both establish the exact contents. Retain the verified count and foil finish, but keep the printing distribution unresolved until packaging photography or several unambiguous physical openings settle it. The case multiplier is six.

## Acceptance checks for implementation

- A rebuild of SNC, DMU, BRO, ONE and WOE resolves every sheet UUID through the configuration's declared `sourceSetCodes`; no product-specific source-code allowlist is needed.
- DMU Lost Legends resolves all 244 MTGJSON UUIDs and all 1,128 weight units to English nonfoil LEG printings, while preserving the official 3% replacement branch.
- DSK Nightmare Bundle emits exactly 20 fixed foil lands; its case emits 120.
- Each HOB named Scene Box emits exactly six fixed traditional-foil HOC cards; the set-of-two emits 12 and the case emits 24.
- Starter-kit walk-through aids and SPM art cards no longer trigger `prose-only-contents`, while basic-land prose and HOB playable scene-card prose still do.
- DFT, Draft Night and SOS Codex products remain incomplete wherever exact printing identity is not supported.
- Every correction carries source URL, retrieval date, upstream version/checksum and confidence; an upstream semantic diff forces review.

## Bottom line

Use MTGJSON more completely before supplementing it: its own `sourceSetCodes` fixes the largest AFR-forward gap. Add custom data only for narrow, cited facts that MTGJSON currently leaves as prose. Official Wizards pages support exact DSK Nightmare lands and, together with the HOC export, exact Hobbit Scene Boxes. Do not turn broadly worded land manifests into collector-number precision; those products should remain explicit omissions until physical or first-party evidence closes the last mile.

## Post-implementation integrity finding

The normalization pass exposed a separate per-set-export limitation: MTGJSON deck lists
identify cards by UUID, but the set document containing the deck can omit those referenced
printing records. Theme decks could therefore look structurally complete while containing
only the locally resolvable subset of their 60 cards.

ColorBreak now generates `data/deck-card-index.json` from the complete MTGJSON
`AllSetFiles` archive. The 2026-08-11 build stores 1,909 exact UUID-to-printing mappings
needed by AFR-forward decks, sourced from 95 MTGJSON set documents; each source document's
version, date, and SHA-256 is retained. The shipped index is 274 KB rather than the roughly
600 MB uncompressed `AllIdentifiers` payload. Golden checks confirm the ECL Angels/Pirates
and SOS Eerie/Lifegain products now normalize to exactly 60 cards each.
