# ADR 0003: Data confidence controls behavior

- Status: accepted
- Date: 2026-08-11

## Context

MTGJSON can omit or encode sealed contents in shapes that are not safely parseable. Showing an apparently precise verdict while a topper, guaranteed card, foreign booster, or exact-finish price is missing is materially misleading.

## Decision

Every valuation is `verified`, `estimated`, or `incomplete`. Adapters emit named omissions. A material omission produces `incomplete`, values become an explicit lower bound, and the buyer verdict is suppressed. No finish or product proxy is substituted silently.

## Consequences

Some products provide less decisive output, but users can distinguish an honest lower bound from a complete estimate. Data work can target the named omission instead of reverse-engineering a suspicious total.
