# Agent logs

Brief, append-only task summaries for future sessions. Record changes, verification and meaningful limitations; never include secrets or personal workout data.

## Project history through 2026-11-07

- Established the product direction: a free, mobile-first home for independent mini-apps, beginning with Workout Tracker and potentially integrating an existing habit tracker later. Preserved the useful parts of the owner's Notion workflow without copying its dense, rigid interface.
- Built the early React/TypeScript/Vite app shell, Supabase email/password authentication, isolated demo mode, dark accent themes, exercise library, routine builder, workout logging, paired rotations, local backup and basic history/stats. The owner reports that workout tracking works minimally but wants further interaction research and improvement.
- Added an experimental manual sync path with an IndexedDB queue, per-record version checks and conflict handling; a service worker and install icons cache the production shell. Local tests cover configuration, schema/RLS patterns, workout logic, sync simulations and the worker shell. These checks do not establish real-device offline safety or full live two-user isolation.
- The owner applied both initial migrations manually to the main Supabase project. Anonymous sync-table and RPC access were denied; the owner reports that an initial sync appeared to work. Supabase's GitHub integration was later removed after an attempt to create an already existing table. Manual SQL and migration history may differ; don't rerun existing migrations or reset the database without investigation.
- Deployed commit `7c53a27` to GitHub Pages and published annotated tag `v0.1.0` as a stable-ish early baseline. GitHub Actions reported success and the site returned HTTP 200 when checked on 2026-11-07. `v0.1.0` is not a claim that the app is complete.
- Updated the human README, setup/migration/data-model docs and `AGENTS.md` to reflect project context, owner preferences, current verification and ongoing agent responsibilities. Initialized this log. No app code or infrastructure was changed in this documentation task.

## 2026-11-07 — Focused workout flow

- Added a next-day/first-exercise summary, focused workout entry, recent exact-variant results, editable setup, shared-weight stepper and rep presets, saved/locked result editing, and automatic finishing when all exercises are completed or skipped. Latest workout results and notes can be edited after automatic completion; substitutions retain their planned identity going forward. Existing two-day rotations now support more than two ordered options. Added focused session logic and tests, and updated the handoff and setup/data-model documentation.
- Verified `npm run build`, `npm run test:history`, `npm run test:schema`, `npm run test:config`, and `npm run test:pwa`; these do not verify the actual phone UI or live Supabase. GitHub CLI is unavailable; no deployment or migrations were performed.
- Automatic/offline sync, robust storage/atomicity, complete domain modularization, cycle history, routine reordering and real-device testing remain unfinished. The existing experimental sync is still manual. Unconfirmed result edits are transient; older app builds cannot read rotations with more than two options. Export backups and update all devices before using them.

## 2026-11-07 — Preview and Git tooling check

- Started the existing local production preview for the owner's review; no application code, deployment, authentication or remote configuration was changed. Confirmed Git is available in WSL, while `gh` is not on the current shell's PATH; GitHub CLI is optional for ordinary Git operations. The owner prefers to consider SSH later.
- Verified the prior workout task's handoff, setup and data-model documentation and log entry are present as uncommitted changes. The preview has not been reviewed on a phone and the experimental sync limitations remain.

## 2026-11-07 — Workout review feedback

- Added previous/skip/next session navigation, a clearly today-only exercise addition, multiline setup editing, readable recent results, spinner-free weight input and explicit leave/resume/cancel actions. Routine edits and slot-level rotation setup now use an explicit draft/save flow; new routine creation is separately confirmed. Added Workout Tracker navigation and moved workout components, model, backup and rotation code under `src/workout/` without changing storage keys or the sync protocol.
- Added cycle-day mapping and server-rendered UI smoke tests. `npm run build`, `npm run test:history`, `npm run test:schema`, `npm run test:config`, `npm run test:pwa` and `git diff --check` passed. The local preview returned HTTP 200. GitHub CLI is installed but not authenticated, so the latest deployment could not be checked; no commit, push, deployment or migration was made.
- Browser interaction and phone testing remain outstanding; the smoke tests do not exercise UI events. Builder drafts and unconfirmed results are not crash-durable, saving a routine draft while a workout is active is blocked, and the previous experimental manual sync and offline limitations remain. Workout-specific shell and sync wiring has not yet been fully separated.

