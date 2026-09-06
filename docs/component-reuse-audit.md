# Component reuse audit — build 8

Reviewed all production TSX under `src`, shared hooks, component imports, raw input and dialog markup, and quantity rules across the project's CSS layers. This is a source and browser audit; the automated name check cannot detect every renamed or structurally similar component.

## Duplicates resolved

| Component type | Previous implementations | Owner after consolidation |
| --- | --- | --- |
| Product quantity | Picker-only minus/plus; ProductBuilder's number input; QuickQuantity | `features/shared/QuantityControl.tsx`, consumed by picker, buyer composition, seller composition and seller planning |
| Numeric editing | Shared NumericInput plus four raw seller receipt/shipment number fields | `Primitives.tsx` NumericInput; integer keypad for quantities, decimal keypad for money, draft editing and visible Done shared |
| Compact warning | BuyerVisuals and shared Feedback | `shared/Feedback.tsx` |
| Incomplete-data warning | BuyerVisuals and shared OutcomeFeedback; the latter had lost detailed omission explanations | `shared/OutcomeFeedback.tsx`, preserving effects, technical disclosure and source links from the fuller version |
| Outcome simulation lifecycle | BuyerVisuals and shared OutcomeFeedback | Shared hook owns request identity, cancellation, retry, settled submission and optional idle refinement; buyer adapter selects refinement, seller can select settling |
| Picker quantity layout | Legacy mobile named grid areas, independent picker controls, old quantity-control styles | Shared selector styling with picker-only row placement; obsolete mobile and old selector rules removed |

All product quantity controls use decrement / editable quantity / increment. The range is 1–999; decrementing one invokes the caller's removal action. Clearing a field while typing is allowed without deleting its product; decimal quantities are rejected. Enter and the input's Done finish editing. The picker reserves identical columns and padding before and after selection. On small screens it omits the decorative product icon to preserve readable names and full-size controls. A short keyboard viewport temporarily uses the existing input-and-Done compact mode while editing.

## Other component families reviewed

| Family | Finding |
| --- | --- |
| Numeric labels, tooltips, information labels, headings, formatting | Already owned by Primitives; domain-specific labels and units remain caller data. |
| Dialogs: product builder, card inspector, evidence | Different contents and sizing, but all share useDialogOwnership for focus trapping, Escape and return focus. No second ownership implementation found. |
| Search | Buyer set browser, seller combined product combobox and contributor filtering search different entities and have different navigation contracts. Keep separate compositions; quantity editing and catalog/domain utilities are shared. |
| Warning and loading displays | Shared recoverable and incomplete-data warnings now have single owners. OCR progress is a separate staged file operation; catalog loading and estimate refresh have their own request state. |
| Product rows | Same quantity control, different surrounding data: buyer contents, seller acquisition costs and picker selection. These rows are contextual compositions, not interchangeable controls. |
| Cards | PublicCardPlaceholder, compact contributor thumbnail and full CardInspector serve different sizes and information depth. Shared card labels and domain values already supply their identity. |
| Slot and range views | SlotRail, SlotCandle, seller comparison candles and OutcomeRange have different interactions and comparisons. Shared simulation owns results; consolidating the entire charts would couple buyer assignment to seller planning. |
| Forms and selects | Remaining raw inputs are search, text/reference, read-only share URLs, file selection or checkboxes. Native selects choose catalog products, shipping methods or orders. No remaining raw numeric inputs bypass NumericInput. |
| Workspace controllers | Buyer and seller intentionally own different saved state and decision lifecycles. They share canonical product identity, evaluation, pricing, share encoding and persistence utilities. Their small share-status markup is repeated but has no independent control behavior. |

## Remaining maintenance risks

- Styles still span `styles.css`, `supplemental.css`, `modern.css` and `future.css`. This release removes the conflicting quantity rules, but does not claim a complete CSS architecture migration. New behavior belongs in the shared owner; avoid a surface-specific copy of its controls.
- Some compatibility re-exports remain in ProductBuilder and BuyerVisuals. They forward shared implementations rather than defining another copy. New consumers should import from the shared owner directly.
- Component-name uniqueness is a useful guard, not a semantic clone detector. Differently named copies still require review.

## Verification

- Picker tests cover visible quantity, direct numeric replacement, empty drafts, integer-only entry, Done, limits, removal and cross-set identity.
- Existing seller composer, numeric input, shipment and simulation lifecycle tests exercise the shared owners through their callers.
- `npm run check:shared-imports` now guards quantity UI dependencies, duplicate named component implementations and raw numeric input bypasses.
- `tools/check-quantity-layout.mjs` checks real Chromium layouts at 320, 390 and 768 CSS pixels, before/after selection geometry and editing in a reduced viewport. Run it against the preview or published URL with Playwright available through NODE_PATH.
- Visual viewport regression tests cover nested scrollports, toolbar/keyboard changes, native panning and focus restoration. Chromium viewport checks do not constitute physical iOS Chrome verification.


## Best available answers (build 9)

`AnswerValue`, `AnswerNote`, and `AnswerGraphic` own calculated-value and chart annotations. `EstimateTip` owns the circled-asterisk symbol and delegates popover behavior to the existing shared `Tip`; numeric planning fields use that same symbol. Quantity controls remain exact entered counts, with no additional layout changes.

`answerFactors` owns plain-language evidence explanations. `quickOutcomes` provides immediate analytic previews; the shared simulation hook replaces them with sampled opening ranges and retains valid same-model results through retries. `answer-cache` reuses only matching product/pack-size/threshold values and scales quantities. `approximateOutcomes` preserves known expected value when exact pack grouping is missing, with that assumption disclosed.

Checks: `best-answer.test.ts`, shared simulation lifecycle tests, buyer/seller command-center tests, and `tools/check-answer-layout.mjs`. The real browser script checks visible numeric limits, popover bounds, Escape, short viewports, and horizontal overflow at 320, 390, and 768 pixels. `check-quantity-layout.mjs` separately protects stable product selection and keyboard-safe quantity entry.
