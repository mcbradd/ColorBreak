# ColorBreak V2 product specification — review draft 1

Date: 2026-08-13
Status: Draft for antagonistic review
Evidence base: [ColorBreak V2 primary research](../research/colorbreak-v2-primary-research-2026-08-13.md)

## 1. Product definition

ColorBreak V2 is a mobile-first decision system for Magic: The Gathering color breaks. It contains two task-specific workspaces backed by one truth engine:

- **Bid Check** helps a buyer make a defensible bid decision during a five-to-fifteen-second live-auction window.
- **Seller Studio** helps a seller decide whether a break can profit, choose a viable format and price plan, present it truthfully, and run it consistently.

V2 is not a visual reskin of the existing calculator. It resets the information architecture around the decision each user must make. A primary result must be useful without opening a tooltip, interpreting a novel chart, or reading methodology. Evidence and detail remain available on demand.

### 1.1 Product promise

**Buyer:** Know your ceiling before auction pressure takes over.
**Seller:** Know whether the break works before listing it, then launch it with clear rules and buyer-visible value.

### 1.2 Success definition

V2 succeeds when:

1. A prepared buyer can identify the recommendation and maximum next bid in three seconds median and seven seconds p90 on the target iPhone.
2. A first-time buyer can configure a known break and reach a recommendation within 30 seconds median.
3. A seller can identify net profit and break-even fill without a spreadsheet, then generate usable, policy-safe launch assets.
4. Both workspaces expose the same composition, house rules, evidence state, prices, and simulations without contradictory numbers.
5. The public site is stable and legible on an iPhone 17 Pro Max in Safari, including dynamic browser chrome, the software keyboard, 200% text, and safe areas.

### 1.3 Non-goals

V2 does not guarantee profit, pulls, fill, sale prices, or buyer outcomes; automate bidding; claim affiliation with Whatnot; issue verdicts through material omissions; score sellers without reliable data; or treat market observations as cash realization. It does not optimize revenue through artificial urgency, near-miss effects, hidden assumptions, or outcome-contingent incentives. Chase Map and other exploratory views are never necessary for a core action.

## 2. Users and jobs

### 2.1 Live buyer

The live buyer may be switching between Whatnot and ColorBreak on one phone. They need to restore an exact break, choose a color or mark taken colors, enter current hammer and incremental shipping, see Bid/Conditional/Pass/No verdict, copy a ceiling into Max Bid, understand downside/typical/upside, and update the pool without losing input, scroll, or focus.

### 2.2 Prepared buyer

Before a show, the buyer validates seller-supplied composition and rules, chooses a risk stance and optional realization setting, compares slots, saves a ceiling, identifies concentration and missing facts, and returns to that decision instantly during the auction.

### 2.3 Break seller / operator

The seller needs to describe exactly what is opened and assigned, use actual acquisition cost or a labeled reference, decide Run/Reprice/Change mix/Do not run, understand revenue and partial-fill downside, price spots without hiding weak slots, compare transparent scenarios, generate consistent launch materials, and reconcile plan versus actual results.

### 2.4 Buyer-visible seller

The seller is also a trust subject. Clear rules, exact product identity, honest uncertainty, full-break visibility, accurate fulfillment promises, and consistent generated materials reduce buyer questions and disputes. V2 supports trust but does not certify the seller.

## 3. Experience architecture

### 3.1 Entry

The home screen offers two plain actions: **Check a bid — Get a recommendation and max bid** and **Plan a break — Price profitably and create your launch pack**. Recent local breaks follow these choices. No marketing hero delays entry.

### 3.2 Shared composition header

Both workspaces use one compact, editable header showing set/product, quantity, assignment format and spot count, evidence state, price age, and Change. It is not nested in another panel. A condensed sticky state must not cover dialog controls, focused inputs, or card names.

### 3.3 State and links

- Save recent compositions, buyer preferences, selected/taken colors, bid, shipping, seller costs, and unfinished plans locally.
- Color, mode, threshold, risk, and simulation changes never clear bid or shipping.
- Seller links include composition, routing rules, assignment, and fulfillment policy; they exclude acquisition cost and private targets.
- Buyers see “Assumptions supplied by seller,” can edit locally, and never see a verified badge based merely on sharing.
- Legacy links remain readable.

## 4. Shared truth engine

### 4.1 Required inputs

