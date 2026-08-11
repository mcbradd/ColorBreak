# ADR 0002: Static React application with domain seams

- Status: accepted
- Date: 2026-08-11

## Context

The single-file application mixed source adapters, valuation rules, state, and rendering. Fast changes repeatedly caused correctness and usability regressions, and the interface could not support task-specific buyer and seller flows cleanly.

## Decision

Use React and TypeScript with a Vite static build. Pure domain modules own valuation and marketplace rules; data adapters normalize Scryfall, tcgcsv, committed sealed records, and corrections; the UI owns task flow only. Deployment remains backend-free on GitHub Pages.

## Consequences

The project now requires a build step and dependencies. In return, domain contracts are testable without the DOM, source failures have one normalization boundary, and the frontend can be replaced without rewriting economics.
