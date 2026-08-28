# Magic card treatments and Scryfall representation

_Research date: 2026-08-28. Scope: paper Magic printings and Booster Fun/card-style variants relevant to sealed-product collation and exact-printing valuation. Sources are first-party Wizards articles and Scryfall's API/API-types repository._

## Executive finding

A card's **visual treatment**, **physical finish**, **language/name treatment**, and **collectibility marker** are independent dimensions. A single printing can simultaneously be borderless, showcase, full-art, textless, serialized, and double-rainbow foil. Treating all of those as one `finish` value is therefore lossy.

Wizards deliberately makes showcase art and frames unique to each set, so the marketing names are an open-ended vocabulary rather than a closed enum. Wizards' original Project Booster Fun announcement says each set has its own unique showcase cards and that showcase, borderless planeswalker, and extended-art treatments can also exist in foil versions. That establishes the two-axis model: style and finish are composable, not alternatives. [Wizards: Project Booster Fun](https://magic.wizards.com/en/news/making-magic/project-booster-fun-2019-07-20)

Scryfall reflects that distinction, but not in one field:

- `finishes` has only `nonfoil`, `foil`, and `etched`.
- `frame_effects`, `border_color`, `full_art`, `textless`, and `variation` describe visual construction.
- `promo_types` carries many named surface processes and special-print attributes, including surge, textured, gilded, serialized, and set-specific style tags.
- Exact-printing identity remains `id` (with `set` + `collector_number` as the human-facing lookup key); `illustration_id` identifies shared artwork, not a physical printing.

The robust implementation is consequently **unknown-preserving and multi-axis**: retain every raw Scryfall tag, normalize known tags into families, and let an unknown tag remain a priced exact printing rather than becoming an omission.

## The four independent axes

| Axis | Meaning | Examples | Primary Scryfall representation |
|---|---|---|---|
| Printing identity | The exact sellable card object | set, collector number, language, Scryfall ID, TCGplayer product ID | `id`, `set`, `collector_number`, `lang`, `tcgplayer_id`, `tcgplayer_etched_id` |
| Visual style/frame | Artwork crop and frame/layout applied to the printing | showcase, extended art, borderless, retro, poster, dossier, full art, textless | `frame`, `frame_effects`, `border_color`, `full_art`, `textless`, `promo_types`, `flavor_name`, `illustration_id` |
| Physical finish/process | Surface manufacturing process | nonfoil, traditional foil, etched foil, surge, textured, halo, galaxy, fracture | `finishes` for the price class; usually `promo_types` for the named process |
| Collectibility/product attribute | Scarcity or product context, not a finish | serialized, headliner, box topper, stamped, set extension, thick display commander | `promo_types`, `security_stamp`, `promo`, `oversized`, `variation`, `variation_of` |

Scryfall's card-field definitions explicitly describe `finishes` as the computer-readable foil/nonfoil/etched flags; `border_color`, `frame_effects`, `full_art`, `textless`, `promo_types`, `variation`, `security_stamp`, prices, and vendor IDs are separate fields. [Scryfall API types: CardFields](https://github.com/scryfall/api-types/blob/main/src/objects/Card/CardFields.ts)

## Scryfall field and value audit

### Closed or nearly closed fields

