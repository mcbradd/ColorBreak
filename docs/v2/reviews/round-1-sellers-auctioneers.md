# Round 1 antagonistic review — sellers and auctioneers

Date: 2026-08-13
Reviewed artifact: [ColorBreak V2 product specification — review draft 1](../PRODUCT-SPEC-v1.md)
Evidence base: [ColorBreak V2 primary research dossier](../../research/colorbreak-v2-primary-research-2026-08-13.md), current Whatnot primary documentation, and the repository's existing seller workflow
Perspectives kept deliberately separate: **ordinary/aspiring Magic break seller** and **popular high-volume Whatnot auctioneer/operator**

## Executive verdict

The draft correctly moves the seller's first answer from card inventory to viability and correctly treats rules, fees, fulfillment, and buyer trust as part of the product. It is not yet safe to call the answer **Run** or the result **net profit**. The two strongest-looking numbers—expected fill and profit—currently rest on inputs the product either does not possess or does not require.

The central failure is a false-precision loop:

1. ColorBreak does not have actual Magic break demand or clearing-price distributions.
2. The spec nevertheless places **expected fill** in the first result and proposes **Easiest to fill** as a scenario.
3. It then combines that unobserved demand with incomplete operating costs and labels the output **Run** and **expected net**.
4. A seller can therefore receive the most confident recommendation in the interface precisely where the evidence is weakest.

For an aspiring seller, this can turn a fragile plan into an apparently endorsed one. For a high-volume operator, the omission of show-level economics, reusable/batch workflows, staff handoff, and importable actuals means the product remains slower and less complete than the operator's spreadsheet.

The right correction is not more explanation. Narrow the promise: provide deterministic unit economics, required clearing prices, full-fill feasibility, and explicit stress cases first. Treat demand, fill, and conversion as user-supplied hypotheses until first-party history exists. Rename the economic result **modeled contribution profit** unless the seller includes labor, promotion, fee tax, refunds, shrinkage, and overhead.

## Severity and disposition summary

| ID | Severity | Finding | Ordinary/aspiring seller | High-volume operator | Disposition |
|---|---|---|---|---|---|
| S-C1 | Critical | Expected fill and “Easiest to fill” are unsupported | Can mistake a guess for market demand | Cannot use an uncalibrated forecast for inventory allocation | **Act** |
| S-C2 | Critical | Partial-fill display conflicts with the actual break operating constraint | May think a 70%-filled break can be opened profitably | Understates refunds, delays, rollover, and audience cost | **Act** |
| S-C3 | Critical | “Net profit” omits material costs and dynamic fees | Overstates whether the first show is profitable | Cannot reconcile to statements or show P&L | **Act** |
| S-C4 | Critical | Acquisition cost alone can recommend destroying inventory value | Cheaply acquired boxes look profitable even when selling sealed is better | Misallocates scarce or appreciating inventory | **Act** |
| S-C5 | Critical | Policy validation and launch checklist are incomplete while “blocks export” implies safety | A novice may rely on ColorBreak as approval | One policy incident can affect a large operation | **Act** |
| A-C1 | Critical | Local, one-break, manual workflow does not serve a multi-person high-volume operation | Not usually material | Creates duplicate entry and version drift during shows | **Act or narrow the target user** |
| S-M1 | Major | Auction starts, PYT asks, BIN prices, and realized hammers are conflated | “Suggested price” can sound guaranteed | Prevents format-specific planning | **Act** |
| S-M2 | Major | Launch assets have no exact platform transfer contract | Still requires reformatting and retyping | Does not save enough operator time | **Act** |
| S-M3 | Major | Automated scenario generation is premature complexity | Encourages optimization theater | Adds opaque outputs without demand data | **Defer** |
| S-M4 | Major | Seller-link provenance is weaker than its trust language | Buyers may assume seller identity or verification | Shared copies can silently diverge | **Act** |
| A-M1 | Major | Actuals and reconciliation do not scale | Manual entry is tolerable for eight spots | Manual entry across dozens of spots will be abandoned | **Act** |
| A-M2 | Major | The spec models one break, not the economics of a show | Acceptable for a first attempt | Omits shared labor, promotion, audience, and bundling context | **Act in operator mode; defer forecasting** |
| S-M5 | Major | Setup blocks too early and does not distinguish rough feasibility from launch-ready truth | Novices may abandon before learning whether the idea is plausible | Slows repeated planning | **Act** |
| S-m1 | Minor | Fixed 100/90/80/70 fill rows imply universal breakpoints | Arbitrary thresholds look authoritative | Operators need editable thresholds | **Act** |
| S-m2 | Minor | “Weakest slot” is treated as a demand proxy | Low EV is not necessarily low demand | Audience-specific demand can reverse the ranking | **Act** |
| S-m3 | Minor | 9:16 is specified, but crop safety, text limits, editability, and art rights are not | Export can be unusable | Branding and batch generation are missing | **Act** |

