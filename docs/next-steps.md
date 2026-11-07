# Next steps after v0.2.0

**Updated direction, 2026-11-07:** The owner chose online-only Supabase-authoritative account data, not offline sync. The owner reports applying migration 004; live behavior has not been verified. Demo is in memory and resets on refresh. Preserve branch `preserve/rxdb-offline-work` (`e3163ca`). Before applying any SQL or resetting a project, verify its target and scope. The priorities below are historical context where they mention offline sync.

The owner wants to work next on these areas. This is a direction, not a claim that the work has been designed, implemented or verified.

1. **Offline and cloud sync:** Design a shared local-first foundation around workout data semantics. Make syncing automatic and visible without interrupting training; preserve conflicts, pending edits and account isolation. Verify with real Supabase users and devices, including interrupted sync and account switching. The current sync is experimental and manual.
2. **Activity and progress:** Improve workout and exact-variant history, and explore useful charts without comparing different machines or inventing a composite score. Keep the current simple history accessible.
3. **Phone testing:** Test real Android/PWA installation, offline restart and recovery, navigation, data entry and accessibility on a phone. Local service-worker tests and desktop preview are not substitutes.
4. **Code efficiency and organization:** Continue separating Workout Tracker domain and screens from shared account, storage and sync infrastructure. Avoid speculative plugin abstractions and preserve data and existing behavior.

Additional safety and product follow-ups:

- **Backup and recovery:** Test export/restore, storage failures and recovery across browser/device changes before relying on sync as the only copy. Verify upgrade behavior between old and new clients, particularly changed exercise-cycle semantics.
- **Workout data fidelity:** Complete planned-versus-performed snapshots, routine-cycle and skipped-day history, and robust stable-ID use. Review how and when exercise-cycle progress is committed, including cancelling or editing a session.
- **Interaction and integration tests:** Add browser-level coverage for routine drafts, cycle variants, automatic workout completion, account separation and conflict resolution. Existing rendered-HTML smoke tests do not exercise UI interactions.
- **Migration discipline:** Before any backend migration, verify the target Supabase project's actual schema and migration history; the original migrations were run manually and must not simply be rerun.
