# Workout data model: design draft

This document is a design contract, **not an applied schema**. The current preview uses account-scoped browser local storage and name-based references. It does not yet implement these tables, durable UUIDs, synchronization, rotation, or Supabase workout persistence. Do not use the prototype as the only copy of important workout data.

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

`rotation_groups`: id, user_id, routine_id, name, last_performed_variant_id (nullable). Each group rotates independently; there is no global round 1/round 2. Members and their order are recorded in `rotation_options` (id, user_id, group_id, variant_id, position). The group and its variants must have the same owner, and the last-performed variant must be an option in that group. Require at least two options at the application/domain-operation level.

`routine_slots`: id, user_id, routine_day_id, position, optional label, and selection mode:

- `fixed`: references one default exercise variant.
- `rotation`: references a rotation group and selects the next option after its last actually performed option.
- `complement`: references a rotation group and selects the other option relative to the most recent performed choice. Initially this mode is **limited to groups with exactly two options**; a domain operation must enforce this, not silently guess for larger groups.

`routine_slot_alternatives`: id, user_id, slot_id, variant_id, position. Alternatives are suggestions, not a restriction: a user may select any available exercise during a session. A group must belong to the slot's routine, enforced by a composite relationship or a checked server operation.

Default rotation semantics: advance only when the relevant slot is completed with a variant belonging to its rotation group; use the variant actually performed. Skipping does not advance. If an unrelated variant is substituted, do not advance and show that the next suggestion is unchanged. Free workouts do not advance a routine rotation. A complement choice is derived from the same group's last actual selection; manual choices remain possible. Completing two linked slots concurrently requires conflict detection; never silently use last-write-wins.

## Cycles

`routine_cycles`: id, user_id, routine_id, started_at, closed_at, close_reason. Each routine remembers its own cycle. At most one open cycle per routine.

`cycle_days`: id, user_id, cycle_id, routine_day_id, day_name_snapshot, position_snapshot, status (`remaining`, `completed`, `skipped`), completed_session_id. A cycle's days are captured when it starts. Routine day edits take effect in the next cycle; exercise changes affect sessions started afterwards. Suggest the first remaining snapshot day. Repeating a completed day is allowed but doesn't change remaining days. Reset closes the current cycle rather than presenting skipped days as completed.

## Actual workouts

`workout_sessions`: id, user_id, optional routine_id/day_id/cycle_id, routine/day name snapshots, status (`in_progress`, `completed`, `abandoned`), started_at, finished_at, optional workout_date and notes. A free workout has no routine or cycle. The actual workout date is distinct from creation time.

`session_warmups`: id, user_id, session_id, title/description snapshots, position, checked.

`session_exercises`: id, user_id, session_id, optional planned slot and variant, performed variant, planned/performed names and equipment snapshots, source (`planned`, `substituted`, `added`), position, status (`pending`, `completed`, `skipped`), notes. An exercise is completed as a whole: for strength it records three sets or none. A free or extra exercise can reference the library without a slot. Capture enough plan context that later edits do not rewrite history.

`session_sets`: id, user_id, session_exercise_id, position (1–3), weight, weight_unit (`kg` initially), integer reps. UI presents one shared weight and three reps, with optional individual weight overrides; each set's actual weight is retained. The completion operation validates exactly three valid sets together.

`session_cardio`: session_exercise_id, user_id, duration minutes, speed km/h, incline degrees, optional distance and notes. Validate nonnegative numeric values and retain explicit units; degrees and percentage grade are not equivalent.

## Offline and sync contract

- Local writes first into IndexedDB, including in-progress sessions, an operation queue and last-known revisions. A service worker caches the shell independently of data.
- Changes carry stable IDs, a client operation ID and expected server revisions. Retries are idempotent; the server assigns authoritative monotonically increasing revisions/change cursors and tombstones. Client timestamps cannot be the ordering authority.
- Complete-session plus cycle and rotation updates must execute atomically via a checked, idempotent server operation. A rejected conflict leaves the local session and queued operation intact. Do not allow a partially advanced cycle.
- Fetch changes and tombstones by a durable cursor, scoped to the account. A conflict preserves both versions and pauses the conflicting operation; never silently overwrite. The precise transactional sync API, resolution UX and tests must be specified before enabling cloud writes.
- Demo data uses a separate local namespace. Before sign-out or switching accounts, warn about unsynced work. A cached session permits offline work after first online sign-in; syncing requires valid authentication.

## Implementation gates

Before applying migrations to a real project: implement and exercise the constraints and indexes above, RLS including cross-owner references, atomic/idempotent sync operations, and tests for two users, interrupted sync, stale revisions, tombstones and account switching. No live migrations are included or applied in this increment; this design is not a claim that the prototype has these safeguards.
