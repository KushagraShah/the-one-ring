# Recipe Book: Supabase installation

Recipe Book uses the shared Supabase project and email/password sign-in. Its independent workspace holds recipes, plans, sides, shopping and cooking state; [architecture](architecture.md#active-persistence) describes the active persistence and recovery protocol. No additional credentials, Edge Function, bucket, Auth setting or GitHub variable is required.

**Migrations 007/008 are owner-confirmed installed on the existing project. Do not rerun them.** Reported SQL success does not establish signed-in save/reload, account isolation or recovery. Broader installation state and migration precautions are in the [migration runbook](supabase-migrations.md).

## Installation on another verified project

These steps apply to a target with the existing Auth/workout/habit dependencies and no recipe objects. For an installed project, inspect the existing objects before applying anything. The migrations create recipe-only objects and do not rewrite workout/habit records or import demo data. Do not rerun earlier migrations to satisfy an unexpected preflight result. One-off SQL checks are run in the target SQL Editor; no standalone check scripts are retained in the repository.

Confirm the dashboard project URL matches the app's configured project. Open **SQL Editor → New query** for each step. Copy the complete linked migration, retaining `begin;` and `commit;`.

1. In SQL Editor, verify that Auth/workout/habit dependencies exist and the recipe table and functions are absent. Stop on any mismatch and investigate metadata; do not drop existing objects or rerun earlier files.
2. Run [migration 007](../supabase/migrations/202611120007_online_recipes.sql) once. It creates the recipe table and read/write RPCs, enables RLS, revokes direct client table access and grants authenticated RPC access. The functions check caller ownership.
3. Run [migration 008](../supabase/migrations/202611220008_recipe_format_guard.sql) once. It checks supported numeric workspace versions and main containers, blocks older-format writes over a newer workspace and requests a PostgREST schema-cache refresh. It does not fully validate recipe domain data; the client performs domain validation.
4. In SQL Editor, verify RLS, direct table privileges, authenticated-only RPC grants, fixed function search paths and the active format trigger. Every expected check must pass before signed-in verification.

If execution fails or its result is uncertain, preserve the error and stop. If 007 succeeded and 008 failed, the table and RPCs already exist: do not rerun 007. Use metadata verification to identify the partial state and resolve the cause before proceeding. Manual SQL Editor execution may not update migration history; it does not require an assumed history repair.

If the API cannot find a recipe function after all installation checks pass, this notification refreshes its schema cache without changing app data:

```sql
notify pgrst, 'reload schema';
```

## Signed-in verification

With disposable records in a suitable test account, save a recipe and add it to a plan. Wait for saving to complete, reload and confirm both return. Separately check shopping states and cooking resume. Do not import demo data or restore a full backup merely to verify installation. Use the [real-account verification outline](supabase-migrations.md#real-account-verification-outline) for API isolation, stale edits and uncertain-response recovery.

The Pages workflow deploys the frontend separately from SQL. A successful SQL query or frontend deployment is not a persistence test. Record the specific target, app version and observed signed-in scenarios when performed. [Setup](setup.md#preview-limitations) is the authoritative summary of outstanding verification limits.

## Compatibility checks

Local schema tests execute migrations and test-local preflight/verification queries in PGlite. Store tests exercise the Supabase client through simulated PostgREST transport, including stale writes, response loss, stable retries and malformed containers. These checks provide local evidence without replacing live authenticated verification.

The client reads formats 1/2 into format 3 while retaining active phase snapshots. Once 008 is installed, an older client cannot downgrade a newer workspace; do not bypass that guard for rollback or restore. [App behavior](app-behavior.md#recipes) explains legacy parsing/conversion, and [architecture](architecture.md#backups-and-compatibility) defines backup scopes, draft exclusions and partial full-restore behavior.
