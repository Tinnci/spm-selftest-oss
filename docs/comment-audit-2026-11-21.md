# Comment audit — 2026-11-21

Scope: maintained source under `src/`, `src-tauri/src/`, `src-tauri/tests/`, `scripts/` and `.github/`.

Every comment block was classified as Tautology, Excuse, Stale or Decision Record. Tool directives are listed as Directive because they are required by the toolchain and are exempt from the comment ban.

| Comment | Category | Action | Text |
| --- | --- | --- | --- |
| src/App.tsx:37-37 | Decision Record | Moved to ADR 0001 D11 | A narrow window folds the rail whatever was chosen, and restores it when it widens. |
| src/SelfTestPage.tsx:97-97 | Tautology | Deleted | Which GMS field a failed check points at, for the "jump to field" action. |
| src/SelfTestPage.tsx:119-119 | Tautology | Deleted | Arrow-key navigation for the detail tablist (automatic activation). |
| src/SelfTestPage.tsx:141-141 | Tautology | Deleted | Dedicated Android self-test collector and snapshot manager. |
| src/SelfTestPage.tsx:246-246 | Decision Record | Moved to ADR 0001 D4 | The backend stores the auto-picked baseline; reuse it for the diff tab. |
| src/SelfTestPage.tsx:306-306 | Directive | Retained (tool directive) | eslint-disable-next-line react-hooks/exhaustive-deps |
| src/SelfTestPage.tsx:382-382 | Decision Record | Moved to ADR 0001 D6 | Switching records with unsaved meta edits asks before dropping them. |
| src/SelfTestPage.tsx:576-576 | Decision Record | Moved to ADR 0001 D6 | Builds the draft into a preview dialog instead of copying it blind. |
| src/SelfTestPage.tsx:607-611 | Decision Record | Moved to ADR 0001 D5/D6 | Every email entry point funnels through this gate. A record must have a current review plan with no blocking errors, and the final draft is only built after the full-viewport elevated confirmation. |
| src/SelfTestPage.tsx:832-832 | Decision Record | Moved to ADR 0001 D4 | Same model first, then newest: the likely baseline is one click away. |
| src/api/session.ts:4-4 | Tautology | Deleted | Caption-max events from the native Snap Layouts overlay. |
| src/api/session.ts:15-15 | Tautology | Deleted | Maximised and focus state of the main window, with a cleanup. |
| src/api/shell.ts:7-7 | Tautology | Deleted | Copies text through the host clipboard, or the browser's when previewing. |
| src/api/shell.ts:13-13 | Tautology | Deleted | Shows a path in the system file manager; desktop only. |
| src/api/shell.ts:19-19 | Tautology | Deleted | The package version shown in settings. |
| src/api/transport.ts:5-5 | Tautology | Deleted | Commands that only exist in the desktop shell. |
| src/api/transport.ts:10-10 | Decision Record | Moved to ADR 0001 D1 | Every backend command goes through here so argument names stay in one place. |
| src/components/action-icon.tsx:98-98 | Tautology | Deleted | Decorative label icons disappear together when the window needs room for text. |
| src/components/action-icon.tsx:116-116 | Tautology | Deleted | Menu actions share the same semantics even when supplied by different screens. |
| src/components/brand-mark.tsx:4-4 | Tautology | Deleted | Weeks of code activity shaped as a disc, dim to bright: icons/lune.svg without its tile. |
| src/components/brand-mark.tsx:16-17 | Decision Record | Moved to ADR 0001 D11 | The dark tile belongs to Windows surfaces (taskbar, Start, title bar). Cells light column by column once on mount; `busy` keeps them sweeping while a read runs. |
| src/components/context-menu.tsx:33-34 | Decision Record | Moved to ADR 0001 D11 | Targets only register actions and reuse their existing DOM element. The app has one menu store, one portal, and one set of positioning/dismissal listeners. |
| src/components/context-menu.tsx:128-129 | Excuse | Deleted; issue #2 | Keep the native editing/selection menu and bypass the library's document listener without cancelling the browser default. |
| src/components/elevated-confirm.tsx:16-20 | Decision Record | Moved to ADR 0001 D5 | Full-viewport blocking confirmation for elevated actions. The scrim covers the appbar and rail, outside presses and Escape do not dismiss it, and the confirm button stays disabled until the operator explicitly attests. |
| src/components/elevated-confirm.tsx:52-52 | Decision Record | Moved to ADR 0001 D5 | Escape must not dismiss (or bubble to) an elevated confirmation. |
| src/components/email-dialog.tsx:30-30 | Decision Record | Moved to ADR 0001 D6 | Puts the version paths right before the signature. |
| src/components/email-dialog.tsx:47-50 | Tautology | Deleted | Editable preview of the submission email: header fields persist, an optional second record can be appended (A/B builds), and paths are added on copy. |
| src/components/email-dialog.tsx:119-120 | Tautology | Deleted | Only when the dialog opens for a preselect. eslint-disable-next-line react-hooks/exhaustive-deps |
| src/components/review-dialog.tsx:60-64 | Decision Record | Moved to ADR 0001 D4 | SPM review workspace. Decisions are local until the operator saves them via a full-viewport elevated confirmation. The plan is always re-fetched when the dialog opens, so a changed record or baseline cannot reuse old checks. |
| src/components/review-dialog.tsx:134-134 | Decision Record | Moved to ADR 0001 D4 | Changing the artifact path/hash must re-open that artifact's review. |
| src/components/review-dialog.tsx:216-216 | Tautology | Deleted | Optional local preference. |
| src/components/self-test/checks-panel.tsx:52-52 | Decision Record | Moved to ADR 0001 D2 | New issues should surface even when the previous result was collapsed. |
| src/components/self-test/field.tsx:3-3 | Tautology | Deleted | A labelled form control; the visible label doubles as the accessible name. |
| src/components/ui/toast.tsx:35-35 | Tautology | Deleted | Fires a short status message from anywhere below <ToastProvider>. |
| src/components/ui/toast.tsx:103-107 | Decision Record | Moved to ADR 0001 D11 | Hosts transient confirmations ("saved", "copied") and actionable warnings ("review required"). Without the provider the hook is a no-op, so pages stay testable in isolation. |
| src/components/window-controls.tsx:12-14 | Decision Record | Moved to ADR 0001 D11 | Caption buttons for the undecorated window, sized like Windows 11's (46 px wide, the band's full height). Glyphs are 10 px strokes; close turns red on hover. They stay out of the tab order, as native caption buttons do; Alt+F4 and Win+arrows still work. |
| src/components/window-controls.tsx:18-19 | Decision Record | Moved to ADR 0001 D11 | The native Snap Layouts overlay covers the maximise button, so the page learns its hover and press from `caption-max` events instead of the pointer. |
| src/env.d.ts:1-1 | Directive | Retained (tool directive) | <reference types="vite/client" /> |
| src/env.d.ts:3-3 | Tautology | Deleted | Injected by Vite from package.json for browser previews. |
| src/hooks/useAdbEnv.ts:13-17 | Decision Record | Moved to ADR 0001 D7 | Owns the ADB environment snapshot, device selection and the silent refresh loop. The page passes in its long-running busy flag so polling stops during collection or record loading. |
| src/hooks/useAdbEnv.ts:66-66 | Decision Record | Moved to ADR 0001 D7 | Keep the last good snapshot; a background poll must not raise a toast. |
| src/hooks/useRecordBrowser.ts:6-6 | Tautology | Deleted | Search, filtering, grouping and multi-select for the record list. |
| src/hooks/useSelfTestCollection.ts:42-43 | Decision Record | Moved to ADR 0001 D7 | Initial scan uses the default ADB path. Later refreshes use the form value. eslint-disable-next-line react-hooks/exhaustive-deps |
| src/i18n.ts:16-16 | Decision Record | Moved to ADR 0001 D9 | Preferences are optional when storage is unavailable. |
| src/i18n.ts:58-58 | Decision Record | Moved to ADR 0001 D9 | Keep the in-memory preference. |
| src/preferences.ts:31-31 | Decision Record | Moved to ADR 0001 D9 | The choice still holds for this session. |
| src/selftest/checks.ts:29-29 | Decision Record | Moved to ADR 0001 D2 | Semantic tint for status badges; the Badge variants stay generic. |
| src/selftest/checks.ts:49-52 | Decision Record | Moved to ADR 0001 D6 | Plain-text internal GMS submission email. Values and checks come from the record; the optional baseline/diff sections are included when available. |
| src/selftest/checks.ts:174-177 | Decision Record | Moved to ADR 0001 D6 | Compact block for a second SKU/record. Used when one submission email covers A/B builds: the primary record keeps the full body, the others append this. |
| src/selftest/date.ts:1-1 | Tautology | Deleted | Local calendar date in YYYY-MM-DD, used for patch baselines and groups. |
| src/selftest/email-prefs.ts:12-12 | Decision Record | Moved to ADR 0001 D9 | Draft header values are reused between emails; they never leave this machine. |
| src/selftest/email-prefs.ts:34-34 | Decision Record | Moved to ADR 0001 D9 | Storage is optional; a blocked store must not break the draft. |
| src/selftest/errors.ts:9-9 | Decision Record | Moved to ADR 0001 D1 | Backend failures are structured objects; never render "[object Object]". |
| src/selftest/report.ts:51-51 | Decision Record | Moved to ADR 0001 D4 | Pick the most useful comparison record: same model code, then same serial. |
| src/selftest/report.ts:73-73 | Tautology | Deleted | Markdown for the clipboard, matching the exported report's structure. |
| src/selftest/report.ts:94-94 | Tautology | Deleted | Markdown for the version-diff clipboard action. |
| src/styles/motion.css:8-8 | Decision Record | Moved to ADR 0001 D11 | Base UI keeps the popup mounted until the ending transition completes. |
| src/styles/review.css:1-1 | Tautology | Deleted | --- review workflow ----------------------------------------------------- |
| src/styles/selftest.css:1-1 | Tautology | Deleted | --- Labelled fields, empty states and semantic status ------------------- |
| src/styles/selftest.css:272-272 | Tautology | Deleted | --- Workspace and dock ------------------------------------------------ |
| src/styles/selftest.css:702-702 | Tautology | Deleted | ——— guided flow: steps, collapsible meta, sticky next action ——— |
| src/styles/selftest.css:819-819 | Tautology | Deleted | ——— record comparison ——— |
| src/theme.ts:23-24 | Decision Record | Moved to ADR 0001 D11 | Apply synchronously: WebKitGTK exposes startViewTransition, but its callback is not guaranteed to run before the next paint. |
| src/theme.ts:29-29 | Tautology | Deleted | The choice still holds for this session. |
| src-tauri/src/bin/spm-selftest-cli.rs:1-1 | Tautology | Deleted | ! Script/automation entry point. The GUI and CLI share the same core in lib.rs. |
| src-tauri/src/bin/spm-selftest-cli.rs:32-32 | Tautology | Deleted | Check adb and connected devices. |
| src-tauri/src/bin/spm-selftest-cli.rs:39-39 | Tautology | Deleted | Collect a device and save a record. |
| src-tauri/src/bin/spm-selftest-cli.rs:61-61 | Decision Record | Moved to ADR 0001 D10 | Accepted for parity with scheduled scripts; this CLI never pauses. |
| src-tauri/src/bin/spm-selftest-cli.rs:65-65 | Tautology | Deleted | List saved records. |
| src-tauri/src/bin/spm-selftest-cli.rs:76-76 | Tautology | Deleted | Compare two records (A baseline, B target). |
| src-tauri/src/bin/spm-selftest-cli.rs:83-83 | Tautology | Deleted | Rename a record without changing its id. |
| src-tauri/src/bin/spm-selftest-cli.rs:90-90 | Tautology | Deleted | Show the SPM review plan and readiness for a record. |
| src-tauri/src/bin/spm-selftest-cli.rs:98-98 | Tautology | Deleted | Export one record. |
| src-tauri/src/bin/spm-selftest-cli.rs:109-109 | Tautology | Deleted | Export even when the record has not completed SPM review. |
| src-tauri/src/checks.rs:1-1 | Decision Record | Moved to ADR 0001 D1/D2 | ! IR/MR/SMR/LR submission checks. Pure functions so the GUI and CLI agree. |
| src-tauri/src/checks.rs:240-241 | Decision Record | Moved to ADR 0001 D3 | BaseOS is authoritative when the baseline has it; the fingerprint is only a fallback for older records. |
| src-tauri/src/lib.rs:1-1 | Tautology | Deleted | ! Shared self-test core used by both the Tauri GUI and the CLI. |
| src-tauri/src/review.rs:1-5 | Decision Record | Moved to ADR 0001 D4 | ! Manual SPM review plans, fingerprints and readiness rules. ! ! The plan is derived from the record, its checks and the current diff. Only ! decisions are persisted, keyed by stable item ids; every plan carries a ! fingerprint so a changed record cannot silently reuse old confirmations. |
| src-tauri/src/review.rs:320-322 | Decision Record | Moved to ADR 0001 D4 | The artifact item itself is confirmed in the dialog; its values are intentionally excluded so editing a path does not invalidate the already-reviewed checks and diff. |
| src-tauri/src/review.rs:433-434 | Tautology | Deleted | Validate submitted decisions against the freshly derived plan and return the normalized ledger to persist. |
| src-tauri/src/self_test/adb.rs:1-1 | Tautology | Deleted | ! ADB discovery, command execution and `adb devices` parsing. |
| src-tauri/src/self_test/adb.rs:57-57 | Tautology | Deleted | tokio's Command exposes creation_flags directly on Windows. |
| src-tauri/src/self_test/collector.rs:1-1 | Tautology | Deleted | ! getprop field extraction, DRM/list cleaning and summary projection. |
| src-tauri/src/self_test/collector.rs:98-99 | Decision Record | Moved to ADR 0001 D8 | The SoC fields need cross-property classification rather than a simple first-match lookup, so derive them from the whole getprop map. |
| src-tauri/src/self_test/diff.rs:1-1 | Tautology | Deleted | ! Baseline selection and record-to-record diffs. |
| src-tauri/src/self_test/exporter.rs:1-1 | Tautology | Deleted | ! Markdown, CSV and TXT4 export encoders. |
| src-tauri/src/self_test/storage.rs:1-1 | Tautology | Deleted | ! Local data directory, atomic index/record storage, naming and blobs. |
| src-tauri/src/self_test/storage.rs:19-19 | Decision Record | Moved to ADR 0001 D9 | Standalone data directory. SPM_SELFTEST_HOME points directly at it. |
| src-tauri/src/self_test/storage.rs:57-57 | Decision Record | Moved to ADR 0001 D9 | First run imports Maon's existing records once, then the app owns its data. |
| src-tauri/src/self_test/storage.rs:99-100 | Excuse | Deleted; issue #1 | Windows cannot rename over an existing file; the temp file is still complete before the old one is replaced. |
| src-tauri/src/self_test/storage.rs:158-158 | Decision Record | Moved to ADR 0001 D9 | Remove characters Windows forbids in file names and bound the length. |
| src-tauri/src/self_test/storage.rs:214-214 | Decision Record | Moved to ADR 0001 D9 | {model}_{type}_{build}_{YYYYMMDD} |
| src-tauri/src/self_test/storage.rs:312-313 | Decision Record | Moved to ADR 0001 D9 | Imported records from Maon predate the checks. Recompute and persist them once so the list can filter by check status without a manual recheck. |
| src-tauri/src/self_test/storage.rs:348-348 | Decision Record | Moved to ADR 0001 D9 | One-time migration from legacy flat `<id>.json` files into `records/` + `blobs/` + `index.json`. |
| src-tauri/src/self_test.rs:1-2 | Decision Record | Moved to ADR 0001 D9 | ! Device self-test collection, index+blob storage, diffing, and on-demand export. ! Collection never writes external files by default; all exports go through explicit user dialogs. |
| src-tauri/src/self_test.rs:23-23 | Decision Record | Moved to ADR 0001 D9 | Structured failures keep the UI localized; the optional message is for logs. |
| src-tauri/src/self_test.rs:73-73 | Tautology | Deleted | pass \| warn \| error |
| src-tauri/src/self_test.rs:342-342 | Decision Record | Moved to ADR 0001 D4 | The baseline is explicit when set; otherwise the newest same-model record. |
| src-tauri/src/soc.rs:1-7 | Decision Record | Moved to ADR 0001 D8 | ! SoC vendor detection shared by collection, review rules and the UI. ! ! Android exposes the chipset through a few overlapping properties. The ! canonical source is `ro.soc.manufacturer` / `ro.soc.model` on newer ! releases; older devices only expose a board platform or hardware name. ! We keep the canonical vendor in `soc_vendor` and the raw model/platform in ! `soc_model` so changing either invalidates a review through the normal diff. |
| src-tauri/src/soc.rs:44-44 | Decision Record | Moved to ADR 0001 D8 | Extract the canonical vendor and the most specific model name available. |
| src-tauri/src/soc.rs:133-133 | Decision Record | Moved to ADR 0001 D8 | Classify one or more raw values. Strong vendor names win over token rules. |
| src-tauri/src/soc.rs:178-180 | Decision Record | Moved to ADR 0001 D8 | Vendor for a record. Prefer the canonical collected field, then fall back to legacy per-field values. `vendor` is deliberately excluded: it is the vendor build version, not the chipset vendor. |
| src-tauri/tests/checks_boundaries.rs:1-1 | Decision Record | Moved to ADR 0001 D1 | ! Boundary tests for the IR/MR/SMR/LR compliance rules shared by GUI and CLI. |
| src-tauri/tests/cli_exit_codes.rs:1-2 | Decision Record | Moved to ADR 0001 D10 | ! Exit-code contract for automation: 2 is reserved for environment ! failures, so clap parse errors must surface as the documented usage code 5. |
| scripts/check-versions.mjs:2-2 | Decision Record | Moved to ADR 0001 D10 | Release versions live in three files; fail CI when they drift. |
| .github/workflows/ci.yml:18-19 | Decision Record | Moved to ADR 0001 D10 | The committed lockfile uses a China mirror; CI installs from the public registry and rewrites resolved hosts so runners are not mirror-dependent. |
| .github/workflows/ci.yml:86-86 | Decision Record | Moved to ADR 0001 D10 | generate_context! embeds frontendDist, and is compiled by clippy/test. |
## Counts

- Decision Record: 57
- Excuse: 2
- Stale: 0
- Tautology: 46
- Directive (exempt): 2
- Total blocks: 107
- Physical comment lines before deletion: 167
- Physical comment lines removed: 163
- Tool directives retained: 4
- Physical source lines at deletion: 15,697 → 15,534