The engine requires exact sealed product lines; spot map; chosen or random assignment; routing for monocolor, multicolor, colorless, lands, double-faced cards, tokens/art cards, promos, toppers, and unresolved categories; what ships and bulk policy; finish-specific prices and time; omissions; seller transaction/shipment assumptions; and buyer shipping, tax treatment, realization, and risk stance.

### 4.2 Evidence confidence and outcome risk are separate

**Evidence confidence** says whether inputs are trustworthy: Ready, Caution, or Incomplete. **Outcome risk** describes variability even when evidence is complete. They never collapse into one meter. Incomplete material evidence suppresses recommendation; a complete model can still be highly volatile.

### 4.3 Data conduct

- Exact product/finish beats a similarly named proxy.
- Simulation preserves mutually exclusive variants, sheet weights, fixed contents, and no-duplicate rules.
- Material omissions identify the exact seller question and suppress outcome recommendations.
- Market Price is called modeled card market value; a realization percentage is visibly user-authored.
- Cache keys include every decision-changing input.
- The last valid result remains visible during refresh with time/state; loading never blanks the decision.

## 5. Bid Check

### 5.1 Prepare and Live

Prepare supports validation, preferences, comparisons, and a saved ceiling. Live removes secondary material and prioritizes bid, shipping, recommendation, ceiling, and auction updates. The two states share the same saved decision.

### 5.2 Input order

The standard sequence is: (1) break contents, (2) color choice or taken-color updates, (3) value options, (4) current bid and incremental shipping. Product changes may invalidate results but never typed costs. Material changes update the ceiling and reason without moving the viewport.

### 5.3 First viewport contract

At 440 × 956 CSS pixels the first viewport contains selected slot/pool; bid and shipping controls; recommendation; max next bid; all-in if won now; downside/typical/upside on one scale; one falsifiable reason; evidence state/age; and color/taken controls or a one-tap drawer. It excludes total-break EV, Break Balance, Chase Map, contributor tables, methodology, and promotion.

### 5.4 Recommendation vocabulary

- **Bid**: current all-in is at/below the selected ceiling.
- **Conditional**: defensible only for an explicit non-default preference such as Chase upside or user-authored personal value.
- **Pass**: current all-in exceeds ceiling.
- **No verdict**: material evidence prevents a defensible answer.

Green is not an emotional win treatment. State uses text, icon, contrast, and shape—not color alone.

### 5.5 Bid ceiling

The bid ceiling is the maximum hammer after incremental shipping and modeled tax are subtracted from a risk-adjusted value target. **Protect downside** anchors conservatively; **Balanced** uses a documented blend of typical outcome and expected value, never mean alone; **Chase upside** permits a higher ceiling only with an explicit warning that typical value may remain below cost.

The formula lives in a pure domain module with worked examples and invariant tests. The interface names the outcome anchor. A buyer can set a lower personal cap; ColorBreak never raises it silently.

### 5.6 Live controls and risk display

Numeric fields use large stable text and decimal keypad hints, never clearing or auto-selecting on recalculation. Mark taken is one tap with Undo. Selection preserves scroll and focused-field visibility. Cached changes acknowledge within 100 ms median; refinement stays off the main thread.

The primary risk display aligns P10 downside, median typical, P90 upside, and all-in cost on one dollar axis, with optional chance-to-clear. It adds a literal reason such as “Typical modeled value is $9 below your all-in cost.” Mean is secondary and labeled average.

### 5.7 Evidence action and exploration

Caution/No verdict names one next action: “Ask whether lands are their own spot,” “Confirm Play Booster Box, not Bundle,” or “Exact foil prices unavailable.” The full ledger is secondary.

Below the decision: distribution, ranked cards, concentration statement, exact printing inspector, all-color comparison, and methodology. Chase Map is optional here, synchronized to a ranked list. Markers and labels remain inside non-negative axes and never overlap; dense points cluster or use direct selection; a list/table alternative exists.

## 6. Seller Studio

### 6.1 Guided setup and first result

Setup saves continuously through Products, Break rules, Selling plan, and Result. Unknown material rules block the viability decision. The first result viewport contains Run/Reprice/Change mix/Do not run; one reason; expected net/margin; required gross revenue; break-even fill in spots and percent; expected fill; weakest-slot warning; and recommended next action. An assumption line names acquisition, fee market/date, transactions, shipments, fulfillment, shipping, and promotion.

### 6.2 Viability semantics

- **Run** meets target profit/fill without severe buyer-value or evidence warning.
- **Reprice** is structurally viable but current starts/asks miss the target or amplify weak-slot risk.
- **Change mix** finds a transparent composition/format alternative when current terms cannot meet the objective.
- **Do not run** remains negative or materially unresolved.

