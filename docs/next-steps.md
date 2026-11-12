# Next steps

The owner is using a test account and will continue app verification and minor improvements through normal use, in parallel with planning the next mini-app. The app remains a development preview, not yet verified as a dependable home for important data. See [product vision](product-vision.md) for the longer-term direction; ideas there are not approved specifications or a committed build order.

## Foundation and current apps

- **Real-account safety:** Real Supabase two-account isolation, stale-edit conflicts, failed saves and recovery for both trackers remain unverified. The owner previously reported successfully exporting, deleting a workout routine day and restoring it; do not infer broader test coverage. Use the [safe verification outline](supabase-migrations.md#real-account-verification-outline) when appropriate. Demo and fake-server tests do not establish live behavior.
- **Signup:** Signup stays open during development; the owner is still using a test user. Email confirmation was enabled in the 2026-11-11 dashboard screenshot. Live signup, email delivery and redirect behavior are unverified. Review signup availability later, not as an immediate task; do not change dashboard settings without the owner's decision.
- **Workout and habit feedback:** Follow the owner's ongoing usage feedback. Improve workout insights and interaction where useful, and expand automated coverage for routines, cycles and history when changing them. Preserve date-effective habit rules, scores, intentional skips, revision checks and recovery. See [workout direction](workout-comparison-and-direction.md) and [habit comparison](habit-tracker-comparison.md).
- **Updates:** The stale-shell fix passed a synthetic production-browser test, but the phone's exact prior failure cause, real Android update behavior and signed-in draft/save protection remain unverified. See [setup](setup.md).
- **Performance and organization:** Profile representative use before treating performance as a bottleneck. Whole-workspace serialization and writes, further state/UI decomposition, save-coordinator deduplication and CSS organization are possibilities, not established priorities. Preserve revision checks, retry identity and recovery.
- **Backups and migrations:** Manual export/restore remains available; automatic Drive/email backups are deferred. Do not reset databases or rerun manually applied migrations. Migration 006 was reported applied; see the [migration runbook](supabase-migrations.md).

## Next mini-app and longer term

- **Choose the next useful app with the owner.** Explore its workflow and data needs first; no specific next app is approved. A sensitive app or external integration needs an explicit security and permissions design before implementation. Share infrastructure only where actual needs justify it, without a speculative plugin platform.
- **Potential future projects:** A product/security charter, family sharing and social boundaries, integrations and infrastructure evolution are described in [product vision](product-vision.md); none is an immediate commitment.
- **Onboarding and help:** Consider an optional first-signup tutorial and contextual Habit Tracker help when the app is more mature. Design dismissal, replay and accessibility before building the tutorial.
