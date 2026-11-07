# Workout data model: design draft

This document describes the target normalized design. Two SQL migrations and local schema/sync tests now exist; see [the migration runbook](supabase-migrations.md). The owner reports applying both migrations to the main project and that an initial sync appeared to work. The preview has experimental manual synchronization using account-scoped IndexedDB and separate JSON sync records; it does not yet use the normalized tables or automatically sync in the background. Broader live sync, isolation, and offline testing remains. Do not use the prototype as the only copy of important workout data.

## Ownership and identity

All records listed below have client-generated UUIDs and an immutable `user_id` referencing `auth.users`. A reference between user-owned records must include the owner in its foreign key or be validated server-side; checking only the referencing row's `user_id` is insufficient. Every table needs RLS for select, insert, update, and deletion (or a tombstone operation). Tests must use two authenticated users and attempt forged cross-owner references.

Archive exercise variants and routines instead of destroying referenced historical data. IDs—not mutable names—identify exercises. Store name/equipment snapshots in sessions for readability after edits. Application-level checks cannot replace server constraints.

## Platform

`user_preferences`: `user_id` (primary key), theme, timestamps. This is shared infrastructure; other mini-apps own their own domain tables.

## Exercise library

`exercise_variants`: id, user_id, name, equipment description, tracking type (`strength`, `cardio`), setup notes, instructions, optional informational muscle/role/category, archived_at, timestamps.

`exercise_links`: id, user_id, variant_id, title, URL, position. Links use an HTTP(S) scheme; external videos require connectivity. One variant can be used in multiple routines while retaining one performance history.

## Routine and individual rotation

`routines`: id, user_id, name, description, active flag, archived_at. At most one active routine per user; a partial unique index enforces this.

`routine_days`: id, user_id, routine_id, name, description, position, archived_at.

`routine_warmups`: id, user_id, routine_day_id, title, description, position.

`rotation_groups`: id, user_id, routine_id, name, and progress through an ordered set of variants. Each group rotates independently; there is no global round 1/round 2. Members and their order are recorded in `rotation_options` (id, user_id, group_id, variant_id, position). The normalized schema needs revision to retain the remaining variants rather than only the last-performed variant. The group and its variants must have the same owner. Require at least two options at the application/domain-operation level.

`routine_slots`: id, user_id, routine_day_id, position, optional label, and selection mode:

- `fixed`: references one default exercise variant.
- `rotation`: references a rotation group shared by one or more days and suggests the first remaining option. The user may override it.

`routine_slot_alternatives`: id, user_id, slot_id, variant_id, position. Alternatives are suggestions, not a restriction: a user may select any available exercise during a session. A group must belong to the slot's routine, enforced by a composite relationship or a checked server operation.

Default rotation semantics: completing a member selected through the cycle slot from any linked day accounts for that variant. If A is done and C is chosen before B, B remains the next suggestion; once all members are accounted for, start a fresh pass. Repeating an already-accounted member, skipping, an ordinary replacement or an extra does not advance it, even if that exercise is a member. The current local implementation commits progress when the workout finishes; cancelling does not advance it. Completing linked slots concurrently requires conflict detection; never silently use last-write-wins.

## Cycles

`routine_cycles`: id, user_id, routine_id, started_at, closed_at, close_reason. Each routine remembers its own cycle. At most one open cycle per routine.

`cycle_days`: id, user_id, cycle_id, routine_day_id, day_name_snapshot, position_snapshot, status (`remaining`, `completed`, `skipped`), completed_session_id. A cycle's days are captured when it starts. Routine day edits take effect in the next cycle; exercise changes affect sessions started afterwards. Suggest the first remaining snapshot day. Repeating a completed day is allowed but doesn't change remaining days. Reset closes the current cycle rather than presenting skipped days as completed.

## Actual workouts

`workout_sessions`: id, user_id, optional routine_id/day_id/cycle_id, routine/day name snapshots, status (`in_progress`, `completed`, `abandoned`), started_at, finished_at, optional workout_date and notes. A free workout has no routine or cycle. The actual workout date is distinct from creation time.

Warmup tracking is not required for the owner's normal workout and should not interrupt the workflow. The early relational draft includes `session_warmups`, but no checklist is needed in the current workout UI.

`session_exercises`: id, user_id, session_id, optional planned slot and variant, performed variant, planned/performed names and equipment snapshots, source (`planned`, `substituted`, `added`), position, status (`pending`, `completed`, `skipped`), notes. An exercise is completed as a whole: for strength it records three sets or none. A free or extra exercise can reference the library without a slot. Capture enough plan context that later edits do not rewrite history.

`session_sets`: id, user_id, session_exercise_id, position (1–3), weight, weight_unit (`kg` initially), integer reps. UI presents one shared weight and three reps, with optional individual weight overrides; each set's actual weight is retained. The completion operation validates exactly three valid sets together.

`session_cardio`: session_exercise_id, user_id, duration minutes, speed km/h, incline degrees, optional distance and notes. Validate nonnegative numeric values and retain explicit units; degrees and percentage grade are not equivalent.

## Offline and sync contract

- Target: local writes first into IndexedDB, including in-progress sessions, an operation queue and last-known revisions. Currently the UI writes localStorage first and mirrors a sync projection asynchronously to IndexedDB. A service worker caches the shell independently of data.
- Changes carry stable IDs, a client operation ID and expected server revisions. Retries are idempotent; the server assigns per-record revisions and tombstones. The experimental client reads all records with pagination on each manual sync; a durable incremental change cursor is not implemented. Client timestamps are not the ordering authority.
- Complete-session plus cycle and rotation updates must execute atomically via a checked, idempotent server operation. A rejected conflict leaves the local session and queued operation intact. Do not allow a partially advanced cycle.
- Target: fetch changes and tombstones by a durable cursor, scoped to the account. The experimental implementation instead fetches all records with pagination. Conflict detection and explicit local/cloud resolution exist, with local tests, but need real-device and multi-user verification. Never silently overwrite conflicts.
- Demo data uses a separate local namespace. Before sign-out or switching accounts, warn about unsynced work. A cached session permits offline work after first online sign-in; syncing requires valid authentication.

## Implementation gates

The normalized migration is read-only; the second migration implements the experimental JSON-record sync RPC. The owner reports applying both to the main project. Before trusting the backend with workout records: verify real Supabase RLS and two-user isolation, strengthen domain validation and backup recovery, and test real-device offline restarts, interrupted sync, stale revisions, tombstones and account switching. Local PGlite and fake IndexedDB tests are not a replacement for those checks.
