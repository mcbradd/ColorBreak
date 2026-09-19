# Buyer and seller command panels

Baseline: build 16, `12c2287`. The preceding integration is complete: [Pages run 35435008199](https://github.com/mcbradd/ColorBreak/actions/runs/35435008199) succeeded, public bytes matched main, and the buyer flows passed at 320, 390 and 768px. Ten remote and three local feature branches were pruned, leaving the main worktree; original refs are bundled locally.

## User intent

Buyers and sellers need the best available answer fast, on one working screen. Product entry must minimize taps and preserve the working context. Names, prices and charts should reveal the information that explains them in an information layer; dismissing it restores the exact invoking context. Phone layouts must respect browser chrome, safe areas, keyboard and visual viewport changes. Desktop must remain efficient with pointer and keyboard.

The user-requested public interfaces are the test seams: buyer/seller product entry and decisions, contextual information layers, and viewport/input behavior. Tests exercise visible actions and results; remote data, time and browser geometry are controlled where needed. Existing domain and pricing contracts remain authoritative.

## Loop 1 — direct entry and one working screen

**Statement of intent:** Both jobs share an immediate, inline set/product search. Adding a known product requires typing a query and one selection, with no required set page or Done/apply step. Quantities, current composition, format/slot controls and the current decision remain in the same workspace. Existing paste/screenshot import stays available as an optional information layer.

**Measurements:** Buyer and seller workflow tests add products, continue entry, adjust quantities and retain independent job state. A second product must require no reopening or confirmation. Cached matching values appear during updates, and delayed/failed enrichment preserves usable decisions. Desktop and phone browser checks measure actual selection-to-visible-composition time and check that search/quantity controls stay reachable.

**Execution:** Complete locally. The first entry and panel-navigation tests failed against the old interface, then passed through the real App. Both jobs now use QuickBreakComposer and CommandPanel; obsolete buyer-only composition markup is removed. Full check passed: 485 application tests, 6 root Vitest tests, 42 root Node tests, shared-boundary/data/collation checks, production build and deployment-path/OCR checks. Generated price inputs had to be rebuilt before the data-dependent tests could run. Chromium passed both jobs at 320/390/430/768/1440px; observed one-selection entry was 298–347ms on this machine. The existing buyer evidence flow passed 320/390/768px including sorting, thumbnail details, return focus, ownership, sharing and Large Break. Local logs/screenshots: `.git/command-panel-evidence/loop1` and `.preview-loop1-*.log`. Release remains deferred until all loops finish.

## Loop 2 — context-preserving information

**Statement of intent:** Shared information interactions make displayed amounts and meaningful names actionable. An information layer explains the selected value/version, evidence and useful deeper detail. Close, Escape and outside dismissal return focus and scroll to the invoking element without changing the composition, query, sort, expanded group or quantities. Existing card details remain a full-page layer.

**Measurements:** Tests cover pointer and keyboard entry, explicit close, Escape, outside dismissal, nested layers, focus ownership, exact formatting/evidence, and state retention. Browser checks open details from scrolled lists and both workspaces, then compare their original scroll position and state. Avoid nested interactive controls.

**Execution:** Complete locally. Red/green tests added for exact amounts/evidence, close/Escape/outside dismissal, nested focus ownership, help-first Escape and keyboard-to-information scroll handoff. CardInspector is now shared, as are seller team members. Full check passed: 491 application tests, 6 root Vitest tests and 42 root Node tests, plus build/data/bundle gates. The first build exceeded the unchanged 560kB entry budget; deferring the seller pricing/receipt workbench reduced entry to 532.24kB (166.06kB gzip). Chromium and WebKit passed both jobs at 320/390/430/768/1440px, including product → price and team → card nested layers, focus, preserved query/quantities/scroll and invalid-nesting checks. Existing buyer evidence checks passed again at 320/390/768px. Logs: `.preview-loop2-*.log`; evidence: `.git/command-panel-evidence/loop2` and `loop2-webkit`. These are desktop browser engines, not a physical iPhone session.

## Loop 3 — viewport, performance and release

**Statement of intent:** The command panels remain readable and navigable with mobile browser chrome, onscreen keyboards and safe-area insets. Information and entry layers fit the visible viewport. The main decision stays available while evidence improves; optional tools do not delay first interaction.

**Measurements:** Full regression suite and production build for each loop; desktop keyboard and pointer checks; phone widths 320/390/430px and landscape; normal, short and modeled keyboard viewports; changing top/bottom offsets; focus preservation, numeric Done, scrolling and rotation; no horizontal page overflow, occluded close controls or overlapping card art. Run browser checks against the built app and the final Pages deployment. Record timings as observations, not device-independent guarantees.

**Execution:** Complete locally for build 17. Geometry checks reproduced Done overlapping the value dock at 350px visible height, and the final screen-frame check reproduced a seller scroll jump caused by legacy input padding. A stricter one-screen assertion also caught an absolutely positioned status element extending the outer page by 21px; the scroll body now owns its positioning. The command workspace owns its frame and measured dock clearance. Review fixes preserve exact linked-field destinations, retain a valid panel after format changes, include section assumptions in value information, and make team ranges and desktop hover previews interactive. A failed deferred pricing module preserves entry and values and offers session-preserving recovery. Playwright is locked in the project; both browser engines now gate Pages deployment through `npm run test:browser`.

### Final automated evidence

| Check | Result |
| --- | --- |
| Full application regression | 494 tests across 106 files passed |
| Root tooling regression | 6 Vitest tests and 42 Node tests passed |
| Data and release gates | Shared-module boundaries, unused code, data coverage, collation, price snapshots, ready examples, production build, deployment subpath and OCR bundle checks passed |
| Browser acceptance | All 46 width/job scenarios passed in Chromium and WebKit: desktop/mobile entry, nested information, retained context, team sorting/cards, clipboard sharing, linked assumptions, 350/190px visual viewports, landscape cutouts, quantity Done and failed-module recovery |
| Entry bundle | 535.36kB / 167.01kB gzip, inside the existing 560kB budget; OCR and seller pricing remain deferred |
| Observed selection-to-quantity | Chromium 245–284ms; WebKit 129–161ms on this machine. Includes automation overhead and is not an iPhone performance guarantee |
| Visual review | Phone information layer and decision views, plus desktop command layouts reviewed from the built artifact |

Local logs are `.preview-release17-check.log`, `.preview-release17-build.log` and `.preview-release17-browser.log`; screenshots are in `.browser-evidence/chromium` and `.browser-evidence/webkit`. CI repeats these gates against freshly generated prices and retains screenshots for 14 days. Public deployment and byte verification are recorded by the Pages workflow; the release runbook requires the same changed-flow checks against the published site.

Physical iOS Chrome verification requires an actual device session and is reported separately from responsive Chromium/WebKit and deterministic geometry tests. The device procedure is in `docs/mobile-viewport-contract.md`.

## Final review

Frozen code candidate: `4fe49fa`; baseline: `12c2287`. Standards and Spec were reviewed independently under the code-review skill.

### Standards

No remaining actionable findings. Both earlier findings are resolved: dock navigation cancels stale input restoration, and value information includes primary section assumptions. The viewport fixes, nested information ownership, deferred-module recovery and browser deployment gate introduced no additional concrete regression found by this read-only review.

### Spec

No remaining concrete findings. All four earlier findings are resolved: exact anchor destinations, interactive team ranges, desktop hover previews and fallback when Teams disappears. The viewport, seller navigation and deferred-loading fixes are present. Physical iOS Chrome remains unverified and separately documented.

Standards: 0 remaining findings. Spec: 0 remaining findings. Automated execution evidence is recorded separately from these reviews.

## Platform basis

- [Chrome viewport behavior](https://developer.chrome.com/blog/viewport-resize-behavior): visual and layout viewports can resize differently when a keyboard opens; fixed controls need visible-viewport-aware positioning.
- [WebKit safe-area guidance](https://webkit.org/blog/7929/designing-websites-for-iphone-x/): use viewport-fit and safe-area inset values for edge-to-edge layouts.
- [Apple layout guidance](https://developer.apple.com/design/human-interface-guidelines/layout): preserve readable content and respect safe areas around display features such as Dynamic Island.

These sources establish design constraints. Desktop emulation is not proof of physical iOS Chrome behavior.