| Field | Values / handling | Important limitation |
|---|---|---|
| `finishes` | `nonfoil`, `foil`, `etched` | A galaxy foil, surge foil, mana foil, or fracture foil still normally reports `foil`; the named process is elsewhere. [Scryfall Finish enum](https://github.com/scryfall/api-types/blob/main/src/objects/Card/values/Finish.ts) |
| `border_color` | `black`, `white`, `borderless`, `silver`, `gold` | Describes the physical border, not every marketing use of “borderless.” [Scryfall BorderColor enum](https://github.com/scryfall/api-types/blob/main/src/objects/Card/values/BorderColor.ts) |
| `security_stamp` | `oval`, `triangle`, `acorn`, `circle`, `arena`, `heart` | A stamp shape is not a foil process and does not identify serialized cards. [Scryfall SecurityStamp enum](https://github.com/scryfall/api-types/blob/main/src/objects/Card/values/SecurityStamp.ts) |
| `variation` / `variation_of` | Boolean plus related Scryfall printing ID | Means this printing varies another printing; it does not say _how_. Preserve the target ID. |
| `full_art`, `textless` | Independent booleans | Both may coexist with borderless/showcase and a special foil process. |

### `frame_effects`

The first-party API-types list currently includes:

`legendary`, `miracle`, `nyxtouched`, `draft`, `devoid`, `tombstone`, `colorshifted`, `inverted`, `sunmoondfc`, `compasslanddfc`, `originpwdfc`, `mooneldrazidfc`, `waxingandwaningmoondfc`, `showcase`, `extendedart`, `companion`, `etched`, `snow`, `lesson`, `shatteredglass`, `convertdfc`, `fandfc`, and `upsidedowndfc`. [Scryfall FrameEffect enum](https://github.com/scryfall/api-types/blob/main/src/objects/Card/values/FrameEffect.ts)

This list is not safe as a closed runtime enum. For example, the live Scryfall object for Sothera, the Supervoid contains the newer `enchantment` effect, and current objects combine several effects. [Scryfall API: EOE 382](https://api.scryfall.com/cards/eoe/382) Therefore consumers must retain unknown strings and should display them after humanizing, not reject the card.

### `promo_types`

Scryfall's first-party type source separates several useful families:

- Frame/style appearances: `scroll`, `poster`, `dossier`, `ravnicacity`, `magnified`.
- Named finish processes: `glossy`, `silverfoil`, `confettifoil`, `galaxyfoil`, `halofoil`, `surgefoil`, `doublerainbow`, `textured`, `oilslick`, `neonink`, `gilded`, `stepandcompleat`, `embossed`, deprecated `ampersand`, and `invisibleink`.
- Stock: `thick`, `plastic`.
- Product/collectibility attributes: `alchemy`, `arenaleague`, `boosterfun`, `boxtopper`, `brawldeck`, `bringafriend`, `bundle`, `buyabox`, `commanderparty`, `concept`, `convention`, `datestamped`, `draculaseries`, `draftweekend`, `duels`, `event`, `fnm`, `gameday`, `giftbox`, `godzillaseries`, `instore`, `intropack`, `jpwalker`, `judgegift`, `league`, `mediainsert`, `moonlitland`, `openhouse`, `planeswalkerdeck`, `playerrewards`, `playpromo`, `premiereshop`, `prerelease`, `promopack`, `rebalanced`, `release`, `schinesealtart`, `serialized`, `setextension`, `setpromo`, `stamped`, `starterdeck`, `storechampionship`, `themepack`, `tourney`, and `wizardsplaynetwork`.

[Scryfall API types: PromoType](https://github.com/scryfall/api-types/blob/main/src/objects/Card/values/PromoType.ts)

The repository enum lags the live API and therefore is a minimum, not an exhaustive future contract. Verified newer live values include:

| Live tag | Verified example |
|---|---|
| `fracturefoil`, `japanshowcase` | Overlord of the Hauntwoods, DSK 405. [Scryfall API](https://api.scryfall.com/cards/dsk/405) |
| `manafoil` | Twinflame Tyrant, FDN 395. [Scryfall API](https://api.scryfall.com/cards/fdn/395) |
| `headliner`, `singularityfoil` | Sothera, the Supervoid, EOE 382. [Scryfall API](https://api.scryfall.com/cards/eoe/382) |
| `portrait` | Phelia, Exuberant Shepherd, MH3 364. [Scryfall API](https://api.scryfall.com/cards/mh3/364) |
| `headliner` plus `serialized` and `doublerainbow` | Mox Jasper, TDM 419. [Scryfall API](https://api.scryfall.com/cards/tdm/419) |

Current first-party API searches additionally verify the special-process tags `raisedfoil`, `firstplacefoil`, `dragonscalefoil`, `cosmicfoil`, `chocobotrackfoil`, `ripplefoil`, `rainbowfoil`, and `facetfoil`. Together with the source-defined tags above, the current special-process registry should recognize:

`surgefoil`, `textured`, `galaxyfoil`, `gilded`, `neonink`, `stepandcompleat`, `oilslick`, `halofoil`, `doublerainbow`, `confettifoil`, `raisedfoil`, `fracturefoil`, `manafoil`, `firstplacefoil`, `dragonscalefoil`, `singularityfoil`, `cosmicfoil`, `chocobotrackfoil`, `ripplefoil`, `silverfoil`, `rainbowfoil`, `invisibleink`, `facetfoil`, `glossy`, and `embossed`.

Representative primary API searches: [first-place foil](https://api.scryfall.com/cards/search?unique=prints&q=is%3Afirstplacefoil), [dragonscale foil](https://api.scryfall.com/cards/search?unique=prints&q=is%3Adragonscalefoil), [Chocobo track foil](https://api.scryfall.com/cards/search?unique=prints&q=is%3Achocobotrackfoil), and [facet foil](https://api.scryfall.com/cards/search?unique=prints&q=is%3Afacetfoil). `serialized` is deliberately excluded from this process list because it is a scarcity attribute.

The design must not assume that a process name ends in `foil`; `textured`, `gilded`, `oilslick`, and `doublerainbow` are counterexamples. A maintained known-tag table is useful for labels, but unknown tags must survive ingestion.

## Named treatment catalog and generic mappings

This catalog covers the Booster Fun era and current recurring treatment families relevant to sealed booster valuation. It intentionally excludes digital-only Arena card styles and the effectively unbounded one-off art direction of Secret Lair drops. The “machine mapping” column is what code can rely on; the marketing name is display metadata.

| Era / sets | Wizards' named treatments and styles | Machine mapping / implementation note | Official source |
|---|---|---|---|
| ELD onward (2019) | Showcase Adventure; recurring extended art and borderless | `frame_effects:showcase` or `extendedart`; `border_color:borderless`; foil remains a separate `finishes` value | [Project Booster Fun](https://magic.wizards.com/en/news/making-magic/project-booster-fun-2019-07-20) |
| IKO (2020) | Comic-book showcase mutate, borderless planeswalkers/Triomes, Godzilla Series | Showcase/borderless are generic; Godzilla uses `promo_types:godzillaseries` and `flavor_name` for the printed alternate name | [Collecting Ikoria](https://magic.wizards.com/en/news/card-preview/collecting-ikoria-2020-04-02) |
| ZNR (2020) | Showcase landfall, Expeditions, borderless Pathways/planeswalkers, full-art basics | Showcase/borderless/full-art generic; “Expedition” is primarily exact set/printing and box-topper/product metadata | [Collecting Zendikar Rising](https://magic.wizards.com/en/news/feature/collecting-zendikar-rising-2020-09-01) |
| KHM–VOW (2021) | Viking, Mystical Archive/Japanese alternate art, classic module, equinox, fang, Dracula Series | Most named frames collapse to `showcase`; Dracula has `promo_types:draculaseries`; language and illustration must remain separate | [Collecting Kaldheim](https://magic.wizards.com/en/news/feature/collecting-kaldheim-2021-01-07), [Collecting Innistrad: Crimson Vow](https://magic.wizards.com/en/news/feature/collecting-innistrad-crimson-vow-2021-10-28), [Innistrad Remastered return of equinox/fang](https://magic.wizards.com/en/news/feature/collecting-innistrad-remastered) |
| NEO–BRO (2022) | Soft glow, Ninja/Samurai, neon ink, gilded/Golden Age/skyscraper, stained glass, retro frame, schematic, shattered glass | Named showcase frames generally become `showcase`; special processes are `promo_types`; retro depends on `frame`; shattered glass has a dedicated frame effect | [Collecting Kamigawa: Neon Dynasty](https://magic.wizards.com/en/news/feature/collecting-kamigawa-neon-dynasty-2022-01-27), [Dominaria United stained glass](https://magic.wizards.com/en/news/feature/collecting-dominaria-united-2022-08-18), [The Brothers' War first look](https://magic.wizards.com/en/news/announcements/first-look-brothers-war-2022-09-29) |
| ONE (2023) | Borderless ichor, manga, concept Praetors, Phyrexian-language; step-and-compleat and oil slick raised foil | Visual names often share borderless/showcase fields; `concept`, `stepandcompleat`, and `oilslick` are promo tags; language/script is not a finish | [Collecting Phyrexia: All Will Be One](https://magic.wizards.com/en/news/feature/collecting-phyrexia-all-will-be-one) |
| MOM/MAT (2023) | Planar frames and returning plane-specific frames; Halo foil; serialized double-rainbow | Frame name is open vocabulary; `halofoil`, `serialized`, and `doublerainbow` are independent promo tags | [Collecting March of the Machine](https://magic.wizards.com/en/news/feature/collecting-march-of-the-machine) |
| LTR/LTC (2023) | Showcase Ring, borderless scene cards, Scrolls of Middle-earth, borderless poster and Brothers Hildebrandt art; silver, surge, and serialized double-rainbow foil | `showcase`, `scroll`, `poster`, `silverfoil`, `surgefoil`, `serialized`, `doublerainbow`; scene/Hildebrandt naming may require exact-printing display metadata | [Collecting The Lord of the Rings](https://magic.wizards.com/en/news/feature/collecting-the-lord-of-the-rings-tales-of-middle-earth) |
| WOE (2023) | Showcase Adventure, borderless Enchanting Tales/anime; confetti foil | Style and finish remain separate; confetti is `promo_types:confettifoil` | [Collecting Wilds of Eldraine](https://magic.wizards.com/en/news/feature/collecting-wilds-of-eldraine) |
| LCI/REX (2023) | Legends of Ixalan, Gods of Ixalan, Oltec, map-frame backs, Jurassic World; neon ink and embossed-logo variants | Generic showcase/borderless/DFC fields plus `neonink` or `embossed`; franchise subset is exact set/printing identity | [Collecting The Lost Caverns of Ixalan](https://magic.wizards.com/en/news/feature/collecting-the-lost-caverns-of-ixalan) |
| MKM/RVR (2024) | Dossier, invisible ink dossier, magnified, Ravnica City | First-party promo tags exist for all four (`dossier`, `invisibleink`, `magnified`, `ravnicacity`) | [Scryfall PromoType source](https://github.com/scryfall/api-types/blob/main/src/objects/Card/values/PromoType.ts) |
| PIP (2024) | Pip-Boy showcase, surge foil | `showcase` plus `surgefoil`; never create “surge” as a mutually exclusive replacement for the visual style | [Collecting Fallout](https://magic.wizards.com/en/news/feature/collecting-magic-the-gathering-fallout) |
| OTJ/BIG (2024) | Wanted poster, vault frame, raised-foil vault frame | Named frames may be only generic showcase/Booster Fun metadata; raised foil is a process and must remain composable | [Collecting Outlaws of Thunder Junction](https://magic.wizards.com/en/news/feature/collecting-outlaws-of-thunder-junction) |
| MH3/M3C (2024) | Borderless profile, frame break, retro frame; textured, foil-etched, ripple foil | `portrait` is observed for profile; process tags/finish classes must be kept separate; ripple can apply to an entire deck and to a thick display commander | [Collecting Modern Horizons 3](https://magic.wizards.com/en/news/feature/collecting-modern-horizons-3) |
| BLB (2024) | Showcase woodland, borderless field notes, Imagine: Courageous Critters, anime, Japanese raised foil | Most visual names are generic/printing-specific; raised foil and language are separate axes | [Collecting Bloomburrow](https://magic.wizards.com/en/news/feature/collecting-bloomburrow) |
| DSK (2024) | Double exposure, Japan Showcase, textured double exposure, fracture foil | `showcase`; live promo tags `japanshowcase` and `fracturefoil`; textured remains another process | [Collecting Duskmourn](https://magic.wizards.com/en/news/feature/collecting-duskmourn) |
| FDN (2024) | Borderless, Japan Showcase, returning historical showcase frames, mana foil | Historical frame names cannot be inferred from `showcase` alone; live `manafoil` identifies the process | [Collecting Foundations](https://magic.wizards.com/en/news/feature/collecting-foundations) |
| INR (2025) | Borderless, movie poster, returning equinox/fang, retro DFCs, serialized double-rainbow movie posters | `poster`, `showcase`, `frame`, `serialized`, and `doublerainbow`; never infer DFC or serialized from art style | [Collecting Innistrad Remastered](https://magic.wizards.com/en/news/feature/collecting-innistrad-remastered) |
| DFT (2025) | Borderless revved up, rude riders, graffiti giants and legends; Japan Showcase; first-place foil; serialized double-rainbow headliner | Generic borderless fields plus `japanshowcase`, `fracturefoil`, `firstplacefoil`, `serialized`, `doublerainbow`, and `headliner` | [Collecting Aetherdrift](https://magic.wizards.com/en/news/feature/collecting-aetherdrift) |
| TDM (2025) | Draconic frame, Ghostfire, clan cards, reversible dragons; Halo and dragonscale foil; serialized double-rainbow retro Mox Jasper | Visual vocabulary remains open; live tags cover halo/headliner/serialized/double-rainbow; dragonscale must be accepted as a new foil-process tag | [Collecting Tarkir: Dragonstorm](https://magic.wizards.com/en/news/feature/collecting-tarkir-dragonstorm) |
| FIN/FIC/FCA (2025) | FINAL FANTASY artist, Through the Ages, borderless woodblock/character/Adventure lands, alternate Cids and date cards; surge, neon-ink Chocobos, Chocobo track foil, oil-slick black Chocobo, serialized golden Chocobo | Set/printing identity plus borderless/variation/language fields and process tags; Chocobo color and language are not finish classes | [Collecting FINAL FANTASY](https://magic.wizards.com/en/news/feature/collecting-final-fantasy) |
| EOE/EOS (2025) | Stellar Sights and poster Stellar Sights, viewport, triumphant, surreal space, Japan Showcase; galaxy and singularity foil | Borderless/full-art/poster/Japan style fields plus process tags; singularity headliner is also textless | [Collecting Edge of Eternities](https://magic.wizards.com/en/news/feature/collecting-edge-of-eternities) |
| SPM (2025) | Classic comic, costume change, source material/scene treatments, borderless Gauntlet; textured and cosmic foil | Exact printing plus borderless/textless/process tags; cosmic headliners must not be treated as a new price class | [Collecting Marvel's Spider-Man](https://magic.wizards.com/en/news/feature/collecting-marvels-spider-man) |
| TLA (2025) | Battle pose and source material; raised foil headliner and textless neon-ink foil | Visual, textless, language, process, and headliner status are independent | [Collecting Avatar: The Last Airbender](https://magic.wizards.com/en/news/feature/collecting-avatar-the-last-airbender) |
| ECL/ECC (2026) | Fable frame, borderless nonlands, reversible shock lands, plane-themed Special Guests; serialized Bitterbloom Bearer | Frame name and reversible layout must coexist; serialized is an attribute; Special Guests is set/collation identity | [Collecting Lorwyn Eclipsed](https://magic.wizards.com/en/news/feature/collecting-lorwyn-eclipsed) |
| TMT/TMC/PZA (2026) | Signature Kevin Eastman headliners, source material, silhouette, pixel, scene, Pizza Bundle, sewer frame and Japan Showcase; surge and fracture foil | Open visual vocabulary plus exact set/printing; pixel cards combine a named style with surge foil, and Japan Showcase combines with fracture foil | [Collecting Teenage Mutant Ninja Turtles](https://magic.wizards.com/en/news/feature/collecting-teenage-mutant-ninja-turtles) |
| SOS/SOA (2026) | Mystical Archive and Japanese Mystical Archive, borderless field notes; silver scroll foil; serialized double-rainbow retro-inspired headliner | Archive/set/language/style metadata plus `silverfoil`/new silver-scroll tag, `serialized`, and `doublerainbow`; Japanese text is not a finish | [Collecting Secrets of Strixhaven](https://magic.wizards.com/en/news/feature/collecting-secrets-of-strixhaven) |
| MSH (2026) | Classic comic, logo, panel, source material, borderless scene/Gauntlet; cosmic foil textless headliner | Generic borderless/textless/full-art plus open promo tags; fewer-than-150 scarcity is not a finish | [Collecting Marvel Super Heroes](https://magic.wizards.com/en/news/feature/collecting-marvel-super-heroes) |
| HOB/HOC (2026) | Middle-earth classic artist, Dwarvish language, book cover, Dragon hoard frame, scene cards, journey/seasonal full-art lands; surge foil and gleaming-gold headliner | Named visual styles and language remain printing metadata; surge is a foil process; headliner/scarcity is separate | [Collecting The Hobbit](https://magic.wizards.com/en/news/feature/collecting-the-hobbit) |
| FRA/FRC (announced 2026) | Shattered mirror, echoed pairs, braintwister series, Japan Showcase; facet and fracture foil | Generic borderless/showcase plus `facetfoil`, `japanshowcase`, and `fracturefoil`; future-dated announced products are a strong test of unknown-tag tolerance | [Collecting Reality Fracture](https://magic.wizards.com/en/news/feature/collecting-reality-fracture) |

### What requires explicit name handling?

Only a few named families have dedicated Scryfall values (`poster`, `scroll`, `dossier`, `magnified`, `ravnicacity`, `portrait`, `japanshowcase`, etc.). Many set names—Adventure, landfall, Viking, stained glass, woodland, double exposure, draconic, Ghostfire, viewport, panel—can be represented only as generic `showcase`/borderless/full-art metadata in some or all printings. Therefore:

1. **Do not use a hard-coded name allowlist to decide whether a card is valid.** It will fail on the next release.
2. Use the exact printing as the valuation/collation unit and preserve raw tags.
3. Use a small alias table only to improve labels. The fallback label should be an honest generic description such as “Showcase · Fracture foil,” never “Other” and never an omission.
4. If exact marketing names are essential, store them as reviewed set metadata sourced from the corresponding Wizards collecting guide; do not infer them from collector-number ranges.

## Price-class and valuation implications

The physical-process vocabulary is much larger than Scryfall's price-class vocabulary. The safe normalization is:

| Exact printing reports | Price class |
|---|---|
| `finishes` contains `nonfoil` and the slot/card is nonfoil | `nonfoil` |
| `finishes` contains `etched`, or exact product uses `tcgplayer_etched_id` | `etched` |
| Any special foil process (`surgefoil`, `textured`, `gilded`, `halofoil`, `fracturefoil`, `manafoil`, `galaxyfoil`, `cosmicfoil`, `dragonscalefoil`, `singularityfoil`, `firstplacefoil`, `chocobotrackfoil`, `facetfoil`, raised/oil-slick, etc.) | `foil` unless a separate exact marketplace product/price is present |
| `serialized` | Not a finish. Keep the accompanying process (often `doublerainbow`) and flag serialized/outlier separately |

This mapping is about choosing the matching TCG price class, not collapsing printings. The app must still price only the same Scryfall/TCGplayer printing and must keep an exact treatment-specific observation when one exists.

## Repository-specific audit

At the research date, `src/data/scryfall.ts` accepts `frame_effects`, `promo_types`, `full_art`, `textless`, `variation`, and `border_color`, but reduces them to one `treatment?: string`. This loses valid combinations such as “Japan Showcase · fracture foil · full art.” It also does not ingest `finishes`, `security_stamp`, `flavor_name`, `illustration_id`, `lang`, or the raw tags into `CardPrice`.

More importantly, the committed `data/prices/*.json` snapshot currently omits the treatment fields even though the live adapter accepts them. A snapshot-backed result therefore cannot classify the same card as richly as a live result. That discrepancy should be fixed in the snapshot builder and covered by parity tests.

The domain `Finish` union (`nonfoil`, `foil`, `etched`, `surge`, `textured`, `gilded`, `serialized`, `other`) mixes price classes, processes, and serialized status. It cannot faithfully represent current fracture, mana, halo, galaxy, ripple, cosmic, dragonscale, singularity, silver, neon-ink, oil-slick, step-and-compleat, raised, invisible-ink, or future processes.

## Recommended robust contract

Preserve source metadata and normalize without destroying it:

```ts
interface PrintingTreatment {
  scryfallId: string;
  styleTags: string[];       // frame_effects + visual promo tags; unknowns retained
  finishClass: "nonfoil" | "foil" | "etched";
  processTags: string[];     // surgefoil, fracturefoil, textured, unknown future values
  attributeTags: string[];   // serialized, headliner, boxtopper, stamped, thick, etc.
  borderColor?: string;
  fullArt: boolean;
  textless: boolean;
  variationOf?: string;
  language: string;
  flavorName?: string;
  rawPromoTypes: string[];
  rawFrameEffects: string[];
}
```

Normalization rules:

1. Copy raw arrays into snapshots unchanged; do not filter against an enum.
2. Classify known tags with sets/maps, not an exclusive switch. A tag can contribute to more than one display facet if necessary.
3. If a `promo_types` value is unknown, preserve and humanize it; if the exact printing and price resolve, it is not incomplete data.
4. Derive `finishClass` primarily from `finishes` and exact marketplace product identity. Treat named foil processes as metadata on the foil class.
5. Keep `serialized` and `headliner` as attributes. Apply the existing massive-outlier policy independently of finish.
6. Keep language and `flavor_name` independent. Godzilla/Dracula/Universes Beyond reskins must retain the underlying Oracle identity and the printed display name.
7. Prefer a specific treatment market observation; otherwise use only the same printing's matching listed TCG foil/nonfoil/etched class as already required by the product contract.
8. Add snapshot/live parity tests and fixture cases with overlapping traits: showcase + fracture foil, borderless + poster + serialized + double-rainbow, full-art + textless + singularity foil + headliner, and retro + etched.

## Verification checklist

- Every exact printing survives ingestion even when a tag is new.
- All raw `frame_effects`, `promo_types`, `finishes`, and identity fields are byte-for-byte available after snapshot load.
- Multiple simultaneous treatments render as a composed label.
- Special foil names never select a nonfoil price and never cross printings.
- Etched remains distinct when an exact etched product/price exists.
- Serialized status does not replace the physical finish.
- Missing marketing-name aliases degrade to precise generic wording, not “Other,” “Model input,” or an incomplete-data warning.
- A newly released collector booster produces the same treatment descriptors from committed snapshot data and live Scryfall data.
