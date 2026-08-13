# ColorBreak V2 primary research dossier

Date: 2026-08-13
Status: evidence base for the V2 product specification
Scope: Whatnot Magic: The Gathering color breaks; seller profitability and auction presentation; buyer decisions under a sub-10-second clock; risk communication; mobile web usability; accessibility; and implementation validation.

## Executive conclusion

ColorBreak V2 should not be a denser version of the existing calculator. It should be two task-specific products sharing one evidence and simulation engine:

1. **Seller Studio** answers, before a show, “Can this break profit, what must each spot earn, how fragile is the plan, and how can I present it truthfully and compellingly?” Its primary outputs should be required revenue, break-even fill, suggested starting prices, expected net profit, downside scenarios, compliant show notes, and buyer-facing graphics.
2. **Bid Check** answers, during a live show, “At the current all-in price, should I bid, and what is my ceiling?” Its first viewport should contain a recommendation, maximum additional bid, all-in cost, and a compact downside/typical/upside summary. Explanation, card-level evidence, and modeling assumptions remain available but are not prerequisites for acting.

This split follows the actual platform context. Whatnot sellers set an auction's starting bid and timer, may enable a hard “Sudden Death” ending, and otherwise choose a counter-bid time that resets when bids arrive with fewer than ten seconds remaining. Buyers' winning bids are binding and automatically charged; shipping and taxes are additional to the hammer price. ([Whatnot: start an auction](https://help.whatnot.com/hc/en-us/articles/9779931101837-Start-an-auction-during-your-show), [Whatnot: bid during a show](https://help.whatnot.com/hc/en-us/articles/14932924544141-Bid-on-an-item-during-a-show))

The research does **not** justify claims that any visualization or recommendation will universally improve bidding. Original auction experiments point in different directions depending on auction mechanism and social competition: one field experiment found high time pressure reduced participation and bids for uncertain payoffs, while controlled ascending-auction experiments found time pressure increased arousal and bids when people competed against people. ([El Haji et al., 2019](https://doi.org/10.1016/j.socec.2018.12.001), [Adam et al., 2015](https://doi.org/10.1016/j.jretai.2015.01.003)) The product implication is narrower and testable: minimize computation and interpretation during the live moment, make the buyer's self-chosen ceiling salient before competitive arousal takes over, and measure comprehension and decision time with actual users.

## Research method and evidence rules

This dossier prioritizes sources that own the fact:

- Whatnot Help Center pages for current platform mechanics, fees, seller tooling, and policies.
- Wizards of the Coast publications for sealed-product contents and collation disclosures.
- Apple, W3C, WebKit, and Google documentation for device, browser, accessibility, and web-performance requirements.
- Original peer-reviewed experiments for risk, time pressure, auctions, and graphical perception.
- TCGplayer's own documentation for what its price fields mean.
- Competitors' own product pages only for claims about what those products advertise, never as proof that their outcomes are achieved.

Product recommendations derived from these sources are explicitly labeled as **implications** or **hypotheses**. They must still be tested with active Magic buyers and sellers. The U.S. Web Design System likewise instructs teams to start with real user needs, test assumptions with real people, use prototypes, and test on actual mobile devices; authoritative design guidance is a starting constraint, not a substitute for product research. ([USWDS design principles](https://designsystem.digital.gov/design-principles/))

## 1. The platform ColorBreak actually supports

### 1.1 Auction mechanics create two distinct time horizons

Whatnot supports standard timed auctions and optional Sudden Death. In a standard auction, bids received with fewer than ten seconds remaining reset the clock to the seller's configured counter-bid time; Sudden Death ends at 00:01 without extension. Sellers choose the starting bid and auction time. ([Whatnot: start an auction](https://help.whatnot.com/hc/en-us/articles/9779931101837-Start-an-auction-during-your-show))

Whatnot's own seller playbook for sports cards—an adjacent card category rather than Magic-specific behavioral evidence—recommends auction timers no longer than 15 seconds and either a five-second counter-bid or Sudden Death. ([Whatnot Sports Cards Seller Playbook](https://www.sellersummit.whatnot.com/seller-playbook-sports)) This confirms that five-to-fifteen-second selling is a platform-supported operating pattern, though the optimal timer for Magic breaks remains an empirical question.

Buyers can swipe the next increment or enter a custom amount. With Max Bid enabled, Whatnot bids incrementally up to the user's ceiling; pre-bids work the same way before a show and remain active even if the buyer is absent. Whatnot explicitly warns that short auctions move fast and recommends Max Bid as a way to avoid repeated swipes. ([Whatnot: bid during a show](https://help.whatnot.com/hc/en-us/articles/14932924544141-Bid-on-an-item-during-a-show), [Whatnot: pre-bid](https://help.whatnot.com/hc/en-us/articles/14933026908301-Pre-bid-on-an-item-before-a-show))

**Implication:** Bid Check should support two states. “Prepare” calculates and stores a max bid before the auction; “Live” updates the decision from current hammer and incremental shipping without requiring the buyer to reconstruct the break. A live recommendation should never move merely because the auction price is moving; the value model changes only when product, rules, remaining slots, prices, or buyer preferences change.

### 1.2 Card-break rules are part of the economic model, not supplementary prose

Whatnot defines a card break as sealed product whose cards are distributed among multiple buyers under defined criteria. The seller must keep the full break—including product, tools, hands, opened packs, and cards—visible from sale through completion. Break rules must appear in show notes or item listings, including the definition and distribution of base or bulk cards. Every purchase must receive at least one card, even if the selected team or slot does not appear. Breaks cannot span shows, and positions cannot be sold off-platform. ([Whatnot Card Breaks Policy](https://help.whatnot.com/hc/en-us/articles/34107485220237-Card-Breaks-Policy))

The integrated Breaks feature supports Pick Your Team as auction or Buy It Now, and random breaks as auctions. It provides assignment tracking and built-in randomization; custom spot lists may contain up to 75 spots and may be pasted from a spreadsheet. ([Whatnot Breaks feature](https://help.whatnot.com/hc/en-us/articles/26596362677389-Breaks-feature-for-sellers))

**Implication:** product composition, spot map, assignment mode, color-routing rules, bulk policy, promotions, and shipping policy are first-class inputs. The app must not show a confident verdict if a material rule is unknown. It should generate a concise, policy-compatible rule card from the same inputs used by the calculation so the sales promise and model cannot silently diverge.

### 1.3 Enticement has binding safety boundaries

Whatnot prohibits prizes inside a break, paid bounties, guarantees or bonuses tied to outcomes or assignments, randomized purchase-based prizes, “golden tickets,” and games in which a purchase activates entry into another game of chance. Follower giveaways or other no-purchase-required giveaways are allowed as separate mechanisms. Mechanical and wheel-based break randomization is also prohibited. ([Whatnot Card Breaks Policy](https://help.whatnot.com/hc/en-us/articles/34107485220237-Card-Breaks-Policy), [Whatnot Gambling and Purchase-Based Prize Policy](https://help.whatnot.com/hc/en-us/articles/4410443596813-Gambling-and-Purchase-Based-Prize-Policy))

**Implication:** Seller Studio may optimize presentation, format, product mix, shipping support, fixed disclosed contents, starting prices, and scheduling. It must not recommend outcome-triggered “whiff protection,” paid chase bounties, wheels, or any promotion whose reward depends on the pull. Compliance warnings must block export of prohibited show copy, not merely appear as dismissible fine print.

### 1.4 Seller profit is more complex than hammer minus product cost

For U.S. TCG sales, Whatnot currently publishes an 8% commission on final sale price up to $1,500 and a 2.9% payment-processing fee on total order value plus $0.30 per transaction. Total order value generally includes hammer, buyer-paid shipping, and buyer tax. Fees are calculated separately for each transaction even when purchases are later bundled into a shipment. Seller-paid shipping is deducted from earnings. ([Whatnot seller fees](https://help.whatnot.com/hc/en-us/articles/4847069165965-Whatnot-seller-fees))

**Implication:** Seller Studio must distinguish transaction count from shipment count and show fee provenance. It should calculate:

- gross spot revenue;
- commission;
- percentage and fixed processing fees by transaction;
- product acquisition and supplies;
- seller-funded shipping and promotion;
- break-even spots and revenue;
- net profit and margin at multiple fill levels.

A single “margin” number hides the fixed-fee penalty from many small auctions and should not be the only result.

### 1.5 Seller success includes trust, discovery, and operations

Whatnot recommends scheduling early, using an accurate category and tags, adding a vertical 9:16 thumbnail or preview, stocking listings so buyers can browse and pre-bid, sharing the show link, and adding Show Notes. ([Whatnot: schedule a show](https://help.whatnot.com/hc/en-us/articles/9778927885581-Schedule-edit-and-start-a-show))

Promote Tools report purchased impressions, taps into a show, viewers retained for more than 30 seconds, followers, first-time buyers, and return on promotion spend. Whatnot says show placement depends on bid competitiveness, buyer interests, and other factors. ([Whatnot Promote Tools](https://help.whatnot.com/hc/en-us/articles/34443991672589-Promote-Tools)) Live Analytics, in a limited web test, updates sales, audience, reach, and engagement during a show; Seller Analytics reports sales, orders, buyers, viewers, stream time, estimated earnings, refunds, and cancellations. ([Whatnot Live Analytics](https://help.whatnot.com/hc/en-us/articles/47552166935181-Understand-your-show-s-performance-while-you-re-live), [Whatnot Seller Analytics](https://help.whatnot.com/hc/en-us/articles/12231027226637-Track-performance-with-Seller-Analytics))

Seller performance also affects trust and platform standing. Whatnot tracks On-Time Scan Rate and Defect-Free Order Rate; its current guidance requires most sellers to obtain a carrier scan within two business days and warns of account penalties for sustained materially low rates. Accurate descriptions, clear presentation, secure packing, and inventory on hand are explicit recommendations. Ratings are visible to buyers and may affect access to platform features. ([Whatnot Account Health](https://help.whatnot.com/hc/en-us/articles/34468945178381-Account-Health-Dashboard), [Whatnot seller performance](https://help.whatnot.com/hc/en-us/articles/41945906342029-Improve-Your-Seller-Performance-Metrics), [Whatnot ratings](https://help.whatnot.com/hc/en-us/articles/26543966203405-Ratings-and-reviews-for-sellers))

**Implication:** “Maximally useful” seller support extends beyond EV. V2 should prepare a launch pack: compliant rules, concise auction titles, spot labels, a portrait share card, a pre-show profit/fill plan, and a run-of-show checklist. A later analytics loop can compare planned versus actual spot revenue and promotion return, but it must not imply access to Whatnot data the user has not supplied.

## 2. Seller Studio: evidence-backed product requirements

### 2.1 The seller's primary job is a viability decision

The first useful seller result is not a card grid. It is a direct answer: **run this break, reprice it, change the product mix, or do not run it**. This is a product inference from the fee structure and auction workflow above, and is supported as a market need by competitor positioning: Break Buddy advertises break-even fill, real profit after fees and shipping, fill scenarios, suggested listing price, and saved break plans. This is evidence that such a feature set exists, not independent evidence of its effectiveness. ([Break Buddy product page](https://breakbuddy.co/))

Recommended result hierarchy:

1. decision label and short reason;
2. net profit at expected sell-through;
3. minimum total revenue and spots needed to break even;
4. recommended opening price or per-spot targets;
5. downside table at 100%, 90%, 80%, and 70% fill;
6. buyer-value distribution and imbalance warnings;
7. compliance and disclosure checklist;
8. card-level and model evidence.

The decision must state assumptions beside the result: fee market/date, product cost, spot count, assignment mode, shipping, and whether bulk ships. A stale or incomplete input should downgrade the result rather than be hidden in a tooltip.

### 2.2 Seller suggestions should optimize a constrained objective, not “hype”

A seller can improve a break through several independent levers: product quantity and type, slot map, starting prices, assignment format, seller-funded shipping, what ships, fixed upfront contents, show timing, listing completeness, and promotion budget. Platform policy removes outcome-contingent prizes from the valid search space. ([Whatnot Card Breaks Policy](https://help.whatnot.com/hc/en-us/articles/34107485220237-Card-Breaks-Policy), [Whatnot Promote Tools](https://help.whatnot.com/hc/en-us/articles/34443991672589-Promote-Tools))

**Implication:** V2 should present a small Pareto set of scenarios, never one opaque “optimized” answer. Each scenario should show seller margin, break-even fill, weakest-slot outcome, buyer downside, and compliance. Examples: “highest margin,” “easiest to fill,” “most balanced,” and “more chase visibility.” The user can select the business objective; the app should not covertly trade buyer value for seller margin.

### 2.3 The buyer-facing export must be transparent enough to build trust

Whatnot requires rules in show notes or listings and full on-camera visibility. It also recommends accurate descriptions and presentation because these affect buyer confidence and seller performance. ([Whatnot Card Breaks Policy](https://help.whatnot.com/hc/en-us/articles/34107485220237-Card-Breaks-Policy), [Whatnot seller performance](https://help.whatnot.com/hc/en-us/articles/41945906342029-Improve-Your-Seller-Performance-Metrics))

**Implication:** exports should include:

- exactly what will be opened;
- spot list and assignment method;
- color/routing rules, including multicolor, colorless, lands, and double-faced cards;
- bulk/base and shipping rules;
- a compact “what can be pulled” graphic that distinguishes probability from value;
- an evidence date and “estimates, not guarantees” label;
- no claims that a particular hit is due, guaranteed, or likely because it has not appeared recently.

Seller graphics may emphasize appealing art and meaningful chase possibilities, but the data layer must preserve denominators and avoid portraying theoretical product value as money guaranteed to a buyer.

## 3. Bid Check: designing for a sub-10-second decision

### 3.1 Time pressure changes cognition and behavior

In an online field experiment using uncertain lottery payoffs, participants given 25 seconds were less likely to bid and bid less than participants given up to six minutes. The authors reported stronger perceived time pressure and more intuitive decision-making. ([El Haji et al., 2019](https://doi.org/10.1016/j.socec.2018.12.001)) In controlled retail-auction experiments, time pressure and human competition increased arousal, and arousal mediated higher bids in ascending auctions with human opponents. ([Adam et al., 2015](https://doi.org/10.1016/j.jretai.2015.01.003)) Separate controlled and field studies found time urgency increased reliance on peripheral contrast information from adjacent listings. ([Chang and Chen, 2013](https://doi.org/10.1016/j.elerap.2012.12.004))

These findings do not establish one universal “time pressure effect”; they establish that live auction context can alter participation, information processing, and bids.

**Implication:** the live interface should remove peripheral information, animation, and competing calls to action. It should make a previously calculated ceiling persistently visible and require no graph interpretation to answer the immediate question.

An experiment varying three versus ten alternatives and limited versus extended time found the larger-set/limited-time condition harder and more frustrating. ([Haynes, 2009](https://doi.org/10.1002/mar.20269)) An experiment on AI-assisted decisions under time pressure found that placing recommendations before an initial decision sped choices but increased overreliance, demonstrating that “answer first” has an automation-bias cost. ([Swaroop et al., 2024](https://doi.org/10.1145/3640543.3645206))

**Implication:** answer first does not mean unexplained authority. The decision card should contain one recommendation, one ceiling, a compact evidence-quality state, and one falsifiable reason. A buyer must be able to see why the app would change its answer. Deeper explanation remains optional; uncertainty does not.

### 3.2 The dominant buyer output should be an actionable ceiling

Whatnot already offers Max Bid and pre-bid, where the platform automatically bids up to a user-set limit. ([Whatnot: bid during a show](https://help.whatnot.com/hc/en-us/articles/14932924544141-Bid-on-an-item-during-a-show), [Whatnot: pre-bid](https://help.whatnot.com/hc/en-us/articles/14933026908301-Pre-bid-on-an-item-before-a-show)) This makes a ceiling a native bridge from analysis to action.

Recommended first-viewport structure:

- **Recommendation:** `Bid`, `Only if chase-seeking`, `Pass`, or `No verdict`.
- **Max next bid:** the highest additional hammer amount consistent with the selected risk stance.
- **All-in if won now:** hammer plus incremental shipping and explicit tax treatment.
- **Three-point outcome:** downside (P10), typical (median), upside (P90), all on a common dollar scale.
- **One reason:** for example, “Typical modeled value is $9 below your all-in cost.”
- **Undo/slot-taken control:** updates the remaining assignment pool without moving the viewport.

“No verdict” is required when material product, collation, price, or house-rule evidence is incomplete. It is more useful than a false green/red answer because it identifies the missing fact the buyer must ask the seller.

### 3.3 Expected value alone is an inadequate recommendation

Prospect theory's original experiments showed that choices under risk depend on gains and losses relative to a reference point and that people do not treat probabilities and outcomes as a simple expected-value calculation. ([Kahneman and Tversky, 1979](https://www.jstor.org/stable/1914185)) Common-value auction experiments repeatedly observe winner's-curse behavior: winning can select the most optimistic estimate, and inexperienced participants can lose money despite incentives to adjust. ([Charness and Levin, 2009](https://doi.org/10.1257/mic.1.1.207), [Parlour et al., 2007](https://doi.org/10.1016/j.geb.2006.10.005)) A break spot is not a pure common-value asset—identity, collecting, play, and entertainment generate private value—but its resale component has a common-value element.

**Implication:** V2 should show EV but base the recommendation on a user-selected stance:

- **Protect downside:** ceiling tied to a lower percentile or conservative utility rule.
- **Typical value:** ceiling tied primarily to the median.
- **Chase-seeking:** permits a ceiling nearer the mean while explicitly naming loss frequency and tail dependence.

The app must never call any stochastic purchase “safe.” It should explain the mathematical rule for each stance and allow the user to set a personal premium for entertainment or collecting instead of silently treating market resale price as total utility.

### 3.4 Preserve inputs and context throughout the auction sequence

WCAG 2.2 requires meaningful sequence and adds redundant-entry guidance; GOV.UK guidance says not to ask for the same information twice and to carry prior responses forward. ([WCAG 2.2](https://www.w3.org/TR/WCAG22/), [GOV.UK question pages](https://design-system.service.gov.uk/patterns/question-pages/)) USWDS recommends warning users before invalidating answers and supporting saved/resumable state. ([USWDS progress guidance](https://designsystem.digital.gov/patterns/complete-a-complex-form/progress-easily/))

**Implication:** changing bulk threshold, mode, assignment, or a taken color must not clear bid, shipping, product, or preference inputs unless they are logically invalid. If a change invalidates downstream state, show the exact effect and offer undo. Selection changes must update in place without auto-scrolling or focus jumps.

## 4. Risk communication and visualization

### 4.1 Use the visual encoding that matches the decision

Cleveland and McGill's foundational experiments found judgments of position on a common scale more accurate than length, which in turn outperformed angle, slope, and area for the tested comparison tasks. ([Cleveland and McGill, 1984](https://doi.org/10.1080/01621459.1984.10478080), [Cleveland and McGill, 1986](https://doi.org/10.1016/S0020-7373(86)80019-0)) A later uncertainty-display experiment found behavioral and estimation accuracy varied by graph form; error bars and boxplots performed best for mean estimation and act/do-not-act choices among the tested designs, while complementary cumulative distributions performed best for probability questions. ([Edwards et al., 2012](https://doi.org/10.1111/j.1539-6924.2012.01839.x))

**Implication:** choose charts by question:

- Bid ceiling and comparison: aligned marks on one dollar axis.
- Downside/typical/upside: compact interval or quantile strip on the same axis as landed cost.
- Chance of clearing cost: direct frequency plus a small cumulative view if expanded.
- Seller scenario comparison: aligned bars/dots for margin and break-even fill.
- Chase card exploration: a sortable list first; a probability-versus-value plot only as an analytical expansion.

The current chase map should not be the primary decision surface. Dense numbered scatterplot labels and crossing connectors require lookup, suffer overlap on mobile, and answer a card-exploration question rather than the immediate bid question. A controlled crowdsourced study of distribution judgments found a non-overlapping “gatherplot” supported faster and more accurate judgments than jittered scatterplots for its tested tasks, reinforcing that overlap is lost information rather than a cosmetic defect. ([Park et al., Gatherplot](https://www.journalovi.org/2023-park-gatherplots/)) Experiments on truncated bar charts found that distorted scales persistently exaggerated perceived differences and that warnings did not remove the effect. ([Yang et al., 2021](https://doi.org/10.1016/j.jarmac.2020.10.002))

**Implication:** if retained, the Chase Map's probability and price/value axes must not include impossible negative domains. Bar views begin at zero; scatter views state their bounds and clamp padding to the feasible domain. Labels use collision-aware placement or clustering; only selected/high-priority points receive direct labels and any leader line. A synchronized ordered list supplies exact names and values and serves as the accessible alternative.

### 4.2 Communicate probabilities as both numbers and frequencies

Experiments found icon arrays can improve risk understanding across numeracy levels, though design details and the denominator affect perception; later work found modest differences among icon styles and emphasized graphical literacy. ([Galesic et al., 2009](https://doi.org/10.1037/a0014474), [Ruiz et al., 2024](https://doi.org/10.1177/0272989X241263040)) A randomized trial comparing numerical formats found no single representation should be assumed universally best, supporting paired forms rather than dogma. ([Woloshin and Schwartz, 2011](https://doi.org/10.7326/0003-4819-155-2-201107190-00004))

**Implication:** say “7 in 20 modeled openings clear $18” beside “35%,” using a fixed denominator across comparisons. Do not create hundreds of decorative dots. Use the frequency display as an optional explanation of a direct recommendation, not as the only result.

Equivalent relative and absolute descriptions can alter choices; an original risk-communication experiment found relative formats could raise willingness to pay compared with absolute expressions. ([Stone, Yates, and Parker, 1994](https://doi.org/10.1006/obhd.1994.1091))

**Implication:** seller-facing graphics must not lead with “2× better” or another relative improvement without the absolute values and denominators. Persuasion should come from clarity, verified chase visibility, balanced construction, and truthful presentation rather than framing tricks.

### 4.3 Show model confidence separately from outcome variability

An experiment combining quantile-dotplot uncertainty with qualitative forecaster confidence found participants used both sources and became more conservative when either modeled variability increased or forecaster confidence fell. The authors recommend presenting qualitative model confidence alongside quantified uncertainty. ([Padilla et al., 2021](https://doi.org/10.3389/fpsyg.2020.579267))

**Implication:** distinguish:

- **Outcome range:** variation inherent in opening sealed product.
- **Evidence confidence:** whether contents, sheet weights, finish prices, and rules are verified, estimated, or incomplete.

A wide distribution with verified collation is not “low confidence.” Conversely, a narrow estimate based on missing data is not reliable. Use explicit text and icons, never color alone.

### 4.4 Show predictive variation, not precision around an average

In experiments about treatment-effect charts, confidence intervals around means led readers to underestimate individual-outcome variability; prediction intervals and hypothetical outcome displays better supported judgments about possible outcomes. ([Hofman, Goldstein, and Hullman, 2020](https://www.microsoft.com/en-us/research/publication/how-visualizing-inferential-uncertainty-can-mislead-readers-about-treatment-effects-in-scientific-results/)) In an incentivized mobile-like transit task, quantile dotplots and cumulative-distribution displays improved decisions over textual or absent uncertainty displays. ([Fernandes et al., 2018](https://doi.org/10.1145/3173574.3173718))

**Implication:** ColorBreak should show the predictive distribution of card-value outcomes, not a confidence interval around estimated mean EV. A compact quantile dotplot is a candidate for buyer drill-down because each dot maps to a modeled outcome and cost-threshold crossing is visible; it is not yet proven best for this auction task and must be tested against a simpler aligned interval.

### 4.5 Accessibility is part of graphical correctness

WCAG 2.2 requires that color not be the only information channel, normal text contrast reach 4.5:1, interface-component contrast reach 3:1, content reflow at a 320 CSS-pixel equivalent without two-dimensional scrolling (except inherently two-dimensional content), focused elements not be entirely obscured, and minimum target sizing meet the applicable criterion. ([WCAG 2.2](https://www.w3.org/TR/WCAG22/)) W3C notes that sticky headers and toolbars can make reflowed content unreadable or obscure focus. ([W3C Reflow understanding](https://www.w3.org/WAI/WCAG22/Understanding/reflow))

**Implication:** every chart requires a text equivalent and logical reading order. Status uses label + icon + color. Focused cards, dialogs, and their close buttons must remain below the header and inside safe areas. Avoid nested scroll regions for primary content. Long analytical charts may scroll horizontally only when the data is genuinely two-dimensional and must include a tabular alternative.

## 5. Magic product, collation, and value evidence

### 5.1 Booster slots are distributions, not interchangeable cards

Wizards explains that cards are printed on sheets, cut, loaded into feeders, and inserted by slot; some slots select among multiple sheets according to configured percentages. It explicitly identifies as-fan, sheets, slots, variants, foil treatments, and special dedicated slots as interacting parts of collation. ([Wizards: Do the Math](https://magic.wizards.com/en/news/making-magic/do-the-math)) Wizards also warns that Play Booster details vary by set and publishes set-specific “Collecting” guides. ([Wizards: What Are Play Boosters?](https://magic.wizards.com/en/news/making-magic/what-are-play-boosters))

For Foundations specifically, Wizards publishes 14-card Play Boosters and 36 Play Boosters per box. It discloses dedicated common, uncommon, rare/mythic, wildcard, foil, and land-related contents, with special treatments and a 1.5% common-slot replacement by one of ten Special Guests. ([Wizards: Collecting Foundations](https://magic.wizards.com/en/news/feature/collecting-foundations), [Wizards: Starting with Good Foundations](https://magic.wizards.com/en/news/making-magic/starting-with-a-good-foundations-part-2))

**Implication:** the calculation must operate on the exact product and printing/finish, preserve mutually exclusive variants and no-duplicate rules, and surface omissions. It cannot infer one set's Play Booster structure from another's generic pattern. Product selection should show a concise content summary so users can catch a wrong product before relying on the output.

### 5.2 “Market price” is an observation, not liquidation value

TCGplayer says Market Price is compiled from recent completed transactions and is updated as transactions complete; listed median is based on live asking prices and can diverge materially. TCGplayer also publishes a volatility category derived from sales volume and 30-day price dispersion and labels low-volume cases indeterminate. ([TCGplayer Market Price](https://help.tcgplayer.com/hc/en-us/articles/213588017-TCGplayer-Market-Price), [TCGplayer price points](https://help.tcgplayer.com/hc/en-us/articles/222376867-What-do-the-different-price-points-on-TCGplayer-com-mean)) TCGplayer's seller guidance says price plus shipping affects listing visibility and warns sellers to factor fees and shipping into their prices. ([TCGplayer pricing practices](https://help.tcgplayer.com/hc/en-us/articles/201914668-Best-Practices-for-Pricing-Your-Items))

**Implication:** V2 must call this “modeled card market value,” not cash value or guaranteed return. It should show observation age, finish, condition assumption, missing prices, and an optional user-defined realization haircut. Seller product acquisition cost and buyer spot value are different prices and must never be conflated.

### 5.3 Competitive players and collectors value cards differently

Wizards designed Play Boosters to support both Limited play and the excitement of opening variants and multiple rares, explicitly reporting that most booster opening is not for Limited play and that multiple rare/mythic opportunities were a highly rated Set Booster feature. ([Wizards: What Are Play Boosters?](https://magic.wizards.com/en/news/making-magic/what-are-play-boosters)) This establishes multiple intended product motives but not their proportions among Whatnot break buyers.

**Implication:** the buyer profile may include optional personal utility: cards wanted for play, collection, finish, or color identity. Default financial analysis remains resale-market based, while personal premiums are visibly user-authored. A competitive-player review should question price without playability; a collector review should question whether rare treatments and exact finishes are modeled accurately.

## 6. Mobile web and iPhone 17 Pro Max constraints

### 6.1 Design to the effective viewport, not hardware pixels

Apple lists the iPhone 17 Pro Max as a 6.9-inch OLED with 2868×1320 physical pixels at 460 ppi. Physical resolution is not the CSS layout viewport. Safari Responsive Design Mode reports effective viewport size in screen points and Apple warns that presets are approximations because browser chrome, the keyboard, and device-specific form behavior alter the actual view. ([Apple iPhone 17 Pro Max specifications](https://images.apple.com/uk/iphone-17-pro/specs/), [Safari Responsive Design Mode](https://developer.apple.com/documentation/safari-developer-tools/responsive-design-mode))

Apple recommends `width=device-width` for iOS web content. When edge-to-edge layout uses `viewport-fit=cover`, content must honor safe-area insets because Safari UI, sensor housing, and rounded edges can obscure content; those insets change as browser chrome changes. ([Apple viewport guidance](https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/SafariWebContent/UsingtheViewport/UsingtheViewport.html), [Apple: Design for Safari](https://developer.apple.com/videos/play/wwdc2021/10029/))

**Implication:** test layout behavior rather than hard-code “iPhone 17” pixels. Primary content and modal controls require padding using `env(safe-area-inset-*)`, dynamic viewport units where appropriate, and tests with expanded/minimized browser chrome, portrait/landscape, keyboard open, 200% text, and home-screen mode.

### 6.2 Touch targets and control placement must favor speed and accuracy

Apple recommends at least 44×44 points for a button's hit region, primary controls near the content they modify, readable text, ample contrast, and layouts that fit without horizontal scrolling. ([Apple UI design tips](https://developer.apple.com/design/tips/), [Apple button guidance](https://developer.apple.com/design/human-interface-guidelines/buttons)) WCAG 2.2 sets a 24×24 CSS-pixel AA minimum target size with spacing exceptions, but ColorBreak's time-critical financial controls should meet Apple's larger 44-point guidance.

**Implication:** bid, shipping, color/taken toggles, undo, recommendation details, and dialog close are large targets. The live control cluster should be reachable near the lower portion of the viewport, while respecting bottom safe area and avoiding collision with Safari chrome. Dense card chips and tiny plotted labels are not acceptable substitutes for controls.

### 6.3 Performance and stability are product acceptance criteria

Google's Core Web Vitals “good” thresholds are LCP ≤2.5 seconds, INP ≤200 ms, and CLS ≤0.1 at the 75th percentile, segmented by mobile and desktop. ([web.dev Web Vitals](https://web.dev/articles/vitals)) Apple recommends responsive standards-based web design and device testing; Safari's simulator is more accurate than a viewport preset for keyboard and browser behavior. ([Apple Safari optimization](https://developer.apple.com/documentation/webkit/optimizing-your-website-for-safari), [Safari Responsive Design Mode](https://developer.apple.com/documentation/safari-developer-tools/responsive-design-mode))

For a sub-10-second decision, ColorBreak needs stricter task gates than general page health:

- cached bid updates visibly respond in ≤100 ms at the median and remain below 200 ms at p75;
- first useful recommendation appears in ≤2 seconds on the target phone after cached product data;
- calculations run off the main thread and do not block typing or tapping;
- no input or result update causes an unexpected viewport jump;
- CLS remains ≤0.1 and selection changes produce effectively zero layout shift in the result header;
- offline/stale states retain the last valid result with a conspicuous timestamp rather than blanking the decision.

These are product targets derived from the auction context; only the Core Web Vitals thresholds themselves are externally standardized.

## 7. Information architecture and visual language

### 7.1 Progressive disclosure should remove explanations from the critical path

GOV.UK recommends one decision or question at a time as a default because it helps users focus, while acknowledging that frequent expert workflows may justify grouping related inputs when user research supports it. ([GOV.UK labels and headings](https://design-system.service.gov.uk/get-started/labels-legends-headings/), [GOV.UK question pages](https://design-system.service.gov.uk/patterns/question-pages/)) USWDS recommends progressive disclosure, meaningful chunks, visible progress, saved state, and warnings before changes invalidate previous answers. ([USWDS progress guidance](https://designsystem.digital.gov/patterns/complete-a-complex-form/progress-easily/))

**Implication:** Seller Studio can be a guided composition flow because it is preparatory. Bid Check should be a compact expert surface because it is repeated rapidly. Both use “result first, evidence on demand”:

- plain-language label;
- the decisive number;
- one sentence of rationale;
- expandable assumptions;
- deeper evidence and card lists last.

If a number needs a paragraph before its purpose is understandable, it is not a primary metric.

### 7.2 Modernization should reduce containers, not merely change radii

Neither Apple nor WCAG requires cards, rounded rectangles, nested panels, or any ornamental container. Apple's guidance emphasizes clarity, alignment, grouping, and controls near the content they modify. ([Apple UI design tips](https://developer.apple.com/design/tips/))

**Implication:** use typography, spacing, rules, and shared axes to express hierarchy. Reserve a bordered surface for an interactive region, selected state, warning, or materially distinct context. Primary rollouts should expand directly beneath section headings. Avoid panel-inside-panel layouts, pervasive shadows, and rounded containers around every statistic. Corner radius should be a restrained token tied to function, not the visual identity.

## 8. Proposed V2 scope from the research

### 8.1 Shared truth engine

- exact sealed composition and product identity;
- configurable spot maps and house rules;
- analytic EV plus deterministic outcome simulation where evidence permits;
- finish-aware, timestamped prices and optional realization haircut;
- explicit omission and evidence confidence model;
- Whatnot fee model with dated policy source;
- stable shareable state and local persistence;
- computation worker and cache keyed by every decision-changing input.

### 8.2 Seller Studio

- guided product/cost/format setup;
- net profit, margin, break-even revenue, and break-even fill;
- per-spot and auction-start pricing targets;
- partial-fill and shipping/fee scenario table;
- buyer-value balance and weakest-slot diagnostics;
- constrained scenario suggestions with transparent objectives;
- compliance validation;
- generated show notes, rules, spot list, auction titles, and 9:16 buyer-facing graphics;
- post-show planned-versus-actual worksheet when users supply results.

### 8.3 Bid Check

- fast restore of recent/shared break;
- product then immediately color/taken-state setup, matching the live workflow;
- persistent bid and incremental shipping fields across all mode changes;
- direct recommendation, maximum next bid, and all-in price;
- downside/median/upside on one scale plus chance-to-clear frequency;
- random-remaining and pick-my-color modes;
- one-tap mark-taken, undo, and keyboard-safe numeric entry;
- ranked card/chase list with optional analytical plot;
- no-verdict path that identifies the exact seller question needed.

### 8.4 Seller-to-buyer bridge

A seller-generated share link should preload the same composition and rules into Bid Check. The buyer sees who supplied the assumptions and can edit them locally. This reduces duplicate setup while preserving independent analysis. The link must not be presented as Whatnot verification.

## 9. Acceptance and research gates

### 9.1 Buyer comprehension and speed

With active Whatnot Magic buyers on the target iPhone:

- at least 90% correctly state whether the recommendation is Bid/Pass/No verdict;
- at least 85% identify the maximum additional bid without coaching;
- at least 80% distinguish typical value from mean and downside;
- median prepared-break decision time ≤3 seconds and p90 ≤7 seconds;
- median first-time setup-to-result ≤30 seconds;
- zero lost bid/shipping values during mode, bulk, or color changes;
- zero accidental viewport jumps in the scripted auction sequence.

These thresholds are proposed product gates, not claims from the cited literature.

### 9.2 Seller usefulness

With active Magic break sellers:

- at least 90% correctly identify net expected profit and break-even fill;
- at least 80% can explain why fixed processing fees change profit across spot counts;
- at least 80% choose one suggested scenario and correctly describe its buyer/seller tradeoff;
- generated show notes pass an internal policy checklist with no prohibited outcome-contingent language;
- sellers produce a usable show setup without external spreadsheet calculations.

### 9.3 Accessibility, performance, and device matrix

- WCAG 2.2 AA automated checks plus manual keyboard, VoiceOver, zoom/reflow, contrast, and non-color tests;
- 44-point primary touch targets;
- no focused element obscured by header, browser chrome, keyboard, or modal;
- portrait and landscape on physical iPhone 17 Pro Max; Safari with browser chrome expanded and collapsed; home-screen mode if supported;
- 320 CSS-pixel equivalent reflow and 200% text;
- LCP ≤2.5 s, INP ≤200 ms, CLS ≤0.1 at mobile p75;
- cached calculation target ≤100 ms and initial usable result ≤2 s on target hardware;
- deterministic simulation and analytic/simulation agreement tests;
- negative-axis prevention and label-collision tests for every retained plot.

## 10. Findings that should be rejected or deferred

- **Reject “make it exciting” through artificial urgency, flashing, near-miss, or slot-machine effects.** Auction experiments show arousal can influence bids in human competition; exploiting that is opposed to the buyer decision-support mission. ([Adam et al., 2015](https://doi.org/10.1016/j.jretai.2015.01.003))
- **Reject a universal green “good deal” based on mean EV.** It hides outcome skew, resale friction, personal utility, and evidence uncertainty.
- **Reject policy-risky enticements.** Bounties, whiff insurance, wheels, outcome guarantees, and purchase-triggered games conflict with Whatnot's published policies. ([Whatnot Gambling and Purchase-Based Prize Policy](https://help.whatnot.com/hc/en-us/articles/4410443596813-Gambling-and-Purchase-Based-Prize-Policy))
- **Reject dense chase scatterplots as the first buyer result.** They optimize exploration rather than the immediate auction decision and impose label-collision and accessibility costs.
- **Defer automated Whatnot analytics ingestion.** No researched public API or user-granted data access was established. Manual planned-versus-actual entry is honest.
- **Defer seller reputation scoring.** The cited platform metrics explain Whatnot's signals but do not provide ColorBreak a reliable feed or enough context to produce an independent score.
- **Defer claims that one risk graphic is universally superior.** Experiments show task and format interactions; validate candidate displays on the exact ColorBreak questions.

## 11. Open research that cannot be solved from documents

The following require direct participants or authorized platform data:

1. Relative prevalence of random versus pick-your-color Magic breaks on Whatnot.
2. Real spot closing-price distributions and seller margins by product.
3. The exact decision sequence active buyers use across the ten-second counter-bid window.
4. How buyers price entertainment, color affinity, playability, and collecting utility relative to resale value.
5. Which seller-facing graphics increase show joins, retained viewers, or bids without reducing comprehension or trust.
6. Whether generated rule cards reduce chat questions, cancellations, and disputes.
7. Which recommendation language causes appropriate calibration rather than blind automation.

The correct V2 program is therefore build–measure–revise: prototype the smallest viable Seller Studio and Bid Check, observe the two core tasks on actual hardware, and revise the specification when behavior contradicts documentary inference.

## Source index

### Platform and market

- [Whatnot Card Breaks Policy](https://help.whatnot.com/hc/en-us/articles/34107485220237-Card-Breaks-Policy)
- [Whatnot Gambling and Purchase-Based Prize Policy](https://help.whatnot.com/hc/en-us/articles/4410443596813-Gambling-and-Purchase-Based-Prize-Policy)
- [Whatnot Breaks feature](https://help.whatnot.com/hc/en-us/articles/26596362677389-Breaks-feature-for-sellers)
- [Whatnot auction mechanics](https://help.whatnot.com/hc/en-us/articles/9779931101837-Start-an-auction-during-your-show)
- [Whatnot buyer bidding mechanics](https://help.whatnot.com/hc/en-us/articles/14932924544141-Bid-on-an-item-during-a-show)
- [Whatnot seller fees](https://help.whatnot.com/hc/en-us/articles/4847069165965-Whatnot-seller-fees)
- [Whatnot show scheduling](https://help.whatnot.com/hc/en-us/articles/9778927885581-Schedule-edit-and-start-a-show)
- [Whatnot Promote Tools](https://help.whatnot.com/hc/en-us/articles/34443991672589-Promote-Tools)
- [Whatnot Seller Analytics](https://help.whatnot.com/hc/en-us/articles/12231027226637-Track-performance-with-Seller-Analytics)
- [TCGplayer Market Price](https://help.tcgplayer.com/hc/en-us/articles/213588017-TCGplayer-Market-Price)
- [TCGplayer price-point definitions](https://help.tcgplayer.com/hc/en-us/articles/222376867-What-do-the-different-price-points-on-TCGplayer-com-mean)

### Magic product structure

- [Wizards: Collecting Foundations](https://magic.wizards.com/en/news/feature/collecting-foundations)
- [Wizards: What Are Play Boosters?](https://magic.wizards.com/en/news/making-magic/what-are-play-boosters)
- [Wizards: Do the Math](https://magic.wizards.com/en/news/making-magic/do-the-math)

### Design, accessibility, and performance

- [Apple UI design tips](https://developer.apple.com/design/tips/)
- [Apple Safari Responsive Design Mode](https://developer.apple.com/documentation/safari-developer-tools/responsive-design-mode)
- [Apple: Design for Safari](https://developer.apple.com/videos/play/wwdc2021/10029/)
- [WCAG 2.2](https://www.w3.org/TR/WCAG22/)
- [W3C: Understanding Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow)
- [Google Web Vitals](https://web.dev/articles/vitals)
- [USWDS design principles](https://designsystem.digital.gov/design-principles/)
- [GOV.UK question pages](https://design-system.service.gov.uk/patterns/question-pages/)

### Original research

- [Kahneman and Tversky, Prospect Theory (1979)](https://www.jstor.org/stable/1914185)
- [Cleveland and McGill, Graphical Perception (1984)](https://doi.org/10.1080/01621459.1984.10478080)
- [El Haji et al., Time pressure and risk taking in auctions (2019)](https://doi.org/10.1016/j.socec.2018.12.001)
- [Adam et al., Auction Fever (2015)](https://doi.org/10.1016/j.jretai.2015.01.003)
- [Charness and Levin, The Origin of the Winner's Curse (2009)](https://doi.org/10.1257/mic.1.1.207)
- [Galesic et al., Icon arrays and numeracy (2009)](https://doi.org/10.1037/a0014474)
- [Edwards et al., Graphical methods for quantitative uncertainty (2012)](https://doi.org/10.1111/j.1539-6924.2012.01839.x)
