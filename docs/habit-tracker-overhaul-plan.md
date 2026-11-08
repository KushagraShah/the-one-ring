# Habit Tracker and mini-app separation: handoff plan

This records the owner's 2026-11-07 discussion and implementation approach. The owner reviewed phases 0–1 and later requested substantial interface improvements, then approved the revised local preview. On 2026-11-08 the owner reported applying migration 006 successfully and requested deployment as v0.4.0. Real-account security and recovery tests and deployed phone verification remain outstanding. Read `AGENTS.md`, `README.md`, `docs/setup.md` and `docs/supabase-migrations.md` before future work.

## Direction and sequence

The One Ring is a free, phone-first personal home for mini-apps. Habit Tracker will be a second mini-app, sharing the existing account, shell and appearance—not part of Workout Tracker or a separate service. The owner wants an implementation and UI overhaul of an old habit tracker, improving its features without copying a dense interface. No social features or push notifications are required. Installation as a PWA does not imply offline tracking.

The owner wants work grouped and locally reviewable in this order:

1. **Phases 0–1:** new branch, segregate the shared shell, workout code and Supabase responsibilities, and create only a Habit Tracker skeleton. Preserve workout behavior.
2. **Phases 2–4:** habit foundation, daily use, maintenance and historical behavior.
3. **Phase 5:** history, insights and completion.
4. **Several rounds of improvements**, informed by owner testing.
5. **Minor optimizations last.**

The aim is to finish all agreed changes. Provide local running builds for the owner to test at useful checkpoints rather than assuming visual or interaction quality. This sequence is not authorization to push, deploy publicly, tag, release, reset a database or apply SQL. Each push requires a version bump in both package files under `AGENTS.md`. The overhaul branch is `feature/habit-tracker-overhaul`; inspect Git state first and preserve existing work.

## Product baseline from the old tracker

This is what the owner described, not verified behavior in this repository; the old project's code and export format were not inspected. It describes a baseline for the overhaul, not a mandate to reproduce the old UI.

- A habit has a title, optional description and optional Done/Partial/Missed criteria, an active date range and a schedule. A fixed schedule selects at least one weekday. A flexible schedule selects eligible weekdays and a weekly target of one through seven, no larger than the eligible weekday count. End date cannot precede start date.
- At most one outcome per habit and local calendar date: Done (1 point), Partial (0.5), Missed (0, explicitly scored), or Skipped (neutral, excluded from performance). An unrecorded opportunity is not automatically Missed. Users can correct or clear outcomes, add notes after recording, undo an individual update and mark remaining eligible habits Done. Future dates cannot be logged.
- Users can navigate back and catch up on unlogged fixed-schedule habits; a seven-day grid supports corrections for habits shown on the selected date. Past and backfilled entries use the outcome criteria effective on their date. Criteria edits have a chosen effective date within the habit's range; earlier criteria remain available.
- Performance is `(Done + 0.5 × Partial) / (Done + Partial + Missed)`; Skipped and unlogged are excluded. No scored outcomes means no meaningful percentage. Fixed daily coverage counts all four recorded outcomes divided by fixed habits due. Flexible habits are separate from the fixed daily percentage and measured against their weekly target. The target considered so far is limited by eligible days available so far: a four-per-week habit has a one-day target on an eligible Monday. Partial contributes half a point.
- Users can view daily performance and coverage, weekly progress, monthly history, individual results and an eight-week trend. The old tracker prioritizes lower-performing habits in insights and has a workload signal comparing today's scheduled habits to recent logging. Make context and small sample sizes clear; the UI and prominence of those signals need review.
- Fixed success streaks count consecutive scheduled Done days; Partial breaks success but preserves engagement, Skip preserves engagement, and Missed or unlogged due days break both. Flexible streaks use completed weeks: meeting the point target is success and any credited progress is engagement. Weeks run Monday–Sunday; future, paused and out-of-range dates are not ordinary missed opportunities.
- Users edit and reorder habits, pause indefinitely or through a chosen date, resume, extend ended habits, and permanently delete a habit and its logs after confirmation. A timed pause includes the selected end date. JSON export is available in the old tracker; it does not describe import or restore. For the new app, reversible archive/end is a proposed safer alternative, not a reason to remove confirmed permanent deletion.

