# ColorBreak design system — "The Board"

ColorBreak is a price board that sits beside a live Whatnot stream. The headline is a
dollar figure, not a word. Every screen answers one question fast: *does this slot have
an edge at this price?* Desk language throughout — line, edge, fade, chase, floor.
Never casino vocabulary.

## Tokens

| Token | Value | Role |
|---|---|---|
| `--bg` | `#0B0E14` | board |
| `--panel` | `#141B29` | felt — the only elevation step |
| `--line` / `--line2` | `#232C3E` / `#1D2434` | hairlines |
| `--text` | `#E9ECF2` | chalk |
| `--dim` | `#8B94A6` | secondary ink |
| `--faint` | `#808CA3` | tertiary ink (≥4.5:1 on panel — do not darken) |
| `--gold` | `#C9A227` | **semantic only**: break-even lines, freshness stamp, wordmark accent, primary button |
| `--good` | `#33D17A` | edge (+EV) — never shipped without `--bad` in the same view |
| `--bad` | `#FF6247` | fade (−EV) |

### Slot colors (categorical, fixed order W U B R G M C L)

`W #EDE8C8 · U #1E7CC2 · B #71487F · R #C8342E · G #1E7A48 · M #C9A227 · C #97A2B3 · L #9A6430`

CVD-validated (dataviz six-checks, dark surface). The red↔green deutan pair sits in the
6–8 ΔE band, which is legal **only because** segments carry 2px `--bg` gaps, in-segment
letters, a visible legend, and the table duplicates every value — keep all four.
White/Colorless chroma "failures" are accepted MTG identity. Multicolored deliberately
shares gold with `--gold` (MTG multicolor *is* gold); the color contract keeps them
distinguishable by context.

**Color contract (law):** slot colors appear only in chips, bar segments, and row keys —
never on buttons, borders, headings, or text. Text never wears a slot color; identity
comes from a colored mark beside neutral ink. The one exception: labels *inside* a bar
segment use that slot's paired ink value.

## Type

- **Fraunces 900** — the wordmark "ColorBreak" only. No serif anywhere else.
- **IBM Plex Sans** 400/600 — body/UI, sentence case.
- **IBM Plex Mono** — every dollar figure, and 10.5px/+0.09em uppercase for eyebrows,
  labels, timestamps, table headers (the "ticker voice"). `tabular-nums` in columns only.
- Locked scale: **10.5 / 11 / 13 / 15 / 19 / 28 / 40** px. Giant numerals are 28–40 mono.
  No middle sizes. 4px spacing grid. Radii: **6** (chips/inputs), **10** (cards/buttons),
  **16** (panels).

## Signature — the Break Bar

One element, four jobs. (1) **Brand:** equal eighths in slot colors on first run — it is
the logo and the favicon. (2) **Instrument:** on fetch it eases once from eighths to EV
shares — the page's only orchestrated motion; `prefers-reduced-motion` jumps to the final
state. (3) **Nav:** every segment is a real `<button>` with an aria-label
("Green — $27.10, 13% of EV") that opens that slot's drill-down sheet (top 10
contributors); a visible legend carries names and values for touch. (4) **Staleness:** post-fetch input changes or >24h-old restored data
desaturate the bar and flip the ticker stamp to STALE.

## Verdicts

Net = slot EV (run) − landed cost, where landed cost is the asking price plus the buyer's
S&H — charged once per order, so a slot combined into an order already paying it adds
none. The seller side has always modelled S&H; the buyer side must too, or a near-deadband
FAIR is really −EV. Tags: **+EV / FAIR / −EV**, where FAIR is
|net| ≤ max(8% of price, $1) — no false precision. **LOTTERY** when the top card is ≥50%
of slot EV, else **STEADY**. Tags always carry text; color never stands alone.

## Restraint list

No new fonts or hues. No textures, noise, or foil gradients. No mana symbols or card
frames (WotC IP). No charts beyond the bar and small meters. No light theme. Copy follows
the frontend-design writing rules: active voice, verbs say what happens ("Load board"),
errors explain the fix, empty states invite the first action.
