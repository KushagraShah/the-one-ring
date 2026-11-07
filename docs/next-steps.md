# Next steps after v0.2.0

The owner wants to work next on these areas. This is a direction, not a claim that the work has been designed, implemented or verified.

1. **Offline and cloud sync:** The local development version adds experimental automatic sync and recovery protections. Verify real Supabase users and devices, interrupted sync, account switching, conflict resolution and backup recovery before relying on it. The UI and sync queue are still separate storage systems; further local atomicity and cross-tab safety work remains.
2. **Activity and progress:** Improve workout and exact-variant history, and explore useful charts without comparing different machines or inventing a composite score. Keep the current simple history accessible.
3. **Phone testing:** Test real Android/PWA installation, offline restart and recovery, navigation, data entry and accessibility on a phone. Local service-worker tests and desktop preview are not substitutes.
4. **Code efficiency and organization:** Continue separating Workout Tracker domain and screens from shared account, storage and sync infrastructure. Avoid speculative plugin abstractions and preserve data and existing behavior.

Additional safety and product follow-ups:

- **Backup and recovery:** Test export/restore, storage failures and recovery across browser/device changes before relying on sync as the only copy. Verify upgrade behavior between old and new clients, particularly changed exercise-cycle semantics.
- **Workout data fidelity:** Complete planned-versus-performed snapshots, routine-cycle and skipped-day history, and robust stable-ID use. Review how and when exercise-cycle progress is committed, including cancelling or editing a session.
- **Interaction and integration tests:** Add browser-level coverage for routine drafts, cycle variants, automatic workout completion, account separation and conflict resolution. Existing rendered-HTML smoke tests do not exercise UI interactions.
- **Migration discipline:** Before any backend migration, verify the target Supabase project's actual schema and migration history; the original migrations were run manually and must not simply be rerun.
