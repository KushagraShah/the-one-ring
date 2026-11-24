# Architecture

## Shared shell and app boundaries

[`src/main.tsx`](../src/main.tsx) mounts `AppDialogProvider` → `AuthGate` → an identity-keyed [`App`](../src/app/App.tsx). Changing identity remounts account state. The shell owns Home, Settings, profile editing, shared navigation, backup coordination, sign-out and update controls.

Workout Tracker, Habit Tracker and Recipe Book remain mounted together. The shell switches their visible views and calls their handles for leaving, exporting, replacing data and checking pending work. Each app has independent loading and error state; one failed load does not require the others to disappear. Navigation consults the active app's leave protections. Sign-out, update activation and reload check all three apps and profile state; [setup](setup.md#github-pages-and-updates) explains the update controls.

Shared surfaces use forest/gold colors, with neutral shared screens, blue workouts, violet habits and terracotta recipes. Mobile navigation fixes Home and Settings around a scrolling app-ring strip; desktop navigation lists available apps. Shared controls live at the source root: `AppDialog`, `ConfirmDialog`, `ChoiceSelect`, `DetailView`, `CloseButton` and `InfoTip`. There is no plugin framework.

## Active persistence

Supabase is authoritative for signed-in workspaces. App data loads into memory; browser storage is used for Auth/session and preferences rather than a durable account-data cache. Demo examples are separate in-memory workspaces and are never implicitly imported into an account.

| App | Client ownership | Active server objects |
| --- | --- | --- |
| Workouts | [`online.ts`](../src/workout/online.ts), [`workspace.ts`](../src/workout/workspace.ts), [`documents.ts`](../src/workout/documents.ts) | `tor_online_workout_heads`, `tor_online_workout_records`; `tor_online_workout_read/write` |
| Habits | [`online.ts`](../src/habits/online.ts), [`model.ts`](../src/habits/model.ts) | `tor_online_habit_workspaces`; `tor_online_habit_read/write` |
| Recipes | [`online.ts`](../src/recipes/online.ts), [`model.ts`](../src/recipes/model.ts) | `tor_online_recipe_workspaces`; `tor_online_recipe_read/write` |

Workouts project exercises, routines, history, the active session and settings into JSON records, replacing the account's entire workout record set in one checked transaction. Habits and recipes each replace one JSON workspace. Each app has a separate revision and atomic write, with a **10 MB server request limit**. UI pagination and in-memory indexes do not reduce whole-workspace loading or writes.

Writes check the authenticated owner and expected revision. A pending request retains its operation ID and body across retries after an uncertain response; queued later changes follow the acknowledged request. Stale writes produce conflicts instead of silent replacement. A saving indicator remains until acknowledgement. Errors/conflicts retain unsaved memory for export/recovery and block further editing in the affected app. A shared recovery dialog lists simultaneous failures and offers per-app retry and exports. It can be temporarily set aside to finish or preserve drafts in other apps; failed apps stay locked and their drafts remain mounted when navigating away. Conflicts require preserving data through export or discarding and reloading the authoritative workspace. A failed sign-out reports that the session may still be active and can be retried.

Username and avatar are stored in Supabase Auth user metadata, outside app workspace revisions and backups. Profile saves have their own error feedback, without the workspace conflict protocol.

## Backups and compatibility

Settings offers timestamped app-specific backups, workout/habit format-1 backups and full three-app format-2 backups. Full format 2 includes recipe plans, sides, metadata and active shopping/cooking phases. Workout backups include confirmed in-progress session data. Credentials, profile metadata, browser preferences and unsaved routine/editor/result drafts are excluded. Open workout date and result corrections, like other workout drafts, guard navigation and replacement. Recovery can export open workout/habit drafts and recipe text drafts separately for manual reference; those files are not restorable workspace backups.

Restore validates the selected scope before confirmation and replaces that scope rather than merging. It checks current readiness and data again after reading and confirmation; changed data or drafts require retrying. Individual restores leave other apps alone. Full restore validates all sections first, then initiates separate app saves: **it is not atomic and can partially complete**. Keep the page open, inspect each saving/error indicator and preserve exports during recovery. Per-app exports can preserve unsaved in-memory workspace state after a failed save; full exports require loaded, saved apps.

Workspace validation allows up to 50,000,000 UTF-8 bytes of compact JSON per app; individual files allow 200,000,000 bytes and full files 600,000,000 bytes. New exports use compact JSON; older formatted backups remain accepted within those limits. The server separately limits its JSONB text representation to 10,000,000 bytes per write, which may exceed compact JSON size. A backup can therefore validate but fail to save; recovery keeps it in memory for export and warns about the server limit. File and workspace limits do not promise that a server write will fit.

Recipe formats 1/2 read into format 3 while retaining active snapshots. The server's format guard prevents downgrading newer recipe data. The [migration runbooks](supabase-migrations.md) describe installation and compatibility guards.

## Source map and legacy code

- [`WorkoutApp.tsx`](../src/workout/WorkoutApp.tsx), `WorkoutSession.tsx`, `RoutineBuilder.tsx`, `rotations.ts`, `Activity.tsx` and `backup.ts` own workout flows, cycle rules, history and backup parsing.
- [`HabitApp.tsx`](../src/habits/HabitApp.tsx), `model.ts` and `insights.ts` own habit entry, local dates, schedules and derived scoring.
- [`RecipeApp.tsx`](../src/recipes/RecipeApp.tsx), `model.ts`, `importRecipe.ts`, `MealPlan.tsx` and `RecipePhases.tsx` own recipe editing, import, planning and phases.
- [`src/workout/legacy-sync/`](../src/workout/legacy-sync/) retains the earlier manual-sync experiment. It is not mounted; migrations 001/002 are not the active persistence model. Retention does not make old tables safe to delete.
- [`src/assets/README.md`](../src/assets/README.md) is the artwork provenance reference. Service-worker generation is configured in [`vite.config.ts`](../vite.config.ts), not edited in `dist/`.

Domain semantics are in [app behavior](app-behavior.md); verification limits are in [setup](setup.md#preview-limitations).