## Perspective 1: ordinary or aspiring Magic break seller

This seller is capital-constrained, may be planning a first or occasional show, and probably does not know their own clearing-price distribution. Their biggest risks are confusing modeled card value with attainable revenue, forgetting real operating costs, choosing a break that will not fill, and accidentally violating a platform rule.

### S-C1 — Critical: the spec invents a demand forecast it explicitly says it does not have

**Attack.** [Section 6.1](../PRODUCT-SPEC-v1.md#61-guided-setup-and-first-result) requires **expected fill** in the first result. [Section 6.4](../PRODUCT-SPEC-v1.md#64-pricing-plan-and-transparent-scenarios) offers **Easiest to fill**, only parenthetically labeled a heuristic. Yet the research dossier identifies real spot closing-price distributions, seller margins, and even the prevalence of random versus pick-your-color Magic breaks as unresolved participant/data research. Card EV does not identify audience demand, seller reputation, concurrent viewers, stream timing, bidding format, or the willingness to pay for entertainment.

**Concrete failure.** A new seller owns one Foundations box. ColorBreak finds that the blue pool has high modeled value and allocates a high ask to it. It labels the plan Run at “expected fill.” The seller has twelve viewers, none of whom collect blue, and four colors do not sell. The recommendation was not conservative; it was a demand forecast with no demand model.

**Evidence.** Whatnot's own promotion reporting distinguishes impressions, joins, sustained watchers, followers, first-time buyers, and promotion-attributed sales. Those variables make clear that reach and conversion are distinct from product value ([Promote Tools](https://help.whatnot.com/hc/en-us/articles/34443991672589-Promote-Tools)). Whatnot Seller Analytics separately reports sales, orders, buyers, viewers, and streamed time; these are observed operational metrics, not derivable from a card-price model ([Seller Analytics](https://help.whatnot.com/hc/en-us/articles/12231027226637-Track-performance-with-Seller-Analytics)).

**Recommendation — ACT.** Remove expected fill from the default result until it is one of:

- a seller-entered planning assumption, visibly labeled **Your fill assumption**;
- a deterministic threshold, labeled **Must sell 8 of 8 spots at these prices**; or
- a forecast calibrated from that seller's imported history, with sample size, date range, and error shown.

Rename “Easiest to fill” to a falsifiable structural description such as **Lowest required average price** until demand evidence exists. Never allow an unsupported fill heuristic to produce Run.

### S-C2 — Critical: partial-fill profit is not an executable break outcome

**Attack.** The 100/90/80/70% table is useful as a funding stress test, but the current wording makes partial fill look like a state in which the seller can proceed and realize the displayed profit. Whatnot says the product is opened once every card or pack is accounted for, and its integrated Break Manager exposes **Start Breaking** after the break fills. If spots do not sell, buyers may request refunds; the seller may continue selling only while the product remains sealed. All product for a break must then be opened in one show ([Card Breaks Policy, lines 18 and 34–35](https://help.whatnot.com/hc/en-us/articles/34107485220237-Card-Breaks-Policy); [Breaks feature, Start Breaking](https://help.whatnot.com/hc/en-us/articles/26596362677389-Breaks-feature-for-sellers)).

**Concrete failure.** The app shows a small positive number at 80% fill. The seller interprets this as permission to open with one color unsold and retain that color. That is not the disclosed plan buyers purchased, and the seller or their household cannot simply buy the remaining position; Whatnot prohibits related participants.

**Recommendation — ACT.** Rename the section **Fill-delay and cancellation stress**. Show:

- full fill at planned prices;
- the maximum unsold count before the funding target fails, explicitly assuming the product remains sealed;
- cash tied up, elapsed shipping deadline risk, refund exposure, and next action at each shortfall;
- an explicit **Do not open until all positions are accounted for** gate; and
- no scenario in which the seller, employee, or household absorbs an unsold slot.

Keep editable 90/80/70 examples as secondary sensitivity rows, not business outcomes.

### S-C3 — Critical: “expected net profit” is not net profit

**Attack.** The draft includes commission, processing, product, supplies, seller-funded shipping, and promotion, but it does not require labor, fee taxes, refund/cancellation allowance, damage/shrinkage, card sorting, minimum-card fulfillment, or overhead. It also describes one preset while current fees vary by country, category, promotion, sales tier, and applicable taxes on Whatnot fees. In the U.S., Whatnot currently states 8% commission up to $1,500 and 2.9% of total order value plus $0.30 per transaction, **plus applicable taxes on fees**; processing can vary with buyer shipping and tax ([Whatnot seller fees](https://help.whatnot.com/hc/en-us/articles/4847069165965-Whatnot-seller-fees)). Whatnot also runs changing commission programs, so a dated flat preset is not sufficient for every seller ([Fees and commissions](https://help.whatnot.com/hc/en-us/sections/44398189207565-Fees-commissions)).

**Concrete failure.** A seller sees $34 “net profit.” They spend three hours sorting, sleeve/topload key cards, mail eight minimum cards to whiffed purchasers, pay $12 promotion, and are charged local tax on processing fees. The break was negative even before valuing labor.

**Recommendation — ACT.** Default the label to **modeled contribution profit**. Reserve **net profit** for a complete cost profile. Require or explicitly zero-and-warn:

- seller location and current fee-preset version/date;
- fee tax treatment;
- promotion and giveaway shipping;
- consumables and minimum-card fulfillment;
- estimated labor minutes and hourly value;
- refunds/cancellations/damage allowance; and
- other fixed show overhead.

Show a reconciliation equation and an **Unmodeled costs** row beside the result. Add a fee-preset expiry gate because the source is volatile.

### S-C4 — Critical: actual acquisition cost is not always the correct run/no-run cost

**Attack.** The spec lets actual acquisition cost replace a market reference. That answers cash margin, but not whether opening the inventory is economically rational. A seller who bought a box for $80 that can now be sold sealed for $200 should not receive Run merely because spot revenue exceeds $80. The relevant decision cost includes the foregone net proceeds from the best realistic alternative.

**Concrete failure.** A limited-release box bought at preorder pricing has appreciated. The break projects $160 after fees against an $80 receipt, so ColorBreak reports $80 contribution. Selling sealed would net $180. Running the break destroys roughly $20 of economic value plus labor.

**Recommendation — ACT.** Show two cost bases simultaneously:

- **Cash basis:** what the seller paid, for cash recovery and accounting context.
- **Decision basis:** seller-entered replacement cost or estimated net sealed-sale alternative, for the run/no-run recommendation.

If no decision basis is supplied, say **Cash margin only** and suppress categorical Run. Do not silently substitute a retail sealed market observation for attainable seller proceeds.

### S-C5 — Critical: “policy validation blocks export” promises more safety than the rule model covers

**Attack.** The launch pack mentions routing, bulk, shipping, promos, and prohibited mechanics, but current Whatnot break policy also requires continuous on-camera visibility, a minimum card per purchase, full accounting before opening, same-show opening, no off-platform pre-sales, no related participants, and rules in Show Notes or listings. These are operational gates, not all inferable from generated copy ([Card Breaks Policy](https://help.whatnot.com/hc/en-us/articles/34107485220237-Card-Breaks-Policy)). Whatnot says sellers unsure about a format should not proceed. A static validator cannot approve novel mechanics.

**Concrete failure.** The app exports clean rules for a break whose mechanics are textually permitted, but the seller plans one phone camera that leaves the product offscreen while sorting. The badge says “policy-checked,” so the novice believes the break has been approved.

**Recommendation — ACT.** Replace “policy-checked” with **checked against ColorBreak ruleset dated YYYY-MM-DD**. Split validation into:

1. deterministic copy/mechanic blockers;
2. required seller attestations for visibility, custody, minimum-card fulfillment, inventory, related-party exclusion, and same-show opening; and
3. **Needs Whatnot review** for unknown or written-exception formats.

Export must include source date and unresolved items. Never use an approval-looking badge or “compliant” without qualification.

### S-M1 — Major: one “pricing plan” conflates four different sales mechanics

**Attack.** Pick-your-color Buy It Now ask, PYT auction start, random-spot auction start, and expected hammer are not interchangeable. A start is a floor, not a forecast. Whatnot supports PYT as auction or BIN and random breaks as auction only; PYT also supports offers ([Breaks feature](https://help.whatnot.com/hc/en-us/articles/26596362677389-Breaks-feature-for-sellers)). The spec says “starting prices,” “planned asks,” and “actual results,” but never makes sale format the first branch of the pricing model.

**Concrete failure.** A required average hammer of $24 becomes a suggested $24 auction start. The first slots do not run, the seller drops starts to $1, and later hammers cannot recover the fixed target. Conversely, a $24 BIN ask can remain stocked while an auction cannot.

**Recommendation — ACT.** Branch before pricing:

- **PYT BIN/offer:** posted ask, minimum acceptable offer, and full-fill required revenue;
- **PYT auction:** minimum start, required average hammer, and no fill forecast without history;
- **random auction:** required average hammer across remaining spots, live pace, and cumulative revenue target.

Never label required hammer as expected hammer.

### S-M5 — Major: the spec blocks novices before giving them a useful rough answer

**Attack.** Exact rules must block launch and buyer claims, but they need not block a rough feasibility screen. The four-step setup demands product, every routing rule, selling plan, fulfillment, transactions, shipments, fees, and costs before the result. A novice may not yet know the right spot map; learning whether eight-color or five-color is plausible is part of the job.

**Recommendation — ACT.** Create two evidence stages:

- **Feasibility sketch:** product, decision cost, region, and one explicit format template. Output only required full-fill revenue, card-value balance, and unresolved questions; never Run.
- **Launch-ready plan:** exact routing, every-buyer-card fulfillment, sales mechanic, prices, costs, and operational attestations. Only this stage can produce a viability recommendation or exports.

This preserves truth without turning uncertainty into a dead end.

### S-M3 — Major: the scenario optimizer does not yet earn its complexity

**Attack.** “Highest margin,” “Easiest to fill,” “Most balanced,” and “More chase visibility” sound like comparable optimized outcomes. Only the deterministic economics and value-balance parts are modeled. Fill and promotional effectiveness are not. A Pareto frontier over mislabeled objectives launders assumptions through mathematics.

**Recommendation — DEFER.** Ship explicit side-by-side what-if controls first: product mix, slot map, assignment mode, ask/start schedule, shipping support, and fixed disclosed contents. Show exact deltas. Defer automatic scenario generation until sellers can correctly explain the tradeoff and at least one demand objective is calibrated from real observations. Dismiss **More chase visibility** as an optimizer objective; use it as a launch-asset view whose probabilities and denominators are unchanged.

### S-M2 and S-m3 — Major/Minor: “launch pack” is a list of artifacts, not a transfer workflow

**Attack.** A useful export must land in the platform with minimal rework. Whatnot's Break Manager is computer-only, accepts a pasted custom spreadsheet with spot names, prices, and descriptions, and supports up to 75 custom spots. Operators may use a phone for video but still need a computer beside them ([Breaks feature, lines 29–44](https://help.whatnot.com/hc/en-us/articles/26596362677389-Breaks-feature-for-sellers)). Whatnot recommends a 1080 × 1920 vertical thumbnail, accurate category/tags, stocked listings, show sharing, and Show Notes ([Schedule a show](https://help.whatnot.com/hc/en-us/articles/9778927885581-Schedule-edit-and-start-a-show)). The spec says “Whatnot-ready” but defines no columns, validation, copy action, crop-safe zone, text limits, editability, or art-rights rule.

**Recommendation — ACT.** Define acceptance contracts for:

- tab-separated spot name, price, and description paste with a preview matching Break Manager order;
- separate Show Notes and internal Seller Notes;
- title/category/tag suggestions that the seller confirms;
- editable 1080 × 1920 asset with safe zones, legibility-at-thumbnail-size test, probability denominators, price/evidence timestamp, and source/rights metadata;
- one-click Copy and downloaded PNG/TXT/TSV package; and
- a final consistency diff proving every artifact uses the same rules and spot map.

Do not claim these assets increase joins or bids until tested.

### S-M4 — Major: a share link does not establish seller provenance

**Attack.** A static, accountless URL can carry assumptions but cannot establish who authored it. “Assumptions supplied by seller” is stronger than the evidence unless the buyer followed the link directly from a trusted seller context. Local edits then create a second plan that may look identical.

**Recommendation — ACT.** Label links **Unverified shared plan** by default. Preserve the original payload, show **Edited on this device** after any buyer change, and offer a diff/reset. If the URL has integrity protection, call it tamper-evident, not identity-verified. Dismiss seller certification or reputation signals without authenticated platform data.

## Perspective 2: popular high-volume Whatnot auctioneer/operator

This operator may run several breaks per show, work with hosts/moderators/sorters, already uses templates or spreadsheets, and values throughput, repeatability, audience retention, and reconciliation more than a guided explanation. The spec currently describes a sophisticated solo calculator, not an operating system for a live team.

### A-C1 — Critical: the workflow is structurally incompatible with a multi-person operation

**Attack.** V2 retains static deployment, local persistence, and manual actuals. There is no batch plan, clone/version workflow, role handoff, shared run state, or conflict model. Yet Whatnot's Break Manager itself is computer-only and may be operated beside a separate streaming phone. Popular sellers can create multiple breaks in one show and use host, co-host, or moderator roles. A local-only plan on one browser cannot be the live source of truth for the person on camera, the computer operator, and fulfillment staff.

**Concrete failure.** An operator clones a break for the second half of a show, changes one product quantity, and messages the host a screenshot. The host reads old chase numbers while the computer operator pastes new spot descriptions. The generated buyer link reflects a third version. The promised “one truth engine” has become three untracked copies.

**Evidence.** Whatnot allows multiple breaks per show, manages them from a computer, and exports buyer/spot assignments with spot names on packing slips ([Breaks feature](https://help.whatnot.com/hc/en-us/articles/26596362677389-Breaks-feature-for-sellers)). Its show-management tools expose different views to hosts, co-hosts, and moderators ([Show management](https://help.whatnot.com/hc/en-us/articles/23951958152461-Show-management-for-sellers)).

**Recommendation — ACT OR NARROW THE TARGET.** For a static V2, the minimum credible operator mode is:

- cloneable named templates and batches;
- immutable plan versions with a short revision ID on every export;
- full JSON/TSV import/export for handoff and backup;
- a read-only run sheet optimized for the on-camera host;
- a dense keyboard/desktop editor for the operator;
- a consistency check across show notes, spot list, graphic, and buyer link; and
- explicit conflict behavior when an imported version is edited.

If these cannot ship, remove high-volume auctioneers from the V2 success claim and validate Seller Studio only with solo/occasional sellers.

### A-M2 — Major: per-break profit is not show economics

**Attack.** A high-volume operator buys promotion by show, pays labor by shift, shares camera/stream setup across breaks, bundles fulfillment across purchases, and may mix breaks with other inventory. Whatnot's promotion spend is time-based or bid-based and reports show-attributed outcomes. Seller Analytics reports show sales, orders, buyers, viewers, AOV, and streamed time ([Promote Tools](https://help.whatnot.com/hc/en-us/articles/34443991672589-Promote-Tools); [Seller Analytics](https://help.whatnot.com/hc/en-us/articles/12231027226637-Track-performance-with-Seller-Analytics)). Allocating all or none of those costs to one break makes its “net” arbitrary.

**Concrete failure.** Three breaks share a $90 promotion and a four-hour host/sorter shift. ColorBreak marks each Run when promotion and labor are zero at break level. The combined show loses money.

**Recommendation — ACT IN OPERATOR MODE.** Add a **show plan** containing multiple breaks, shared promotion/labor/overhead, allocation method, and aggregate cash/economic contribution. Preserve per-break contribution. Do not attempt to forecast viewers or conversion; import or manually enter observed show metrics after the fact.

### A-M1 — Major: manual actuals guarantee abandonment at volume

**Attack.** “Manual actual hammer and shipment grouping” may work for eight color spots once. It does not work for repeated random auctions, up to 75 custom spots, offers, cancellations, refunds, and promotion adjustments. The high-volume operator already has platform exports and order receipts. Re-keying produces errors and delays.

**Recommendation — ACT.** Support paste-grid/CSV ingestion from user-downloaded Whatnot data, with a mapping preview rather than claiming API integration. Preserve raw imported rows, flag duplicates/unmatched spots, separate orders from shipments, and reconcile modeled fees against receipts. Manual entry remains the fallback. Defer direct platform integration until an authorized API exists.

### A-C2 — Critical: the fee engine needs profiles, effective dates, and reconciliation

**Attack.** High-volume sellers are precisely the users most likely to encounter category-specific thresholds, commission promotions, sales-tier programs, taxes on fees, international markets, coupons, and many small fixed processing charges. A single Whatnot U.S. preset is not a stable truth. Current Whatnot documentation marks some commission reductions as limited-time and directs sellers to receipts for actual fees ([Whatnot seller fees](https://help.whatnot.com/hc/en-us/articles/4847069165965-Whatnot-seller-fees)).

**Recommendation — ACT.** Fee profiles must include region, category, effective dates, tier/promotion override, tax-on-fee rule, currency, and source link. Plans pin the profile version. Reconciliation records actual fees without rewriting the historical plan. An expired preset produces Caution and asks for confirmation; it does not silently continue.

### A-M3 — Major: there is no run-of-show control surface

**Attack.** Launch assets stop at preparation, while the operator's real failure modes occur live: wrong spot pinned, wrong disclosure read, stale available-slot list, auction started before rules are visible, product temporarily off-camera, or a second break opened under the first break's notes. Whatnot provides real-time show and audience information, but ColorBreak need not duplicate that to provide value. It should keep its own modeled plan and compliance cues synchronized.

**Recommendation — ACT.** Add a read-only run sheet with:

- revision ID and exact product count;
- approved short verbal disclosure and full rules;
- next spot/listing label and required-price tracker;
- sold/remaining assignments imported or tapped in without changing the model;
- **Do not open** until accounted-for attestation;
- camera/custody and minimum-card checklist; and
- Finish Break / fulfillment handoff checklist.

Do not build a second live analytics dashboard; Whatnot already exposes sales, audience, and show-management data. Link the operator back to the platform rather than competing with it.

### A-M4 — Major: the success measures test comprehension, not business usefulness

**Attack.** The seller study checks whether users can identify net and break-even fill and explain fixed fees. A beautiful calculator can pass those tests while saving no time, changing no decision, and producing no usable listing. High-volume adoption depends on error reduction and throughput.

**Recommendation — ACT.** Add operator gates:

- clone and configure a known break in at most two minutes median;
- export/paste a complete spot list with zero manual edits;
- every artifact carries the same revision and passes a byte/field-level consistency check;
- reconcile 50 transactions with at least 98% automatic row matching after mapping;
- no policy-critical omission in a scripted host handoff;
- operator correctly identifies full-show and per-break contribution; and
- compare time and errors against the seller's existing spreadsheet, not against no tool.

## Feedback to act on, dismiss, and defer

### Act now in the next spec revision

1. Replace unsupported expected fill with required fill and explicitly user-authored fill assumptions.
2. Reframe partial fill as sealed-inventory delay/refund stress; add the no-open-until-accounted-for gate.
3. Rename default profit to modeled contribution profit and add complete-cost status.
4. Separate cash acquisition cost from decision/opportunity cost.
5. Split pricing by PYT BIN/offer, PYT auction, and random auction.
6. Version fee profiles and include taxes on fees, promotions/tiers, location, and expiry.
7. Expand policy gates and seller attestations; date the ruleset and avoid approval language.
8. Specify exact TSV/text/PNG export contracts and cross-artifact consistency.
9. Add immutable plan revisions, clone/batch/import/export, operator run sheet, and show-level cost allocation—or explicitly stop claiming high-volume operator support.
10. Add CSV/paste actuals with reconciliation while keeping direct integration out of scope.

### Dismiss

- **Dismiss categorical Run based on a value-derived fill heuristic.** It has no evidence base.
- **Dismiss “More chase visibility” as a business optimizer.** It is a presentation lens, not a proven sales objective.
- **Dismiss “policy-compliant” or approval-style labeling.** The tool can check known rules, not approve an operation.
- **Dismiss the claim that a 9:16 graphic will increase joins, retention, or bids.** The platform recommends the format, but conversion impact remains untested.
- **Dismiss seller identity/reputation implications from a static share link.** Provenance is not identity.

### Defer with an explicit trigger

- **Automatic fill or clearing-price forecasts:** defer until seller-specific or representative Magic break history can be imported and validated out of sample.
- **Pareto scenario generation:** defer until users understand deterministic what-if comparisons and each optimized objective has a measured definition.
- **Direct Whatnot API integration:** defer until a documented authorized interface exists; implement user-controlled paste/CSV now.
- **Automated promotion-budget recommendations:** defer until impression-to-sustained-viewer and sale-attribution history is available for the seller.
- **Seller reputation scoring:** defer indefinitely without authenticated platform data and a defensible appeal process.

## Required spec changes before round 2

Round 2 should reject the seller section unless the revision can answer all of these unambiguously:

1. Which seller inputs are observed facts, which are seller hypotheses, and which are model outputs?
2. Can any unsupported fill assumption cause Run? The only acceptable answer is no.
3. Does every partial-fill state say the product remains sealed and describe delay/refund exposure?
4. When does ColorBreak say contribution profit versus net profit?
5. Which cost basis controls the run/no-run decision, and why?
6. Which exact sales mechanic is being priced?
7. Which Whatnot fee profile and policy ruleset, with effective dates, governs the plan?
8. What exact fields can be pasted into Break Manager without retyping?
9. How does a host prove that show notes, graphic, spot list, buyer link, and run sheet are the same revision?
10. How can an operator plan and reconcile multiple breaks without entering every sale twice?
11. What does the launch validator actually prove, and what does it merely ask the seller to attest?
12. Which seller success gates measure saved time, prevented errors, and changed decisions against an existing workflow?

Until those questions are answered, Seller Studio is a promising economics explainer with generated collateral—not yet a dependable run/no-run system for a novice or a production tool for a popular auctioneer.
