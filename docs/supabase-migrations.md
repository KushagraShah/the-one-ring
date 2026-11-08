# Supabase migrations and sync testing

## Mini-app ownership inventory

- **Shared:** Supabase Auth owns accounts. Appearance is currently a browser preference; there is no separate shared app-data table.
- **Active Workout Tracker:** `tor_online_workout_heads` and `tor_online_workout_records`, accessed through `tor_online_workout_read` and `tor_online_workout_write`. Migration 005 replaces the write function with the history-format client guard. These are workout-only, even though records include workout settings.
- **Older Workout Tracker experiments:** migration 001's 16 normalized workout tables and migration 002's `tor_sync_records`, `tor_sync_batches` and `tor_apply_sync_batch` are not the active online workspace. The old client code is under `src/workout/legacy-sync/`; retained does not mean these tables are safe to delete or rerun.
- **Habit Tracker:** migration `202611080006_online_habits.sql` adds the separate `tor_online_habit_workspaces` table and `tor_online_habit_read`/`tor_online_habit_write` RPCs. On 2026-11-08 the owner reported applying migration 006 successfully and that checks were good. Do not rerun it on that project. It stores an independently revision-checked whole habit workspace (10 MB limit), not incremental log records; each write replaces only that habit workspace. It does not touch workout tables. Client validation covers domain structure; JSON is not fully domain-validated by SQL. PGlite tests are not a substitute for real Supabase isolation or retry tests.

This inventory is based on repository migrations and owner reports, not a live schema inspection. All objects currently use the existing Supabase project; conceptual ownership does not imply separate physical schemas. See the safety instructions below before any migration.

The owner reports migration 006 was applied manually to the existing project; real-account isolation, conflict and failure/retry checks remain unverified. Testing in a disposable Supabase project and accounts first was not reported. Do not rerun migrations or reset any database. Never send credentials in chat. SQL Editor execution does not necessarily record migration history.

## Migration 006: manual preflight and application

**The owner reports this was already applied to the existing project. Do not run it there again.** The following procedure is retained for another verified project or investigation.

The migration creates one habit table and two habit functions in a transaction. It does not import old habits or demo data, change workout tables, delete accounts, or require a reset. Signed-in habits require it; workouts do not. Do not paste credentials, access tokens, personal records or backup contents into chat.

1. In the Supabase dashboard, choose the intended existing project. Compare its project URL in **Connect / API settings** with the URL configured locally. Check that it is the project intended for Pages; GitHub does not reveal an existing secret's value, and its name alone does not prove its value. Do not post the values. The owner has confirmed there is no real workout data to back up. If the target is uncertain, stop.
2. In **SQL Editor → New query**, run the following **read-only preflight**. It reads object metadata, not workout or habit records:

   ```sql
   select
     to_regclass('public.tor_online_workout_heads') is not null as workout_heads_exist,
     to_regclass('public.tor_online_workout_records') is not null as workout_records_exist,
     to_regprocedure('public.tor_online_workout_read(uuid)') is not null as workout_read_exists,
     to_regprocedure('public.tor_online_workout_write(uuid,bigint,uuid,jsonb)') is not null as workout_write_exists,
     case when to_regprocedure('public.tor_online_workout_write(uuid,bigint,uuid,jsonb)') is null then false
       else position('App update required before saving workout history' in pg_get_functiondef(to_regprocedure('public.tor_online_workout_write(uuid,bigint,uuid,jsonb)'))) > 0 end as history_guard_marker_present,
     to_regclass('public.tor_online_habit_workspaces') is not null as habit_table_exists,
     (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.proname in ('tor_online_habit_read', 'tor_online_habit_write')) as habit_function_count;
   ```

   Expected: the first five values are `true`, `habit_table_exists` is `false`, and `habit_function_count` is `0`. The guard marker is a useful check, not a full proof that migration 005 or live guard behavior is correct. **Stop** if any result differs; do not rerun 004/005 or drop existing habit objects. Migration history alone is not authoritative for manually run SQL.
