# Seller usability revision — September 5, 2026

The primary job is to enter a complete mixed-product break and read value during a 5–10 second auction. Speed here means removing navigation and blocking computation, while preserving the distinction between expected value, a typical opening, and seller profit.

## History reviewed

- `c02d785` restored visible product/quantity controls after sheets hid the working task.
- `118af7f` made seller economics update while typing; `eab2706` later cleared analysis and unmounted those controls on every line change, including each cost keystroke.
- `04a26b7` restored add/remove/quantity in the picker, but only within one set. Search still required set → product → Back, and calculation waited for the sheet to close.
- `94f804f` fixed cross-set identity; `60a6f81` fixed clearable numeric drafts and mobile Done; `714b8a3` protected pending selections from price refresh. These behaviors are retained.
- `34c68d0` added screenshot transcription into editable import review. Import remains reviewed and now opens directly from Seller Studio.

## Revision

The seller searches across set names/codes and product terms, taps an exact match, changes quantity, and immediately searches again. Identity-only catalog loading replaces speculative valuation of all alternatives. Analytic card EV starts immediately; 180ms settling coalesces rapid range requests. One distribution serves all eight color selections.

Desktop keeps composition and ranges side by side. Phone entry keeps a compact total/typical-value strip visible, with a bounded product list and keyboard-aware positioning. The result distinguishes average EV from p10/median/p90 opening outcomes. The random preview covers all eight colors; the buyer workspace retains remaining-pool and full buyer-cost handling. Stale or partial evidence remains visible but cannot produce a current bid limit.

Cost edits preserve focus and do not recalculate card values. New mix requests invalidate obsolete results. Standing seller assumptions survive continuing edits, while composition-dependent targets reset and receipts retain ownership. Seller economics precede receipts and optional bonus planning.

## Regression protection

Tests cover mixed-set entry, exact identity and existing costs, keyboard search, numeric drafts/Done, removal/Undo, retriable catalog failures, late responses, cost-focus persistence, seller-plan ownership, zero medians, stale/incomplete evidence, and coalescing simulation requests. Browser verification covers the mixed FIN/EOE/MSH flow, narrow phone layouts, direct import, and actual-cost typing. Timing observations describe this local browser only; actual device/network performance is not guaranteed.