These are recommendations under assumptions, never fill predictions.

### 6.3 Profit and partial-fill model

Profit separates hammer, commission, processing percentage/base, fixed processing per transaction, acquisition, supplies, seller-funded shipping/promotion, transactions versus shipments, net, and margin. Buyer-paid shipping is not revenue. Preset/date stay visible; actual-cost overrides are explicit and reversible.

Partial-fill rows at 100/90/80/70% show profit/loss, sold spots, revenue, fees, operational feasibility, and unsold inventory risk. A slider may supplement but not replace them. No fill probability is invented without historical data.

### 6.4 Pricing plan and transparent scenarios

Pick-your-color suggestions reflect slot value and minimum viable starts while exposing weak slots. Random assignment uses one flat price and shows worst/typical/best assigned pools. Locked asks stay fixed; planned asks and actual results remain separate; totals reconcile to required revenue.

Return at most four non-dominated scenarios: Highest margin, Easiest to fill (labeled heuristic until data exists), Most balanced, More chase visibility. Each shows net, break-even fill, weakest-slot typical, buyer downside, concentration, compliance, and exact deltas. A scenario never hides lower buyer value behind higher seller margin.

Allowed levers include product mix/quantity, spot map, fixed disclosed contents, allocation, seller-funded shipping, and presentation. Prohibited suggestions include bounties, whiff insurance, wheels, purchase-triggered games, and undisclosed conditional bonuses.

### 6.5 Diagnostics, launch pack, actuals

Diagnostics answer which spots are hardest to sell/explain, whether one chase carries too much value, whether random pricing exposes extreme weakness, which cards communicate appeal, and whether mix changes improve balance/profit. Every chart has a conclusion and list/table alternative; no motion or perspective exaggerates likelihood.

The launch pack includes products/quantities, Whatnot-ready spot list, routing rules, bulk/shipping/promo disclosure, show notes, titles, 9:16 graphic, operational checklist, evidence time, and modeled-not-guaranteed language. Policy validation blocks export on prohibited mechanics or unresolved rules.

After the show, manual actual hammer and shipment grouping produce plan variance, real fees/costs, actual net, and missed assumptions. This does not imply Whatnot integration or market-wide fill probability.

## 7. Visual and interaction system

### 7.1 Design character and container rule

The visual language is precise, calm, fast, and editorial—not casino-like, gamer HUD, or dashboard maximalism. Hierarchy comes from typography, spacing, alignment, and restrained rules.

A bordered/filled container is permitted only for an interactive group, selected state, warning/error, modal/sheet, or materially distinct context such as the primary decision. Sections do not get boxes by default. Rollouts expand directly below headings. No panel inside a panel. Shadows belong to overlays. Corner radii are restrained functional tokens: small for controls, medium for the primary decision, zero for tables, section divisions, and charts.

### 7.2 Typography and numbers

- One highly legible sans family; tabular numerals prevent bid/result jitter.
- Recommendation and ceiling are tier one.
- Labels state the question answered, not internal model terms.
- No uppercase paragraphs or letter-spaced microcopy.
- Readable mobile body copy is at least 16 CSS px; support labels remain legible at zoom.

### 7.3 Motion and responsive behavior

No ambient animation, pulsing, drifting charts, confetti, near-miss, or urgency motion. Transitions preserve spatial continuity, remain under 200 ms, and disappear with reduced-motion preference. Results update in place.

Mobile portrait is primary. Desktop may use a stable two-column workspace. No horizontal page scroll at 320 CSS px or 200% text. A genuinely two-dimensional analytical table may scroll locally only with an alternative. Edge-to-edge surfaces honor safe-area insets; sticky controls account for Safari chrome and keyboard.

## 8. Accessibility

- WCAG 2.2 AA is the release floor.
- Primary touch targets are at least 44 × 44 CSS px/points where platform mapping permits.
- Focus follows the task, is visible, and is never obscured.
- Dialogs trap focus, close predictably, label title/description, and restore focus.
- Color never carries state alone.
- Charts have semantic summaries and list/table alternatives.
- Risk uses absolute frequencies and dollar outcomes, not only relative percentages.
- Live regions do not announce every simulation refinement.
- At 200% text, recommendation and actions remain usable without two-dimensional scrolling.
- VoiceOver labels state control, value/state, and consequence.

## 9. Performance and stability

Representative-mobile release gates:

