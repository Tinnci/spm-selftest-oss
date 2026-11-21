---
name: delete-comment
description: Audit, categorise and delete code comments, move decisions to ADRs, update the comment ratchet, and estimate lines shed.
---

# /delete-comment

Use this skill when the user asks to audit comments, ban comments, or repeat the
comment cleanup in this repository.

## Scope

Default scope is maintained source only:

- `src/`
- `src-tauri/src/`
- `src-tauri/tests/`
- `scripts/`
- `.github/`

Do not treat generated files, `node_modules`, `dist`, `target`, Markdown documents
or locale JSON as code comments.

## Procedure

1. Inventory comment blocks by file and line. Include block comments and YAML
   comments; exclude strings, URLs and CSS `*` selectors.
2. Categorise every block:
   - **Tautology**: restates the code or a section header.
   - **Stale**: names removed tabs/files/components or obsolete behavior.
   - **Excuse**: documents a workaround that hides a real implementation issue.
   - **Decision Record**: explains a non-obvious rule, constraint or tradeoff.
3. Delete Tautology and Stale comments.
4. For Excuse comments, delete them and open a GitHub issue with the workaround,
   risk and desired fix.
5. Move Decision Records to `docs/adr/`. Add or update ADRs rather than keeping
   the prose beside the code. Do not copy code comments verbatim.
6. Keep only tool directives: ESLint, TypeScript, Prettier, Vitest, YAML language
   server, shebangs and `/// <reference ... />`.
7. Update `comment-baseline.json` with `npm run lint:comments:update` only after
   the audit. The baseline is a ceiling; never raise it for new comments.
8. Record the audit in `docs/comment-audit-YYYY-MM-DD.md` with one row per block.
9. Run `npm run check`.
10. Compute lines shed from the pre-audit backup and current source.

## Commands

```bash
npm run lint:comments          # ratchet check
npm run lint:comments:update   # lower/seed baseline after audit
npm run check                  # full gate
```

The ESLint rule `local/no-comments` enforces JS/TS; `scripts/comment-ratchet.mjs`
enforces Rust, CSS, scripts and YAML. Both share `comment-baseline.json`.

## Report format

Return:

- counts by category
- issues opened for Excuse comments
- ADR file(s) added
- remaining directive comments
- physical lines removed and percentage of source
- full gate result
