# Setup and current limitations

## Local development

Use Node.js 20 or newer. Run `npm install` followed by `npm run dev`, then open the URL printed by Vite. `npm run build` checks TypeScript and creates the production bundle; `npm run preview` serves that bundle locally.

## Supabase authentication

The project URL and **publishable** key are configured for the owner's Supabase project. Optional `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` environment variables override them. Never put a Supabase secret/service-role key in the frontend.

In the Supabase dashboard, enable email/password authentication. Under Auth URL settings, set the Site URL to the deployed URL and allow redirect URLs for the deployed app and local preview (for example, `http://localhost:5173/`). Check email confirmation settings and delivery limits. The owner can disable signup after onboarding and temporarily enable it for a trusted user. First sign-in requires connectivity.

**Authentication is not workout sync.** The current preview keeps workout data in this browser, separately for each account and the demo. It has no Supabase workout database, cross-device sync, or reliable offline launch. Local browser data can be cleared or evicted; export a backup. Don't rely on it as the sole copy of important data.

## GitHub Pages

The workflow in `.github/workflows/deploy.yml` builds and deploys pushes to `main`. In repository settings, select **GitHub Actions** as the Pages source. The expected URL is `https://kushagrashah.github.io/the-one-ring/`; add it to Supabase's redirect allow list and check the Pages deployment workflow. The relative Vite base supports the project path and local preview.

## Current preview

The app has demo mode, accent colors, a simple exercise library and single routine editor, balanced day suggestions, three-set strength and cardio logging, history, and local JSON export/restore. The sample routine and initial demo progress are illustrative. Exercise history matches by **name**, so renaming an exercise breaks its history link.

Multiple routines, independent rotations, routine reordering, stable exercise IDs, robust backup validation, cloud sync, database RLS, and a service worker are not implemented. The manifest alone does not guarantee Android installation. See [`workout-data-model.md`](workout-data-model.md) for the proposed model and reliability requirements; it is a design draft, not an applied migration.
