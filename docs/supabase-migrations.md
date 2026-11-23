# Supabase migrations

## Current installation and ownership

The existing project has **owner-reported installation of 001/002, 004/005, 006 and 007/008**. Do not rerun these migrations there. This is reported installation state, not an independent live schema inspection or proof of signed-in behavior. Recipe-specific installation and verification live in the [Recipe Book runbook](recipe-book-supabase.md).

| Migrations | Responsibility |
| --- | --- |
| [001](../supabase/migrations/202611060001_workout_schema.sql), [002](../supabase/migrations/202611060002_sync_protocol.sql) | Legacy normalized workout tables and experimental manual-sync objects; not the mounted client's storage |
| [004](../supabase/migrations/202611070004_online_workouts.sql) | Active workout JSON records, revision head and authenticated read/write RPCs |
| [005](../supabase/migrations/202611070005_history_client_guard.sql) | Workout history client guard; prevents older writes after adoption of newer history |
| [006](../supabase/migrations/202611080006_online_habits.sql) | Independent habit workspace and authenticated read/write RPCs |
| [007](../supabase/migrations/202611120007_online_recipes.sql), [008](../supabase/migrations/202611220008_recipe_format_guard.sql) | Independent recipe workspace and format downgrade guard |

The [architecture](architecture.md#active-persistence) describes active objects, app boundaries and retry guarantees. Retained legacy tables are not permission to delete them or reactivate the old client.

## Target and schema preflight

Before new SQL, verify the intended dashboard project against the app's configured project URL and inspect actual objects. A GitHub configuration name does not prove its value. Keep credentials, tokens, private records and backup contents out of messages and logs. Protect existing data before a replacement or recovery operation.

SQL Editor execution may not populate Supabase migration history. The separate Supabase GitHub integration is removed; Pages deploys only the frontend. Do not enable automatic database application, reset a database, repair history or mask mismatches with `IF NOT EXISTS` by assumption. Resolve actual schema state first. On a failed or uncertain migration result, preserve the error and inspect metadata before attempting another action; never rerun fragments blindly.

For a new project, test the active migrations with disposable accounts first. Migration 004 establishes workout storage; 005 follows 004; 006 establishes habit storage; recipe preflight expects workout/habit RPCs before 007/008. Legacy 001/002 are not prerequisites for active online storage. Apply only the reviewed files missing from the verified target, once each, preserving the entire transaction. No reset or implicit data import is needed.

## Migration 006: manual preflight and application

**Already reported applied on the existing project.** This procedure is for a verified target with 004/005 present and no habit objects. It checks metadata rather than private records. Migration 006 creates one habit table and two functions without modifying workouts or Auth settings.

1. Run this read-only preflight in SQL Editor:

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

   Expected before installation: the first five values are `true`, `habit_table_exists` is `false`, and `habit_function_count` is `0`. Existing habit objects mean this is not an uninstalled target. Stop on any mismatch; do not rerun 004/005 or drop objects. The history marker does not prove the complete function body or live guard behavior.
2. Run the entire [migration 006](../supabase/migrations/202611080006_online_habits.sql), including `begin;` and `commit;`, once in a new query. If execution fails or is uncertain, inspect the actual state before proceeding.
3. In another query, run this read-only verification:

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

   All five values should be `true`. The anonymous check includes inherited `PUBLIC` privileges. These metadata checks do not establish owner isolation: SQL Editor uses elevated privileges.
4. With disposable signed-in data, save a habit, wait for acknowledgement and reload. Confirm workout data remains intact. Record specific results separately from installation success; use the verification outline below for account boundaries and recovery.

These fenced queries are also executed by `tests/habit-schema.test.mjs`; keep both marker aliases and valid executable SQL when maintaining this runbook.

## Real-account verification outline

This is an uncompleted verification outline, not a record of passing live checks. Use an agreed disposable project and two disposable accounts where practical. On an existing project, agree on exact scope and preserve existing data before any test changes.

1. Confirm the target and app version. Create identifiable disposable records in each app, wait for save completion and reload. Demo results do not count as account persistence.
2. Check both accounts' own reads/writes, then attempt cross-owner API reads/writes with real authenticated sessions. Missing UI items alone do not establish server isolation. Cover workouts, habits and recipes independently.
3. Open one account in two independent sessions. Save in one, then attempt a stale edit in the other. Confirm rejection and the export/reload path without losing the test draft.
4. Exercise a rejected/interrupted save and retry after an uncertain response where practical. Confirm stable retries avoid duplicate operations and that recovery retains unsaved work. Check restore separately, including partial full-app completion described in [architecture](architecture.md#backups-and-compatibility).
5. Record date, environment, version, scenarios and observed results without private data. Distinguish SQL installation, metadata checks, local automated tests and real authenticated behavior. Current evidence limits are maintained in [setup](setup.md#preview-limitations).
