# Setup and current limitations

## Local development

Use Node.js 20 or newer. Copy `.env.example` to `.env.local` and fill in the Supabase project URL and **publishable** key from the Supabase project's Connect/API Keys settings. `.env.local` is ignored by Git. Run `npm install` followed by `npm run dev`, then open the URL printed by Vite. Restart Vite after changing environment variables. `npm run build` checks TypeScript and creates the production bundle; `npm run preview` serves that bundle locally. `npm run test:config` checks deployment configuration validation.

## Supabase authentication

Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in `.env.local`. Only the current `sb_publishable_…` key format is supported; secret/service-role keys and legacy JWT keys are rejected. If configuration is missing or invalid, sign-in is disabled with a clear message and demo mode remains available.

These values are public browser configuration: Vite embeds `VITE_` values in the downloadable website even if they are stored as GitHub Secrets. Never put a Supabase secret/service-role key, database password, or access token in a `VITE_` variable. Database tables must be protected with RLS, not by hiding the publishable key.

In the Supabase dashboard, enable email/password authentication. Under Auth URL settings, set the Site URL to the deployed URL and allow redirect URLs for the deployed app and local preview (for example, `http://localhost:5173/`). Check email confirmation settings and delivery limits. The owner can disable signup after onboarding and temporarily enable it for a trusted user. First sign-in requires connectivity.

**Authentication alone is not workout sync.** The current preview stores workout data in this browser, separately for each account and the demo. Experimental manual cloud sync is available in Settings; the owner reports applying both migrations to the main Supabase project, but authenticated sync and Android behavior have not yet been verified. Local browser data can be cleared or evicted; export a backup. Don't rely on it as the sole copy of important data.

## GitHub Pages

The workflow in `.github/workflows/deploy.yml` builds and deploys pushes to `main`. In repository settings, select **GitHub Actions** as the Pages source. Under **Settings → Secrets and variables → Actions**, add repository variables (or secrets if preferred) named `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`, using the same public values as local development. The workflow reads a secret first if both exist under the same name, otherwise the variable. Add the configuration **before pushing or rerunning** the workflow; it fails early and leaves the previous deployment in place if configuration is missing or invalid. A change to a variable or secret requires a new workflow run to rebuild the static site.

The expected URL is `https://kushagrashah.github.io/the-one-ring/`; add it to Supabase's redirect allow list and check the Pages deployment workflow. The relative Vite base supports the project path and local preview.

## Current preview

The app has demo mode, accent colors, an exercise library and multiple local routines, balanced day suggestions, paired exercise rotations, three-set strength and cardio logging, basic workout/exercise history, and local JSON export/restore. Backups receive structural validation before restore, but recovery under storage failures and browser/device changes has not been tested end to end. The sample routine and initial demo progress are illustrative. New history records use stable exercise IDs; older name-based records are linked when an exercise is renamed. This local migration still needs wider real-world testing, and older ambiguous names cannot be recovered automatically.

To create a paired rotation, open **Workouts → Build routine → Exercise rotations**. Add one of the two library variants to each of the two days, then choose the days and both variants in the rotation form. A completed primary-day exercise advances that pair based on the actual variant performed. The other day suggests the complementary variant; completing it does not advance the primary rotation. Skipped exercises and substitutions outside the pair do not advance it. Pairs are local to each routine; arbitrary-length rotations and an automatic migration to cloud storage are not implemented.

Routine reordering, cycle snapshots and historical skipped-day records, and comprehensive backup recovery remain incomplete. The app uses localStorage for the UI and an IndexedDB queue for experimental manual sync; it does not yet automatically sync in the background. A production-build service worker caches the app shell and install icons, but offline authentication and launch have **not** been verified on Android; the manifest and worker do not guarantee installation or safe persistence. See the [migration runbook](supabase-migrations.md) before applying the same migrations to another project.
