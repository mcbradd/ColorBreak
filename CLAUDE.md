# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

ColorBreak: a price board for MTG Whatnot color breaks, designed and built by Claude toward the outcome the user described. The current shape — everything shipped in a single `index.html` (CSS/JS inline, no build step, no dependencies, works from a plain `file://` open) — is a design choice, not a hard requirement. If additional tooling, files, or a build step makes a better product for the end user, make the better product. Today, everything else in the repo (`test/`, `tools/`, `docs/`) is repo-only and never ships.

## Commands

There is no package.json. Everything runs on Node stdlib.

- **Unit tests:** `node --test` (from repo root; picks up `test/*.test.mjs`)
- **Single test file:** `node --test test/pure.test.mjs`
- **Single test by name:** `node --test --test-name-pattern="<pattern>" test/`
- **Browser e2e (gates G1–G4, iPhone 15 Pro Max descriptor):** requires a local Playwright install — set `PLAYWRIGHT_DIR` to a directory whose `node_modules` contains `playwright`, then `node test/e2e/run-all.mjs` (or pass specific scenario files as args). e2e is skipped automatically under `node --test`.
- **Collation builder:** `node tools/build-collation.mjs <normalized-set.json> [slot-map.json] [ppb.json]`

## Architecture

### The @pure extraction harness (how unit tests work)

Side-effect-free functions in `index.html` are fenced with `// @pure` … `// @end-pure` comments (written at column 0). `test/extract.mjs` (`loadPure()`) regex-lifts those blocks out of the page verbatim and evaluates them, so unit tests exercise the exact shipped code with no build and no DOM. Consequences:

- Logic that needs unit coverage must live inside a @pure block and be genuinely DOM/state-free.
- Top-level `function` / `const` declarations in @pure blocks are what tests can reach.
- Tests pin behavior of shipped code — editing inside a @pure block can break tests that assert exact behavior (e.g. verdicts and SWR are explicitly "pinned by tests").

`index.html` is organized by `// ===== section =====` banners (constants, cost & fee model, state, fetch helpers, card classification, EV engine, product catalog, verdicts & SWR, board, run pipeline, persistence, models).

### Data flow

- Card pool prices come live from Scryfall (TCGplayer market); sealed box prices from tcgcsv.com through public CORS relays (user can paste a Cloudflare Worker URL under Advanced instead).
- Collation data is static JSON in `data/collation/{set}.json`, produced offline by `tools/build-collation.mjs` from MTGJSON exports. The page only fetches this JSON; it never runs the tools.

### tools/ — collation format v2 pipeline (maintainer-only)

`tools/README.md` is the authoritative spec — read it before touching anything here. The v2 output shape is **frozen**. Load-bearing rules:

- `sheets` card triples are `[cn, weight]` (own set) or `[setCode, cn, weight]` (foreign); consumers branch on array length, never on element type.
- Cross-set foreign cards (SPG, PLST bonus sheets): the builder resolves uuids only from the input document itself — an unresolved uuid is a **named build failure** (sheet + uuid), never a silent skip. Per-set MTGJSON exports may need the foreign set's `cardsById` pre-merged first.
- Hand-maintained inputs, not derivable from MTGJSON: `tools/slot-map.json` (sheet→slot labels, box-topper designation) and `tools/ppb.json` (packs-per-box; Feb-2025 DFT cutover: Play boxes 36→30).
- `data/published-rates/{set}.json` sidecars are hand-transcribed from articles **verbatim** — never renormalize or convert figures. Tolerance tiers and the coverage law (uncovered-and-unlisted = build failure) are specced in `tools/README.md` (DES4/DES5 decisions); `tierOf` enforcement lives in `tools/validate-rates.mjs`.

Fixtures in `test/fixtures/` encode these contracts (e.g. `eoe-normalized.json` is the pre-merged shape; `eoe-missing-foreign.json` must fail).

## Design system

`DESIGN.md` defines "The Board" — palette tokens, the fixed W U B R G M C L slot colors, locked type scale, the Break Bar, verdict rules, and a restraint list. These decisions are settled and CVD-validated; do not re-litigate them. The color contract (slot colors only in chips/bar segments/row keys, never on text or buttons) and the red↔green mitigations (2px gaps, in-segment letters, legend, duplicated table values) are law — keep all four mitigations if touching the bar.

## Agent skills

### Issue tracker
Issues and specs live in GitHub Issues for `mcbradd/ColorBreak`, managed via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels
Uses the five canonical triage-role labels unchanged (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs
Single-context layout — `CONTEXT.md` and `docs/adr/` at repo root, created lazily as domain modeling occurs. See `docs/agents/domain.md`.
