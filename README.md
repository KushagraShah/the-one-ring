# The One Ring

The One Ring is a personal, mobile-first home for small apps that make everyday life easier. The first mini-app is a workout tracker; a habit tracker and others may follow.

The current version is an early preview. You can explore it in demo mode or sign in with Supabase, build a simple routine, and log workouts. **Workout data stays in this browser and does not sync between devices yet.** Export a backup before clearing browser data; don't rely on the preview as your only copy of important records.

## Run locally

Requires Node.js 20 or newer:

```sh
npm install
npm run dev
```

Open the URL printed in the terminal. Run `npm run build` to check the production build.

See [setup and current limitations](docs/setup.md) for hosting and authentication, and the [workout data model draft](docs/workout-data-model.md) for the planned backend.