3. Open `supabase/migrations/202611080006_online_habits.sql` from this checkout. In a **new** SQL Editor query, copy and run the **entire file**, including `begin;` and `commit;`, exactly once. If it fails or its result is uncertain, stop and report the error; do not rerun fragments or the whole migration until the actual schema state has been checked.
4. Run this **read-only verification** in a new query:

   ```sql
   select
     coalesce((select c.relrowsecurity from pg_class c where c.oid = to_regclass('public.tor_online_habit_workspaces')), false) as habit_rls_enabled,
     coalesce(not has_table_privilege('anon', to_regclass('public.tor_online_habit_workspaces'), 'SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER'), false) as anon_table_access_denied,
     coalesce(not has_table_privilege('authenticated', to_regclass('public.tor_online_habit_workspaces'), 'SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER'), false) as authenticated_table_access_denied,
     (select count(*) = 2 and bool_and(p.prosecdef)
       from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.oid in (to_regprocedure('public.tor_online_habit_read(uuid)'), to_regprocedure('public.tor_online_habit_write(uuid,bigint,uuid,jsonb)'))) as habit_functions_security_definer,
     (select count(*) = 2 and bool_and(not has_function_privilege('anon', p.oid, 'EXECUTE') and has_function_privilege('authenticated', p.oid, 'EXECUTE'))
       from pg_proc p where p.oid in (to_regprocedure('public.tor_online_habit_read(uuid)'), to_regprocedure('public.tor_online_habit_write(uuid,bigint,uuid,jsonb)'))) as habit_function_grants_expected;
   ```

   All five values should be `true`. The anonymous privilege check includes inherited `PUBLIC` privileges. These checks do not prove owner isolation or validate function bodies; SQL Editor runs with elevated privileges. Report success or any unexpected result before deploying.
5. After the migration, use the local feature-branch app with the existing account: create a clearly disposable habit, wait until saving completes, reload and check it persists. Confirm workout data is unchanged. Review backup/restore, stale edits, failed saves and real two-account isolation separately before relying on the new app. A full restore is not atomic across the two apps. Demo remains temporary and is not imported automatically. Then merge and verify Pages and the owner's phone as separately authorized.

Record the date, project (without credentials), observed results and any outstanding tests in the project handoff. SQL Editor execution does not necessarily update migration history; do not repair it based on an assumption.

## Online-only development migration

**Activity/history client guard:** `supabase/migrations/202611070005_history_client_guard.sql` replaces the existing online-write function to reject older clients after an account adopts history format 2. The owner reported applying it on 2026-11-07. It is tested with PGlite, but live guard behavior has not been independently tested. For other projects, verify the target and that migration 004 is present before applying 005. SQL Editor execution does not necessarily update migration history. Do not rerun migrations or reset the database.

The online client requires `supabase/migrations/202611070004_online_workouts.sql`. It creates separate owner-scoped JSON workout records and a revision head, plus transactional authenticated read/write functions. Each write replaces the account's record set atomically and rejects stale revisions; a repeated operation can recover a lost response. This is independent of the old normalized and manual-sync tables and does not import or delete their data. The owner reported applying it on 2026-11-07; the target and live behavior have not been independently verified.

For another project, first test with a disposable Supabase project and accounts. Verify the project and schema in the dashboard, then run the entire file once in SQL Editor. Do not rerun it or the older migrations; SQL Editor execution may not update migration history. No reset is required. Test two real accounts, failed/retried saves, stale writes, restore, and a phone before relying on it. SQL tests use PGlite and do not prove real Supabase behavior. Do not paste credentials in chat.

The rest of this document describes the **previous release's** manual-sync migrations and tests, not the new online client.

## Status and safety

Two SQL files in `supabase/migrations/` implement an initial schema and an experimental per-record sync protocol. They have been tested locally with PGlite, including two-user read isolation, cross-owner references, retry idempotency, optimistic concurrency and a simulated two-device conflict. The owner reports applying both to the `the-one-ring` Supabase project and that an initial authenticated sync appeared to work. Anonymous requests to the live sync table and RPC returned permission denied. Real two-device sync, two-user isolation and conflict behavior **have not yet been verified end to end**.

