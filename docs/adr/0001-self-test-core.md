# ADR 0001: Self-test core and review decisions

- Status: accepted
- Date: 2026-11-21
- Scope: `spm_selftest` GUI, CLI and Rust core

## Context

The app has a Tauri GUI and a separate CLI over the same Rust core. Review and
email actions are safety gates for a manual SPM process. The decisions below are
non-obvious constraints that used to live as code comments.

## Decisions

### D1. Rust is the single source of truth for business rules

IR/MR/SMR/LR checks, diff generation, review planning and readiness live in Rust.
The TypeScript files only format check text, group items and build email text.
GUI and CLI call the same Rust functions.

### D2. Checks are pure and explain themselves through codes

`checks::evaluate` returns structured `SelfTestCheck` values with stable codes and
params. Errors block the submission email; warnings require explicit review.
Patch validity uses the record's patch reference and valid-days window.

### D3. BaseOS rules

For SMR, BaseOS is authoritative when the baseline has one. Fingerprint equality
is only a fallback for older baseline records. IR/MR/LR must not set BaseOS.

### D4. Review ledger and fingerprint

The review plan is derived from the record, its checks and the current diff.
Only decisions are persisted, keyed by stable item IDs. The fingerprint covers
semantic record fields, checks, baseline and diff. It intentionally excludes
name, note, tags, and artifact path/SHA so those edits do not invalidate an
already reviewed plan. Changing the artifact path or hash reopens that artifact
item.

### D5. Elevated actions are explicitly blocking

Saving a review and generating a submission email require a full-viewport
blocking confirmation. The scrim covers the app bar and rail; outside presses
and Escape do not dismiss it; the confirm action stays disabled until the
operator checks the attestation.

### D6. All email entry points share one gate

Detail, context menu, steps and batch email all call `openEmailDialog`. A record
needs a current plan with no blocking errors. When another record is merged into
the email, that record's own review is checked too. The final draft is built only
after the elevated confirmation.

### D7. ADB selection and refresh

A single ready device is selected automatically; multiple ready devices require
a manual choice. The environment is refreshed on mount, every five seconds while
visible, and immediately on focus/visibility restore. Polling pauses while a
collection, scan, wait or record load is active, and background failures keep the
last good snapshot.

### D8. SoC vendor classification

Collect `ro.soc.manufacturer` and `ro.soc.model` first, then board platform and
hardware properties. Store the canonical vendor and model in `soc_vendor` and
`soc_model`. `vendor` is the vendor build version and must not be used as the
chipset vendor. Unknown is distinct from Other (Exynos/Tensor/Kirin).

### D9. Storage and migration

Data lives under a per-user directory; `SPM_SELFTEST_HOME` can redirect it. Index
and record writes use a temp file followed by rename. On Windows an existing
target is removed first because rename cannot replace it; the temp file is fully
written before that step. First run imports Maon records once; legacy flat record
files are migrated into `records/`, `blobs/` and `index.json`. Imported records
recompute and persist checks once so the list can filter by status.

### D10. CLI contract

Exit codes are stable for automation: 0 success, 2 environment failure, 3
collection failure, 4 checks with errors or review-gated export, 5 usage/record/
export failure. `--no-pause` is accepted for parity with scheduled scripts; the
CLI never pauses. Exports are review-gated unless `--force` is supplied.

### D11. UI platform behavior

The window uses an undecorated Windows-style caption bar. Native Snap Layouts
covers the maximise button, so hover/press state comes from `caption-max` events.
Caption buttons stay out of the tab order. The theme is applied synchronously
because WebKitGTK's view-transition callback may run after the next paint. The
context menu intentionally keeps the native editing menu when the target has no
registered app actions.

## Consequences

- Business-rule changes require Rust changes and tests.
- Comment policy is defined in ADR 0002; source comments are not the place for
  these decisions.
