# Agent handoff

## Project direction

The One Ring is a free, mobile-first personal app shell for multiple mini-apps. Workout Tracker is the first, not the identity of the whole platform. A separate React/TypeScript/Vite habit tracker may be integrated later. Target GitHub Pages, Android PWA, and Supabase for one or a few private users.

Keep the interface clear and phone-first. Avoid presenting decorative or unfinished elements as interactive. A dark base with a consistently applied accent is preferred. Ask only consequential product questions; make small, reversible decisions and let the owner learn from use.

## Workout product decisions

- A reusable, equipment-specific exercise library is central. Keep machine setup, instructions, references, and exact-variant history together and easy to access while working out. Optional metadata should not make logging cumbersome.
- Multiple routines and days are planned; the routine guides rather than restricts. Allow free workouts, substitutions, skipped exercises, and extras. Keep planned versus performed data and historical snapshots distinct.
- A routine **cycle** balances days: suggest the first remaining day, even if another is completed out of order. Skips and resets must be explicit. Each routine retains its own cycle.
- Exercise rotations are independent, not global round 1/round 2. The Accessories day should suggest the other paired arm exercise compared with Push/Pull. Proposed default: advance based on the performed variant; skipped or unrelated substitutions do not advance. Users can override suggestions.
- Strength entry normally records one shared weight and three reps, with optional per-set weight overrides, and **one completion action per exercise**, not per-set checkboxes. Keep notes. Cardio records duration, speed, and incline in degrees for the owner's treadmill.
- No in-app Notion import is required. Historical stats are desirable, but don't compare raw weights across different machines or invent a composite score.

## Current reality (not production-ready)

- React + TypeScript + Vite; `npm run build` runs TypeScript and the production build.
- Supabase Auth is wired; demo and account data use separate local browser namespaces. **Workout data is not saved to Supabase or synced**, and offline PWA launch is not implemented. The app's current local prototype is not the target backend model.
- Current prototype supports one routine, sample data, a basic exercise library, three-set and cardio logging, and local backup. It matches exercise history by name, so renaming breaks the link. Multiple routines, independent rotations, stable exercise IDs, robust backup, and real offline sync remain to be built.
- [`docs/workout-data-model.md`](docs/workout-data-model.md) is a design draft, **not an applied migration**. Implement and test schema constraints, cross-owner foreign keys, RLS, atomic/idempotent sync, conflict handling, and two-user isolation before trusting real data. Keep demo data separate from real accounts.
- [`docs/setup.md`](docs/setup.md) describes deployment and configuration. Update both docs as behavior or design changes; distinguish actual implementation from plans.
- The Supabase URL and publishable key are public client configuration. Never add a service-role/secret key or credentials to the frontend or repository.

## Working conventions

Preserve user data and unrelated work. Avoid silently breaking or discarding existing local data during migrations. Don't apply Supabase schema changes or deploy without appropriate authorization. No `gh` CLI was available in the initial environment; use the available tooling and report verification limits. Keep the root README brief and human-oriented.