The previous release's sync UI was experimental; it is not mounted in the current online-only app. For historical validation, use a disposable Supabase project and disposable test accounts. The owner's existing project may already contain authentication users; the migration does not intentionally modify or delete them, but always verify the target project before running SQL.

The relational tables from migration 001 are a read-only domain foundation. The older experimental sync client used `tor_sync_records` and `tor_apply_sync_batch` from migration 002; **it did not populate the relational tables**. Sync records are per exercise, routine, workout, current session and settings, with JSON bodies, not one whole-account JSON blob. RLS scopes reads to the authenticated user and direct client writes are revoked; the RPC derives ownership from the session and checks revisions. Domain-level relational constraints do not validate the JSON bodies. A later migration is required if we move to the normalized tables.

## Run the migrations in a disposable project

1. In the Supabase dashboard, verify the project name and open **SQL Editor → New query**. Back up any existing data first.
2. Copy the **entire contents** of `supabase/migrations/202611060001_workout_schema.sql` and run it once. It runs in a transaction. If it fails, record the error and stop; do not run fragments or continue to migration 002.
3. In a new query, copy the **entire contents** of `supabase/migrations/202611060002_sync_protocol.sql` and run it once. If it fails, stop and share the error. Migration 001 is then already applied; do not rerun it.
4. Verify the tables and RLS:

   ```sql
   select tablename, rowsecurity
   from pg_tables
   where schemaname = 'public' and tablename like 'tor\_%' escape '\'
   order by tablename;
   ```

   There should be 18 `tor_` tables and `rowsecurity` should be `true` for each.
5. Verify policies and grants:

   ```sql
   select tablename, policyname, cmd, roles, qual
   from pg_policies
   where schemaname = 'public' and tablename like 'tor\_%' escape '\'
   order by tablename, policyname;

   select table_name, grantee, privilege_type
   from information_schema.role_table_grants
   where table_schema = 'public'
     and table_name like 'tor\_%' escape '\'
     and grantee in ('anon', 'authenticated')
   order by table_name, grantee, privilege_type;

   select routine_name, grantee, privilege_type
   from information_schema.routine_privileges
   where specific_schema = 'public' and routine_name = 'tor_apply_sync_batch'
   order by grantee;
   ```

   The 16 domain tables and `tor_sync_records` should have an authenticated `owner_read` policy and authenticated `SELECT` only. `tor_sync_batches` has no client grant or policy. The `tor_apply_sync_batch` function should be executable by `authenticated`, not `anon` or `PUBLIC`. Dashboard query results can also show owner/administrative grants; check the client roles specifically.
6. Configure this test project's URL and publishable key in `.env.local`, restart the dev server, and use disposable test accounts. The project's Auth redirect URLs must allow the local preview URL. In **Settings → Cloud sync**, choose **Set up sync**. A first device can upload its local data; another device must explicitly confirm before replacing its local data with the cloud copy.
7. Test offline changes, restart, reconnect, a deliberately conflicting edit on two devices, and different accounts. Confirm that pending changes remain visible and that a conflicting update is not silently overwritten. Do not assume SQL Editor tests prove real-user isolation: the editor uses an administrative role and bypasses RLS.

These migrations are not designed to be rerun on top of themselves. The SQL Editor does not automatically track them as Supabase CLI migrations: record which files were applied to which project. The owner removed Supabase's GitHub integration after a deployment attempted to create an existing table (`tor_exercises`); manually applied schema and migration history may be out of sync. Before enabling automated database migrations or repairing history, verify the target database, its actual schema, and migration history. Do not assume a history repair is safe, mask mismatches with `IF NOT EXISTS`, or reset a branch without explicit approval. Never paste a service-role key, database password, or access token into the app, Git, or a support message.