## 2026-11-07 — Session navigation refinement

- Spaced and renamed the log action, moved and clarified today-only replacement, made skipping advance while preserving undo, and labeled last-to-first navigation. Extracted session-only add/replace/skip operations and added tests covering navigation, completion, and unchanged routine snapshots.
- `npm run build`, `npm run test:history`, `npm run test:pwa`, and `git diff --check` passed. Browser interaction and phone verification remain outstanding; the local preview is not deployed. GitHub CLI is installed but unauthenticated, so deployment status was not checked. Experimental sync remains manual.

## 2026-11-07 — Routine builder and shared exercise cycles

- Simplified routine building with collapsible days, a nearby sticky save control, routine switching/creation, inline exercise-cycle editing, and cancellation of an active workout without discarding the draft. Added themed confirmations for builder actions and major workout navigation, and made Workout, Build routine and Activity peer navigation items. Exercise cycles now share ordered remaining-variant progress across one or more days, including out-of-order overrides; existing two-day rotations retain their next primary suggestion.
- `npm run build`, `npm run test:history`, `npm run test:schema`, `npm run test:config`, `npm run test:pwa`, and `git diff --check` passed. Added rotation/progress and backup tests. The local preview returned HTTP 200; UI event behavior and Android were not tested. GitHub CLI is not authenticated, so deployment status was not checked. No commit, push, deployment or migration occurred.
- Progress is committed on workout finish rather than at each exercise tick; cancelling leaves it unchanged. Older app builds do not understand the new cycle semantics. Some browser-native prompts remain in workout, backup and sync paths. Sync remains experimental and manual; update all devices and export a backup before relying on the changed cycle data.

## 2026-11-07 — Builder and library organization

- Cleaned the builder breadcrumb and routine/new-routine controls, aligned slot actions, added draft-only exercise ordering, and explained the effect of cycle-day selections. Added optional library tags, search/filter and reversible archive without deleting routines or history. Documented archive scope and outstanding limitations.
- `npm run build`, `npm run test:history`, `npm run test:pwa` and `git diff --check` passed, including order, cycle-day explanation and backup validation tests. Browser/phone interaction and live sync of tags are unverified. GitHub CLI remains unauthenticated; no deployment or migration was performed.

## 2026-11-07 — Choosing a cycle variant

- Added a dedicated cycle-variant selector during workouts. Choosing and completing a member retains cycle linkage; ordinary replacements and extras explicitly do not count, including when the exercise is also a member. Preserved planned identity and existing in-progress sessions; documented that old replacements cannot be distinguished retrospectively.
- `npm run build`, `npm run test:history`, `npm run test:pwa` and `git diff --check` passed, including cycle selection, skips, ordinary replacement, extras and rendered controls. Real browser/phone interaction and live sync remain unverified. Cycle progress is still committed when the workout finishes, not at the exercise tick; sync remains manual. No deployment or migrations were performed.

## 2026-11-07 — v0.2.0 release preparation

- Prepared the owner-approved workout workflow preview as `v0.2.0`, updated the package versions and release notes, and recorded the owner's next priorities and additional recovery, data-fidelity, testing and migration-safety follow-ups in `docs/next-steps.md`.
- `npm run build`, `npm run test:config`, `npm run test:schema`, `npm run test:history`, `npm run test:pwa`, and `git diff --check` passed locally. The prior `main` deployment was successful; the new deployment and release still require confirmation. GitHub CLI was not authenticated at preparation time.
- This remains an early preview: cloud sync is experimental and manual, phone/offline behavior and real Supabase isolation are not fully verified, and older clients do not understand the new exercise-cycle semantics. Export backups and update devices. No database migrations were run.