- LCP ≤2.5 s, INP ≤200 ms, CLS ≤0.1 at mobile p75.
- Cached interaction acknowledgement ≤100 ms median.
- Cached composition to useful recommendation ≤2 s on target hardware.
- Simulation/evaluation stay off the main thread.
- No selection, taken-color, threshold, or mode change causes a viewport jump.
- No focus is hidden by app header, browser chrome, keyboard, or dialog edge.
- Offline/stale mode retains the last valid result with age and limitation.
- Physical iPhone 17 Pro Max coverage: portrait, landscape, expanded/collapsed Safari chrome, keyboard open, and home-screen mode where supported.

## 10. Measurement plan

### 10.1 Buyer study

Recruit active Whatnot Magic buyers across competitive, collector, and entertainment motives. Gates:

- ≥90% state the correct recommendation;
- ≥85% find max next bid without coaching;
- ≥80% distinguish downside, typical, and average;
- median prepared decision ≤3 s, p90 ≤7 s;
- median first setup ≤30 s;
- zero lost bid/shipping values or unexpected viewport jumps.

To detect automation overreliance, participants must identify the reason and one condition that changes the recommendation.

### 10.2 Seller study

Recruit active Magic break sellers, including high-volume livestream operators. Gates:

- ≥90% identify net and break-even fill;
- ≥80% explain fixed-fee impact across transaction counts;
- ≥80% describe the buyer/seller tradeoff of a chosen scenario;
- every launch pack passes policy checks and matches modeled rules;
- sellers produce a usable plan without external spreadsheet arithmetic.

### 10.3 Telemetry and privacy

Consented aggregate events may measure time to result, input latency, evidence expansion, ceiling copy, scenario comparison, launch generation, errors, and abandoned steps. Never record bid values, acquisition costs, or shared-link contents without explicit consent and policy disclosure.

## 11. Technical shape and test seams

V2 keeps static React/Vite deployment but deepens domain modules. Public seams:

1. **Truth engine**: composition + rules + evidence + preferences → immutable analysis.
2. **Buyer decision**: analysis + assignment + costs + risk stance → recommendation, ceiling, outcomes, reason.
3. **Seller viability**: analysis + cost/fee/selling plan → viability, profit, fill table, actions.
4. **Scenario**: viable input space + objective → small non-dominated set with explicit deltas.
5. **Launch pack**: validated seller plan → policy-checked text and graphics model.
6. **Workspace**: user interaction → preserved state and first-viewport task outcome.

Tests observe interfaces, not private helpers. Browser gates cover both happy paths, persistence, zero viewport jump, dialogs, reflow, and public assets.

## 12. Release slices

### Release A — Decision foundation

V2 shell/tokens; compact composition header; Buyer decision module and first-viewport Bid Check; preserved inputs and stable updates; risk/evidence separation; responsive/accessibility/performance harness.

### Release B — Seller viability

Guided seller setup; viability cockpit; profit/partial-fill; pricing plan; transparent scenario comparison.

### Release C — Trust and launch

House-rule completeness; show notes, spot list, titles, policy validation; portrait graphic; seller-to-buyer assumptions; planned-versus-actual.

### Release D — Evidence and exploration

Ranked card evidence; optional collision-safe Chase Map and accessible alternative; advanced distributions/all-color comparison; study-driven refinement.

## 13. Definition of V2 testable

The public link on iPhone 17 Pro Max must support:

- **Buyer:** load, choose/disable colors, enter bid/shipping, receive recommendation and ceiling in the first viewport, change settings without losing input/position, inspect evidence, return.
- **Seller:** configure products/rules/costs, receive viability/profit/break-even fill, compare at least two transparent scenarios, generate policy-checked notes and a portrait graphic.
- **Shared:** seller link and buyer analysis agree; incomplete evidence suppresses recommendation; no negative-axis or overlapping chart is required for core tasks.
- **Quality:** automated gates pass and physical-device behavior has no critical blocker.

## 14. Review questions

Antagonistic reviewers must challenge with concrete failure scenarios:

1. Is a bid ceiling defensible or false authority?
2. Are four recommendation states understandable in three seconds?
3. Which assumptions make break-even fill misleading?
4. Can scenarios launder weak buyer value or manipulation?
5. Which house rules are missing?
6. Does hierarchy still require explanations?
7. Which collector/player utilities belong now versus later?
8. Can metrics survive stale prices, thin markets, and incomplete collation?
9. Are Safari/device gates sufficient?
10. Which scope items should be removed?
