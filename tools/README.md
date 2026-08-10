# tools/ — collation format v2 builder (S3a)

Maintainer-only. Nothing here ships to the page (`index.html` only fetches the JSON these
tools produce, from `data/collation/{set}.json`). Node stdlib only, no dependencies, no
network calls — `node tools/build-collation.mjs <normalized-set.json> [slot-map.json] [ppb.json]`.

## Format v2 (frozen)

```
{ v: 2, set,
  src: { mtgjsonVersion, mtgjsonDate, builtAt },        // provenance
  ppb: { play, collector, draft?, set? },                // tools/ppb.json, NOT from MTGJSON
  products: { play | collector | set | draft:            // all four keys legal
    { layout: [{ sheet, count|rate, slot? }],
      sheets: { name: { foil, cards: [[setCode?, cn, weight], …] } },
      boxTopper: { sheet, ratePerBox } | null } } }       // per-PRODUCT
```

- **`cards` triples** are `[cn, weight]` when the card is in the file's own `set`, or
  `[setCode, cn, weight]` when it's foreign (bonus sheets — SPG, PLST, …). Consumers
  branch on `array.length`, not on the type of element 0 (collector numbers are strings
  too, e.g. `"A-123"`).
- **Cross-set foreign cards, resolution contract:** the builder resolves a bonus-sheet card
  only if its uuid is present in the input document's own `cardsById`/`cards[]`. It never
  fetches or merges another set's file itself — a real per-set MTGJSON export's own file may
  not embed foreign cards (e.g. SPG), so building against one requires pre-merging the
  foreign set's `cardsById` into the input first (or building from an AllPrintings-derived
  document that already carries every uuid). An unresolved uuid is a build failure, named by
  sheet + uuid, never a silent skip or guess (ponytail: this builder doesn't fetch/merge
  foreign sets — upgrade path is a maintainer pre-merge step or an AllPrintings-based input).
- **`layout[].slot`** comes from `tools/slot-map.json`, not from MTGJSON — sheet names are
  a set's own convention (e.g. a set may reuse one physical sheet across two slot
  purposes), so the mapping is hand-maintained. Resolution rule: `selector.slot` in a
  published-rates entry means "union of every layout entry carrying that label";
  `selector.sheet` narrows within that union.
- **`count` vs `rate`**: MTGJSON booster configs are a weighted list of pack *variants*,
  each contributing a possibly-different number of cards from a given sheet. The builder
  emits `count` (a fixed integer) when every variant agrees, `rate` (the weighted-average,
  possibly fractional) otherwise.
- **`boxTopper`** is hand-designated per (set, product) in `slot-map.json`'s `topper` key
  (`{ sheet, ratePerBox }` or `null`) — MTGJSON doesn't mark box-topper sheets or their
  per-box rate, so this can't be derived. `null` when the product ships no topper (e.g.
  Collector Boosters usually carry their "extra" inside the normal sheets, not a topper).

## Config-name mapping (DES5-05)

MTGJSON booster config keys don't map 1:1 onto v2 product keys. Pinned rule
(`mapConfigName` in `build-collation.mjs`):

| Raw config key | v2 key |
|---|---|
| `play`, `collector`, `draft`, `set` | itself |
| `default`, release date < 2024-01-01 | `draft` (pre-2024 sets shipped one draft-style config under `default`) |
| `default`, release date ≥ 2024-01-01 | `play` (2024+ sets with no separate draft product use `default` for Play Boosters) |
| `jumpstart`, `arena`, `box`, `sample` | dropped — never emitted |
| anything else unrecognized | dropped defensively |

An explicit `play`/`collector`/`draft`/`set` key always wins over a same-target `default` —
`default` only fills a v2 key that's still empty.

## Slot-map input (`tools/slot-map.json`)

Per (set, product): `slots` maps a raw sheet name to the slot label(s) it feeds (array when
one sheet legitimately rides more than one slot); `topper` designates the box-topper sheet
+ its hand-sourced `ratePerBox`, or `null`. Seed sets beyond EOE land in S3b.

## `ppb` table (`tools/ppb.json`)