An existing Supabase email/password account should be reused. The old app's display name is not currently part of One Ring signup; a shared display name is optional future work, not a separate habit account requirement. One-time import from the old habit tracker is wanted **later**, outside this work; do not infer its format or implement an implicit migration.

## Target boundaries and safety

- Put workout domain, screens, state, persistence projection and backup handling under workout ownership; put the corresponding habit code under habit ownership. The shared shell owns account, launcher, appearance, generic navigation and genuinely shared infrastructure. `src/app/`, `src/shared/`, `src/workout/` and `src/habits/` are illustrative, not a prescribed framework. Avoid speculative plugins and mechanical moves that leave workout logic in the wrapper.
- `src/main.tsx` currently combines shared shell with workout state, screens and navigation. `src/online.ts` and `src/sync/workspace.ts` are workout-specific despite their location; `src/sync/` also includes older experimental sync code. Inventory callers and distinguish active from legacy before moving anything. The current top-level workspace gate loads workouts before the shell. Aim for independent mini-app loading and errors without losing pending-save, draft, sign-out or navigation protections.
- Supabase Auth is shared. Separate shared, active workout, habit and legacy responsibilities in code and database documentation. The current active online workout tables and RPCs already have workout-specific names and an independent revision; physical renames or new schemas are not required merely for appearance. Do not create speculative shared tables. An inventory is not permission to delete legacy tables.
- Workout writes replace the user's whole workout record set; adding habit records to that flow risks old clients or workout restores erasing them. Design habit storage and concurrency as an independent boundary, potentially with incremental log writes rather than assuming whole-workspace replacement. Require account isolation, RLS/permission review, atomic related changes, stale-edit detection, retry safety and explicit save/error feedback. Demo remains temporary and separate; account data remains online-only.
- Preserve all workout features, data, active sessions, historical order, old backups, existing online protocol and old-client safeguards. Extracting or reorganizing code must not silently redesign the workout workflow or migrate/reset data. Review old PWA/client compatibility before changing any format or protocol.
- The owner reports applying migrations 004 and 005; real Supabase isolation and guard behavior remain unverified. Manual SQL execution may not match migration history. Verify the target and state, test new SQL in a disposable project, and obtain the appropriate explicit action before applying it. Do not rerun existing migrations, reset the database or repair migration history without verification and authorization.

## Backup direction

Provide separate **workout**, **habit** and **full One Ring** manual backups. The owner wants them versioned by timestamp: put a timestamp in the filename and export metadata, for example `one-ring-workouts-2026-11-07T143000Z.json`. Also give the file format its own explicit schema version; timestamp and format version serve different purposes. Manual downloads do not guarantee retention or automated backup.

Restore must show scope, validate first, warn before replacement and preserve unrelated mini-apps. Existing workout-only backups must remain readable and must never erase habits. A habit-only restore must not touch workouts. A full backup includes both apps and relevant shared account data, if any. If a full restore spans separate server transactions, either implement and test a truly atomic cross-domain operation or clearly report per-app results and recovery; never claim all-or-nothing success without it. Retain revision/conflict handling and protect unsaved in-memory state. Do not include credentials.

## Proposed phases and checkpoints

### 0–1: branch, separation and skeleton

