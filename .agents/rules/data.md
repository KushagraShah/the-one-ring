# Data rules

Supabase is authoritative. Active account stores are each mini-app's `online.ts`; inspect their current protocol before changing persistence. Keep owner checks, stale-revision rejection and stable operation IDs and request bodies after an uncertain response. Save errors/conflicts retain unsaved memory for recovery. Do not treat drafts as crash-durable or pagination as a reduction in whole-workspace fetching.

Each app saves atomically within its own workspace. Full restore spans separate writes and can partially complete. Preserve backup formats, validation and unrelated app data. Username/avatar are Auth metadata outside app backups and workspace revisions. Demo data stays separate and resets on refresh; never import it or old local data implicitly. Retained `src/workout/legacy-sync/` is inactive and must not be activated as a side effect.

The service worker caches the shell, not account data. Update activation and reload are user-controlled and both guarded against drafts, pending saves and demo loss. Preserve these guards.

Before SQL work, read `docs/supabase-migrations.md`; recipe installation also needs `docs/recipe-book-supabase.md`. Verify the target and actual schema. Existing-project migration status and installation evidence live in those runbooks. Do not infer missing SQL from migration history, reset databases, repair history or enable automatic migration application by assumption. Pages deploys frontend only.

Keep format downgrade guards. Inspect domain validators and current app behavior before compatibility changes. SQL installation, PGlite, simulated transport and browser mocks establish different evidence from live signed-in persistence, isolation or recovery; record specific outcomes accurately.

Only public Supabase URL and `sb_publishable_…` keys belong in Vite configuration. Never place privileged keys, passwords, tokens or personal backup contents in bundles, Git or logs. Live Auth configuration and integrations require task authorization.