Hand-maintained, not derived from MTGJSON. Feb-2025 DFT cutover: Play Booster boxes go
36 → 30 packs; Draft stays 36, Set stays 30, Collector stays 12. `overrides[set][product]`
lets a specific release diverge (e.g. a Universes Beyond Collector Booster box) without
touching the shared default table. `defaultPpb(product, releaseDate)` implements the table;
`set` is always 30 regardless of date.

## Published-rates sidecar (`data/published-rates/{set}.json`, hand-transcribed)

```
{ url, ppb: { play, collector, … },
  entries: [ { product, stat: 'slotRate' | 'rarityMix' | 'perBox',
               selector: { slot?, sheet?, rarity?, setCode? }, value | max } ] }
```

- `slotRate` / `rarityMix` are percentages; `perBox` is expected copies/box. Transcribe the
  article's numbers verbatim — never renormalize, never hand-convert a per-box figure.
- **Tolerance (DES5-02, schema-level; enforced by S3c's `tierOf`):** default absolute
  tolerance is ±0.5 pt for `slotRate`/`rarityMix`, ±0.05 copies for `perBox`. Magnitude
  clause: when `slotRate` value < 5%, tolerance is `min(0.5 pt, 20% relative)`; when
  `perBox` value < 0.5, tolerance is `min(0.05, 20% relative)`. `{max}` entries (e.g. `<1%`
  upper bounds) are exempt from the magnitude clause — they stay absolute. This exists
  because a flat ±0.5 pt is ±32% relative at SPG-class serialized rates (~1.56%): loose
  enough to pass numbers that are 25× wrong.
- **rarityMix denominator (DES4-02):** bonus/foreign sheets riding a slot get their own
  `selector.setCode`/`sheet` rows — never folded into the slot's C/U/R/M split.
- **Weighting formula (DES5-07):** `P(rarity|slot) = Σ_s rate_s·w_s(rarity) / Σ_s rate_s`,
  summed over every layout entry carrying that slot label, where `w_s(rarity)` is that
  sheet's internal rarity-weight share. The four worked EOE examples below are checked
  against this formula, not used to define it.

**Worked EOE examples (binding, one per stat shape)** — see
`test/fixtures/published-rates/eoe.json`:

```
{ product:'play', stat:'slotRate', selector:{sheet:'stellarSights', slot:'wildcard'}, value:12.5 }
{ product:'play', stat:'perBox',   selector:{sheet:'topper'}, value:1 }
{ product:'play', stat:'rarityMix', selector:{slot:'wildcard', rarity:'uncommon'}, value:62.5 }
{ product:'play', stat:'rarityMix', selector:{slot:'wildcard', rarity:'mythic'}, max:1 }
```

## Coverage / exemption / consistency (`data/published-rates/MANIFEST.json`, schema frozen here)

```
{ exemptions: [ { set, product, slot, reason } ],
  consistency: [ { set, product, source: 'TEV', date, offsetNote } ] }
```

See `test/fixtures/manifest/MANIFEST.sample.json`. **Coverage law (DES4-03, upgraded
per-slot by DES5-01 — enforced by S3c's `tierOf`, schema only here):** a (file, product)
tiers COMPUTED only if it has a `ppb` entry AND every distinct `slot` label in that
product's layout is addressed by ≥ 1 `slotRate`/`rarityMix` entry AND every layout sheet
carrying a foreign/bonus setCode is addressed by ≥ 1 entry — otherwise RED unless listed in
`exemptions`. Uncovered-and-unlisted is a build failure, never a silent skip.

## Scope note (S3a vs S3c)

This story freezes the v2 output shape and ships the builder + fixtures. It does **not**
implement `tierOf`/coverage-gating or the tolerance-check logic that reads the sidecar
against real collation data — that's S3c's gate harness, which consumes the schema frozen
here. `build-collation.mjs` accepts either a raw MTGJSON per-set export (`data.cards[]`
keyed by `uuid`) or the pre-flattened `cardsById` form; seed-set-specific `slot-map.json`
entries beyond EOE still land in S3b.
