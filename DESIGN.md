# ColorBreak interface system

## Product posture

ColorBreak is a decision instrument, not a dashboard. It should feel fast, calm, and premium under live-auction pressure. The interface reveals one decision at a time and lets evidence expand on demand.

## Hierarchy

1. Choose a job: buyer or seller.
2. Define the break with set, product, and quantity.
3. Show the task’s answer: buyer verdict or seller target plan.
4. Reveal evidence: EV definitions, confidence, risk, contributors, and omissions.

Mobile uses full-width sections and a bottom-sheet picker. Desktop adds a sticky composition column; it does not add a denser information model.

## Visual language

- Near-black canvas, flat graphite sections, restrained rules, and almost no shadow.
- Acid green is the primary decision/action accent; violet distinguishes seller planning.
- Manrope carries display and numeric emphasis; DM Sans carries interface copy.
- Geometry is crisp: square or 2px corners by default. Curves are reserved for data points, toggles, and physical card art. Motion is short and functional.
- W/U/B/R/G/M/C/L colors live in slot chips and indicators. Every slot also has a letter and name, so color is never the sole signal.
- Positive and negative states always include text, not only green or red.

## Interaction

- Touch targets are at least 40px where space permits.
- Product selection calculates immediately.
- Sheets animate from the bottom on mobile and become centered dialogs on larger screens.
- Hover may enrich desktop use but cannot reveal required controls.
- Respect `prefers-reduced-motion`.
- Tooltips explain unfamiliar economics; they do not hide required warnings.

## Restraint

Do not add decorative charts, persistent data tables, animated counters, card art walls, or extra modes to the first screen. A number is prominent only when it answers the current task.
