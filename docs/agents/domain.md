# Domain Docs

How engineering skills should consume this repo's domain documentation when exploring the codebase.

## Before exploring, read

- **`CONTEXT.md`** at repo root, if it exists.
- **`docs/adr/`** — read ADRs that touch the area you're about to work in.

If these files don't exist yet, **proceed silently**. Don't flag the absence; don't suggest creating them upfront. The `/domain-modeling` skill (reached via `/grill-with-docs` and `/improve-codebase-architecture`) creates them lazily as terms and decisions actually get resolved.

## File structure

This repo is single-context:

```
/
├── CONTEXT.md
├── docs/adr/
│   ├── 0001-....md
│   └── 0002-....md
└── index.html
```

## Use the glossary's vocabulary

When output names a domain concept (in an issue title, refactor proposal, hypothesis, test name), use the term defined in `CONTEXT.md`. Don't drift into synonyms the glossary explicitly avoids.

If a concept you need isn't in the glossary yet, raise it via `/domain-modeling`.

## ADRs

Follow the decisions recorded in `docs/adr/`. If new work contradicts an existing ADR, say so explicitly (e.g. "Contradicts ADR-0007 (...)") rather than silently diverging.
