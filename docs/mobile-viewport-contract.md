# Mobile entry viewport contract

The seller must enter consecutive products, change quantities and read values without opening another page. Keeping the focused input visible is insufficient: its Done action and at least one search match must be reachable above the keyboard and value strip.

`src/mobile-input-viewport.ts` owns visible geometry. CSS consumes its measured height, offset and bottom inset. Keyboard detection only selects compact styling; dock positioning and sheet bounds must not depend on that heuristic. Numeric controls own the full input/Done footprint. CSS must keep that footprint in normal flow inside bounded lists.

The previous implementation compared consecutive resize events, canceled focus correction on every viewport pan, and centered fields in the layout viewport. Deterministic replays reproduced hidden fields during small keyboard animation steps, a lost correction after native panning, and Done behind the dock. Review also reproduced unwanted snap-back after deliberate scrolling followed by bar movement, and an incorrect portrait baseline after rotation.

## Regression command

`npx vitest run src/mobile-input-viewport.test.ts src/mobile-input-viewport.regression.test.ts`

These tests exercise the installed event listeners with a visual viewport smaller than the layout viewport, modeled scroll geometry, gradual resizes, native panning, toolbar changes, pinch zoom, rotation event ordering, nested list clipping, focus restoration, deliberate scrolling, renewed typing, delayed search matches, and the window-resize fallback.

The visual browser check must also cover 320px and 390px widths, normal and short visible areas, search → product → quantity → Done → another product, the final row in a bounded product list, and paste → Review products. At 190px visible height, quantity and Done share one 48px row; the paste header, textarea and footer compact to keep both text entry and review reachable. Close and Done must remain touch targets. Preserve warnings beside values.

Local browser checks exercise Chromium responsive layouts; the geometry tests replay viewport sequences. Neither is physical iPhone/iOS Chrome verification. Device acceptance additionally requires opening/closing the keyboard, expanding/collapsing both browser bars, rotating with a field focused, and scrolling away intentionally. Record device, iOS and Chrome versions when that check is performed.

## Platform basis

- [CSSOM View](https://drafts.csswg.org/cssom-view/#visualviewport) defines visual viewport offsets relative to the layout viewport and describes keyboard-related scrolling of both viewports.
- [CSS viewport units](https://drafts.csswg.org/css-values-4/#viewport-variants) distinguish dynamic browser UI from overlays such as keyboards. Dynamic units alone are insufficient.
- [Chrome's viewport resize guidance](https://developer.chrome.com/blog/viewport-resize-behavior/) describes visual-only and layout-plus-visual resizing. Keep `interactive-widget=resizes-content` as an enhancement while supporting both behaviors.
- [WebKit feature configuration](https://raw.githubusercontent.com/WebKit/WebKit/main/Source/WTF/Scripts/Preferences/UnifiedWebPreferences.yaml) includes current interactive-widget work; source-tree support does not prove support in a particular installed iOS release.