1. Inspect Git state, current implementation, relevant tests and migration/deployment status; establish a targeted baseline and create the requested new branch without discarding changes.
2. Extract the shared shell and move the remaining workout ownership into its own area. Preserve workout interactions, state, in-progress sessions, backup compatibility and save-failure behavior. Give each mini-app appropriate independent loading/error boundaries.
3. Inventory and document active/shared/legacy database responsibilities; choose a clear habit namespace. Do not rename existing tables or create speculative habit tables solely for a skeleton. Actual habit SQL can accompany the real model in Phase 2.
4. Add a navigable, clearly labeled Habit Tracker skeleton with no misleading working controls or fake functionality. Keep the existing workout backup working and label its scope; habit/full backup implementations can follow when there is habit data.
5. Verify targeted workout regression, navigation, active sessions, demo, persistence/error handling and old backup restore; run a suitable final build and phone-width browser checks. Start a local preview for owner review when requested. Real phone and live Supabase checks remain separate.

**Exit:** the owner can inspect the local shell and skeleton; workout behavior remains intact and the separation is substantive, not just renamed files.

### 2–4: foundation, daily workflow and maintenance

- Design habit-owned storage, schema and permissions, including account isolation, independently checked writes, idempotent retries and safe backup/restore. Build local calendar/date and schedule logic as independently tested functions. Represent stable habit IDs, outcomes, effective-dated criteria and pause intervals; settle historical schedule policy before implementing dependent behavior. Keep outcomes as facts rather than overwriting them with derived scores.
- Build fixed and flexible habit creation, validation, Today view, weekly flexible progress, record/change/clear/undo, notes, catch-up, date navigation, date-effective criteria and the seven-day correction view. Make four outcomes explicit and use labels as well as color. Bulk Done must state its scope and support undo.
- Add edit/reorder, pause/resume, extension, criteria editing, agreed historical schedule behavior, archive/end and confirmed deletion. Preserve records that no longer match a changed current schedule. Complete timestamped individual and full backups with accurately described restore guarantees.
- Make local builds available for owner checks during the group. A real account demonstration requiring SQL needs the verified target and reviewed migration; otherwise use a disposable project or a clearly labeled demo/test setup.

**Exit:** daily logging and correction, historical maintenance, and recovery work as agreed; open rule decisions have been resolved with the owner rather than silently assumed.

### 5: history, insights and completion

Implement the daily, weekly, monthly, per-habit and eight-week views, fixed and flexible streaks, insights and the workload signal with definitions agreed and sufficient context. Keep charts optional and readable on a phone. Test cross-app navigation, accessibility, long histories, date edges, isolation, conflicts, failure/retry and backup compatibility. Update docs and explicitly distinguish local/fake-server tests from real phone and Supabase verification.

Then conduct the owner's requested improvement rounds and, lastly, minor optimizations. Prefer measurement and actual interaction feedback over speculative performance work.

## Open decisions — do not silently settle

1. **Schedule changes and historical expectations:** On 2026-11-08 the owner chose a user-selected effective date. Earlier dates retain their prior schedules; choosing an earlier date allows correcting a mistake.
2. **Flexible targets, skips and pauses:** On 2026-11-08 the owner chose to exclude weeks affected by a pause or explicit skip from target-completion judgments rather than reduce the target. The target remains displayed, with the exclusion made visible. Monthly allocation and cross-month summaries remain phase 5 design work.
3. **UI details and scope:** Today-first, compact rows with expandable outcome/criteria/note controls, a separate management screen and secondary history are proposals for owner review. Avoid guilt-inducing or information-dense screens; preserve the excerpt's capabilities even if their presentation changes.

## Verification expectations

Unit-test calendar boundaries, local dates, eligible weekdays, partial weeks, pause inclusivity, effective criteria/backfills, outcome uniqueness, zero-denominator performance, coverage, streaks and all agreed edge cases. Test owner isolation, concurrency, lost-response retries, old-client safety, demo separation, pending saves, failed restores, backup round trips and cross-app non-interference. Use browser tests at phone width and actual owner phone review. PGlite and fake Supabase do not prove real Supabase isolation, Android behavior or recovery. Keep real-device and live-service results explicitly recorded rather than assumed.
