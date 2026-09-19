# Product entry repair — build 18

## Intent

Address the iPhone 17 Pro Max / iOS Chrome report: product entry must always offer a direct exit, independent of network work. The entry frame and search controls stay in place; result lists own scrolling. Each character immediately filters locally available set buttons by set name or code.

## Measurements

- Browser check `node tools/check-product-entry.mjs`: persistent Close in every entry stage, bounded frame, result-only scrolling, visible search/exit at 320–440px, short visual viewports and safe-area offsets; repeat in Chromium and WebKit.
- Unit regression: closing after selection completes immediately while evidence preparation is unresolved.
- Unit regression: one-letter set buttons update synchronously while product requests remain unresolved.
- Full check and all browser acceptance before release, followed by public deployment verification and changed-flow checks.

## Reproduction

Build 17 at 440 × 956: choosing a set leaves zero Close buttons. The 942px entry frame scrolls through 4,725px of content in Chromium and 4,524px in WebKit. `node tools/check-product-entry.mjs` fails on the absent direct exit. The iPhone report is the physical-device evidence; these desktop-engine reproductions isolate matching defects, not a claim of device equivalence.

## Header intent

Put assumptions and bulk filtering opposite Check a bid in one row. Assumptions opens an owned information layer; shipping, tax and threshold edits persist. The header switch changes bulk filtering immediately. Closing the layer restores the exact opener, including the large-break cost shortcut.

Acceptance: both browser engines at 320, 390, 440 and 1440px assert the title and controls fit without overlap, the switch changes state immediately, and tax persists across closing/reopening. Existing evidence checks cover the large-break shortcut and focus restoration.

## Changes

- Persistent Close beside a separate Back in product entry. Done, Close, Escape and accepted imports return immediately; background valuation belongs to the workspace.
- Fixed entry frame follows the visual viewport. Search and exit remain visible at 350px and 190px keyboard heights; only content regions scroll. Removed inherited desktop centering that displaced the new frame.
- Shared local set matcher updates the set buttons on every character of a name or code.
- Buyer header owns the assumptions popover and bulk switch.

## Validation

Initial full check: 496 application tests, six root Vitest tests, 42 Node tests; data, collation, build, deployment-path and OCR checks passed. Final release checks include additional exit variants and both browser engines. Browser evidence models keyboard resizing and cutout offsets; physical iOS Chrome acceptance remains separate.

Final local browser acceptance: all 62 scenarios passed across Chromium and WebKit. Added Done/Close/Escape variants pass (eight tests across exit and cost-persistence suites). Header screenshots were inspected at 320px; both engines capture the four-width header geometry in the browser evidence artifact. Build 18 is the release candidate; CI and public verification enforce the delivery gate.

CI attempt d5f1d2c passed all application tests and Chromium scenarios, then WebKit timed out selecting the second seller product (FIN Play Booster Pack). Thirty local WebKit consecutive-entry repetitions and the full command-panel rerun passed. No application cause was reproduced. The browser check now captures query, visible page text, request failures and a screenshot on failure, and explicitly checks the second query survives recalculation; its assertions and timeout remain unchanged. A fresh CI gate is required before publishing.

## Recalculation input iteration

Intent: native search text must survive a background valuation/metadata render, including the second product entered in WebKit. Measure with a deterministic unit sequence that edits the DOM, rerenders metadata, then delivers the input event; retain the existing browser assertion and repeat the full gate.

The second CI capture had an empty query, no page errors and no failed requests immediately after entering FIN. The new unit sequence failed because a controlled rerender erased the pending native text. Search now lets the input own its text, synchronizes filtering on native input events, and changes the DOM only for an intentional clear, suggestion selection or product addition. Recalculation cannot overwrite a partially delivered edit. This unit sequence models the observed race; final WebKit CI still decides acceptance.
