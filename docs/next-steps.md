# Next steps

- **Activity and history:** Review the proposal in [activity and history plan](activity-history-plan.md) with the owner before implementing the interaction or data-model changes. Exact-variant progress and trustworthy planned-versus-performed history come first.
- **Online-only storage:** Supabase remains the source of truth for accounts; demo is in memory. The owner considers the earlier storage-validation step complete and reported successfully exporting, deleting a routine day and restoring. This does not independently establish which two-account, conflict or failure scenarios were tested; avoid making broader verification claims.
- **Manual backups:** Keep manual JSON export/restore; automatic Drive and email backups are deferred. Preserve old backups and avoid database resets or rerunning manually applied migrations. See [setup](setup.md) and [migration runbook](supabase-migrations.md).
- **Phone interaction and code organization:** Continue these alongside feature work, without speculative plugin infrastructure. More interaction tests should cover routines, cycles and history changes.
