# Mobile entry viewport contract

Both buyers and sellers must enter consecutive products, change quantities and read values without opening another page. Keeping the focused input visible is insufficient: its Done action and at least one search match must be reachable above the keyboard and value strip.

`src/mobile-input-viewport.ts` owns visible geometry. CSS consumes its measured height, offset and bottom inset. Keyboard detection only selects compact styling; dock positioning and sheet bounds must not depend on that heuristic. Numeric controls own the full input/Done footprint. CSS must keep that footprint in normal flow inside bounded lists.

The previous implementation compared consecutive resize events, canceled focus correction on every viewport pan, and centered fields in the layout viewport. Deterministic replays reproduced hidden fields during small keyboard animation steps, a lost correction after native panning, and Done behind the dock. Review also reproduced unwanted snap-back after deliberate scrolling followed by bar movement, and an incorrect portrait baseline after rotation.

## Regression command

`npx vitest run src/mobile-input-viewport.test.ts src/mobile-input-viewport.regression.test.ts`

These tests exercise the installed event listeners with a visual viewport smaller than the layout viewport, modeled scroll geometry, gradual resizes, native panning, toolbar changes, pinch zoom, rotation event ordering, nested list clipping, focus restoration, deliberate scrolling, renewed typing, delayed search matches, and the window-resize fallback.

The visual browser check must also cover 320px and 390px widths, normal and short visible areas, search → product → quantity → Done → another product, the final row in a bounded product list, and paste → Review products. At 190px visible height, quantity and Done share one 48px row; the paste header, textarea and footer compact to keep both text entry and review reachable. Close and Done must remain touch targets. Preserve warnings beside values.

`npm run test:browser` checks the built app in Chromium and WebKit. The command-panel suite covers both jobs at 320/390/430/768/1440px, consecutive entry, nested information, focus/scroll restoration, hover and retained state. The viewport suite holds the layout viewport tall while reducing the modeled visual viewport to 350px and 190px; it checks top offsets, safe-area insets, dock navigation, numeric Done, modal focus and landscape. The runner owns its preview server and writes screenshots under `.browser-evidence/`.

These browser engines and modeled geometry are not physical iPhone/iOS Chrome verification. Record device, iOS version, Chrome version and build number for device acceptance, then check:

- Add two products consecutively using the onscreen keyboard; edit the final quantity and tap Done.
- Expand/collapse both browser bars, pan the focused field and intentionally scroll away. The app must respect deliberate scrolling.
- Rotate with a field focused; verify the field, Done and live values remain reachable above the keyboard.
- Verify portrait and landscape clear Dynamic Island and home-indicator safe areas.
- Open product → price and team → full-page card information; close each layer and confirm the same scroll, query, quantity, sort and focus.
- Move between Break, Teams/Values and Decision/Plan while the keyboard closes; the chosen destination must remain visible.
- Use desktop keyboard navigation, reduced motion and a pointer hover preview; no focus may disappear into a hidden panel.

## Platform basis

- [CSSOM View](https://drafts.csswg.org/cssom-view/#visualviewport) defines visual viewport offsets relative to the layout viewport and describes keyboard-related scrolling of both viewports.
- [CSS viewport units](https://drafts.csswg.org/css-values-4/#viewport-variants) distinguish dynamic browser UI from overlays such as keyboards. Dynamic units alone are insufficient.
- [Chrome's viewport resize guidance](https://developer.chrome.com/blog/viewport-resize-behavior/) describes visual-only and layout-plus-visual resizing. Keep `interactive-widget=resizes-content` as an enhancement while supporting both behaviors.
- [WebKit feature configuration](https://raw.githubusercontent.com/WebKit/WebKit/main/Source/WTF/Scripts/Preferences/UnifiedWebPreferences.yaml) includes current interactive-widget work; source-tree support does not prove support in a particular installed iOS release.

## Shared quantity controls (build 8)

Every product quantity surface consumes `features/shared/QuantityControl.tsx` and its integer NumericInput. The picker reserves the full selector width before selection. At very short heights, the field and its Done share one row; the picker hides its redundant composition footer while that number is being edited. Hidden footers do not restrict the viewport reveal bounds.

`node tools/check-quantity-layout.mjs <base-url>` uses the locked Playwright dependency to verify buyer and seller quantity editing at 320, 390 and 768px, including 190px visible height. It checks row positions, visible editable quantity, field and Done bounds, edits and commit. It also runs in `npm run test:browser`.
