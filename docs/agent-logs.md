# Agent logs

Brief, append-only task summaries for future sessions. Record changes, verification and meaningful limitations; never include secrets or personal workout data.

## Project history through 2026-11-07

- Established the product direction: a free, mobile-first home for independent mini-apps, beginning with Workout Tracker and potentially integrating an existing habit tracker later. Preserved the useful parts of the owner's Notion workflow without copying its dense, rigid interface.
- Built the early React/TypeScript/Vite app shell, Supabase email/password authentication, isolated demo mode, dark accent themes, exercise library, routine builder, workout logging, paired rotations, local backup and basic history/stats. The owner reports that workout tracking works minimally but wants further interaction research and improvement.
- Added an experimental manual sync path with an IndexedDB queue, per-record version checks and conflict handling; a service worker and install icons cache the production shell. Local tests cover configuration, schema/RLS patterns, workout logic, sync simulations and the worker shell. These checks do not establish real-device offline safety or full live two-user isolation.
- The owner applied both initial migrations manually to the main Supabase project. Anonymous sync-table and RPC access were denied; the owner reports that an initial sync appeared to work. Supabase's GitHub integration was later removed after an attempt to create an already existing table. Manual SQL and migration history may differ; don't rerun existing migrations or reset the database without investigation.
- Deployed commit `7c53a27` to GitHub Pages and published annotated tag `v0.1.0` as a stable-ish early baseline. GitHub Actions reported success and the site returned HTTP 200 when checked on 2026-11-07. `v0.1.0` is not a claim that the app is complete.
- Updated the human README, setup/migration/data-model docs and `AGENTS.md` to reflect project context, owner preferences, current verification and ongoing agent responsibilities. Initialized this log. No app code or infrastructure was changed in this documentation task.
