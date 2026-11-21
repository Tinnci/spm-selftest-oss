# ADR 0002: Comments are not documentation

- Status: accepted
- Date: 2026-11-21

## Context

Comments in this repository had become a mix of restated code, historical notes
and hidden design decisions. They were not consistently maintained and made
large files harder to scan.

## Decision

1. Source comments are banned except for tool directives (ESLint, TypeScript,
   Prettier, Vitest, YAML language server, shebangs).
2. Non-obvious decisions belong in `docs/adr/`, not beside the code.
3. A ratchet baseline records the remaining comment count per file. New comments
   fail lint; the baseline can only move down.
4. `/delete-comment` is the repeatable audit procedure.

## Consequences

- New explanatory prose should update an ADR or a user-facing document.
- The baseline is temporary debt, not permission to add explanations.
- Directive comments remain because tools require them.
