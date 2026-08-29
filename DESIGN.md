# ColorBreak interface system

## Product posture

ColorBreak is a decision instrument, not a dashboard. It should feel fast, calm, and premium under live-auction pressure. The interface reveals one decision at a time and lets evidence expand on demand.

## Hierarchy

1. Launch a decision: “Should I bid?” or “Should I run it?” The entry is an appliance launcher, never a marketing hero.
2. Define the break with set, product, and quantity.
3. Show the task’s answer: buyer verdict or seller target plan.
4. Reveal evidence: EV definitions, confidence, risk, contributors, and omissions.

Mobile uses full-width sections and a bottom-sheet picker. Desktop adds a sticky composition column; it does not add a denser information model.
Every empty, incomplete, and calculated state names the next useful action. Returning users may resume saved work explicitly; starting a Bid Check always begins clean unless they choose Resume.

## Visual language

- Near-black canvas, full-width working surfaces, exposed rules, and no decorative shadow.
- Electric acid is the primary decision/action accent. Cyan identifies information, magenta adds directional energy, and violet distinguishes seller planning. Warning states use electric yellow instead of brown or earth tones.
- Manrope carries display and numeric emphasis; DM Sans carries interface copy.
- Geometry is cut and square. Interface controls, panels, badges, data marks, sheets, and dialogs use zero-radius corners; only physical card art retains its real-world silhouette. Motion is short, linear, and functional.
- W/U/B/R/G/M/C/L colors live in slot chips and indicators. Every slot also has a letter and name, so color is never the sole signal.
- Positive and negative states always include text, not only green or red.
- `InformationLabel` is the sole component for eyebrow, step, and context labels. Shared primitives draw from the tokens in `future.css`; local variants extend the primitive instead of redefining it.

## Interaction

- Touch targets are at least 40px where space permits.
- Product selection calculates immediately.
- Sheets animate from the bottom on mobile and become centered dialogs on larger screens.
- Hover may enrich desktop use but cannot reveal required controls.
- Respect `prefers-reduced-motion`.
- Tooltips explain unfamiliar economics; they do not hide required warnings.

## Restraint

Do not add decorative charts, persistent data tables, animated counters, card art walls, ornamental gradients, glass effects, pill badges, nested cards, or extra modes to the first screen. A number is prominent only when it answers the current task.
