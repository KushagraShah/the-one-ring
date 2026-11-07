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

## 2026-11-07 — v0.2.0 deployment

- Pushed commit `3eaa7c3` and annotated tag `v0.2.0`; GitHub Actions run `42377464593` completed successfully, and the Pages site returned HTTP 200 with the expected production assets. The local release checks listed above passed. No Supabase migration was run.
- A GitHub Release page was not present when checked. GitHub CLI was unauthenticated, so creating that separate page requires authentication. Follow-up documentation may trigger another Pages deployment; check its status separately. Real Android/offline testing, live sync isolation/conflict testing and backup recovery remain outstanding.

## 2026-11-07 — Experimental automatic sync

- Added automatic in-app sync after explicit setup, reconnect/foreground retries, visible status, and deferred cloud imports during workouts and editing. Incremental projections retain the revision the UI saw; conflict resolution checks local generations and transport pins each request to the verified account session. Added a local workout-completion journal and recovery gate for related workout/cycle writes.
- Verified build, config/schema/history and service-worker tests; Chromium at phone width exercised demo navigation, IndexedDB, and setup, automatic upload, offline retry, conflict resolution, repeated in-session changes and workout completion against a fake Supabase server. This is not a live Supabase, two-device or Android test.
- Sync is still experimental: localStorage and the IndexedDB queue are not a single transaction, most multi-key operations lack a journal, and concurrent tabs are not locked. Browser storage failures, upgrades, two-user isolation, phone/PWA offline restart and backup recovery need real-world verification. No deployment or database migration was performed.

## 2026-11-07 — Sync library research

- The owner confirmed no personal workout records are in use and the current state is reversible; updated `AGENTS.md` without implying permission to delete accounts or reset the database.
- Investigated RxDB's free Dexie storage and Supabase replication, and PowerSync's Supabase integration. RxDB is directly connected and free but atomic at the document level, and its default replication conflict handler discards the local version. PowerSync uses local SQLite and an upload queue but requires an additional service and Supabase connection; its free service can deactivate after inactivity. Neither can be substituted without addressing workout-cycle atomicity, conflicts, and the existing backend protocol.
- No database, deployment, dependency or sync implementation was changed in this research step. The previously uncommitted automatic-sync work remains local and unverified against real Supabase and devices.

## 2026-11-07 — Repeatable sync browser test

- Added a Playwright test using a fake Supabase endpoint and isolated authentication, covering the existing local preview's automatic upload, failed offline request, reconnection, conflict and explicit resolution at phone viewport width. Added setup instructions and ignored test output.
- `CHROMIUM_PATH=/snap/bin/chromium npm run test:browser`, `npm run build`, and `git diff --check` passed. RxDB 17.6.0's current transitive GraphQL and z-schema packages advertise Node 22 despite the app and RxDB declaring Node 20 support; RxDB was not retained as a dependency. The requested RxDB migration, new Supabase security SQL, and live/Android validation are not implemented. No database or deployment changes were made.

## 2026-11-07 — RxDB prototype, not integrated

- Added RxDB 17.6 with a Dexie-backed atomic workout-workspace prototype, conflict-alternative preservation, a Supabase replication wrapper, and draft owner-scoped SQL migration 003. Moved the declared Node and Actions requirements to 22 because RxDB dependencies require it. Added local RxDB, simulated replication and PGlite RLS tests.
- The actual app still uses the previous localStorage/IndexedDB sync; the prototype is not connected to its UI or status, and conflict resolution and real Supabase/device testing are incomplete. Migration 003 is a draft and **must not be applied yet**. No deployment or database changes were made.
- Under Node 22, `npm run build`, `npm run test:history`, `npm run test:schema`, `npm run test:config`, `npm run test:pwa`, and `CHROMIUM_PATH=/snap/bin/chromium npm run test:browser` passed, as did `git diff --check`. The browser test still exercises only the old sync path.

## 2026-11-07 — Architecture review for owner

- Reviewed the local UI, workout model, sync protocol, SQL, RxDB prototype and test boundaries; wrote a temporary, Git-ignored walkthrough and findings under `architecture-review.local/`. No app implementation, database migration or deployment was changed. The owner is considering online-only until an offline design is convincingly demonstrated.
- `npm run test:config` (4), `npm run test:schema` (3), `npm run test:history` (50), and `git diff --check` passed on Node 20.20.2, which is below the declared Node 22 minimum; these do not replace a supported-runtime build, browser tests or real-device/live-Supabase validation. Latest Pages workflow was successful; pre-existing local changes remain uncommitted. Migration 003 remains a disconnected draft and must not be applied yet.
