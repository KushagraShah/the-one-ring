# Recipe Book: Supabase installation before merge

The Recipe Book client uses the existing Supabase project and email/password sign-in. Recipes, plans, sides, shopping states and cooking progress live in one recipe-only workspace per account. Saves use owner checks, revisions and repeatable operation IDs. Demo stays temporary. No new credentials, Edge Function, bucket, Auth setting or GitHub variable is required.

The feature branch is prepared for merge; installation on the owner's project is not yet confirmed. Run the SQL below before merging to `main`. These scripts create only recipe objects and do not rewrite workout/habit records or import demo data. Migrations 001–006 must not be rerun.

A read-only check on 2026-11-22 confirmed the locally configured project URL matches the deployed frontend bundle. Its recipe read RPC returned HTTP 404 / `PGRST202`, meaning it was absent from the API schema cache. This does not establish whether database objects exist; the SQL preflight below must still pass.

## Run in Supabase SQL Editor

Confirm the dashboard project URL matches the app's configured project. Open **SQL Editor → New query** for each step. Copy the whole linked file; keep each migration's `begin;` and `commit;`.

1. Run [the read-only preflight](../supabase/checks/recipe-book-preflight.sql). **Every `ok` value must be `true`.** It checks existing Auth/workout/habit dependencies and that recipe objects do not already exist. If any check is false, stop and share the check names/results; do not drop objects or rerun earlier migrations. No personal records or credentials are needed.
2. Run [migration 007](../supabase/migrations/202611120007_online_recipes.sql) once. This creates the recipe table and read/write RPCs, enables RLS, revokes direct client table access, and grants only authenticated RPC access. The RPCs also verify the caller owns the requested workspace.
3. Run [migration 008](../supabase/migrations/202611220008_recipe_format_guard.sql) once. This rejects malformed main containers and older-format writes over a newer workspace, and requests a PostgREST schema-cache refresh. It does not validate every recipe field; the client validates the domain model.
4. Run [the read-only installation verification](../supabase/checks/recipe-book-verify.sql). **Every `ok` value must be `true`.** It checks RLS, direct table privileges, authenticated-only RPC grants, fixed function search paths and the active format trigger.

If a migration fails or the result is uncertain, keep the error and stop rather than rerun it. If 007 succeeded and 008 failed, the table/RPCs already exist: do not rerun 007. The verification query can identify partial installation; resolve the actual cause before proceeding with 008. Manual SQL Editor execution does not necessarily update Supabase migration history; no history repair is needed for this rollout.

If the API temporarily says it cannot find a recipe function after all checks pass, rerun only this cache notification (it does not change app data):

```sql
notify pgrst, 'reload schema';
```

## Check once before merging

With the existing test account in the local feature preview, save a clearly disposable recipe, add it to a plan, and reload after saving completes. The recipe and plan should return. Shopping and cooking persistence are also covered by automated tests with a fake service; a real signed-in check remains useful after installation. Do not import demo data or restore a full backup just to verify installation.

Send the preflight/verification results and whether the signed-in save/reload worked. No passwords, keys or backup contents are needed. The branch can then be merged to `main`, whose existing Pages workflow tests and deploys the frontend. SQL is applied separately from Pages. No tags or GitHub Release are required.

## Verification and limits

Local tests execute migrations 007/008 in PGlite and exercise the actual Supabase JavaScript client/store through a simulated PostgREST transport. They cover full workspace reload, account boundaries, stale writes, response loss after commit, stable retries, queued changes, format downgrades, malformed containers and privileges. Browser checks cover the UI's save failure/conflict recovery and exports. These checks do not prove live Supabase account isolation, real network failure recovery or physical-device behavior.

Each app stores and restores separately; a full three-app restore is not atomic. Unsaved text drafts are not included in workspace backups. Older clients cannot downgrade a newer recipe workspace once migration 008 is installed; this is intentional and should not be bypassed during a rollback.
