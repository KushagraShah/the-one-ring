-- Read-only. Run after both 007 and 008. Every row must show ok = true.
-- Checks installation and privileges; does not test live signed-in account isolation.
with objects as (
  select to_regclass('public.tor_online_recipe_workspaces') as workspace,
    to_regprocedure('public.tor_online_recipe_read(uuid)') as reader,
    to_regprocedure('public.tor_online_recipe_write(uuid,bigint,uuid,jsonb)') as writer,
    to_regprocedure('public.tor_recipe_format_guard()') as guard
), checks as (
  select 'recipe table and RPCs present' as check_name, workspace is not null and reader is not null and writer is not null and guard is not null as ok from objects
  union all
  select 'row level security enabled', coalesce((select relrowsecurity from pg_class where oid = workspace), false) from objects
  union all
  select 'direct client table access denied', coalesce(
    not has_table_privilege('anon', workspace, 'SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER') and
    not has_table_privilege('authenticated', workspace, 'SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER'), false) from objects
  union all
  select 'RPC security and fixed search path', (select count(*) = 2 and bool_and(p.prosecdef and p.proconfig @> array['search_path=pg_catalog, public, auth'])
    from pg_proc p where p.oid in (reader, writer)) from objects
  union all
  select 'RPC grants authenticated only', (select count(*) = 2 and bool_and(
    not has_function_privilege('anon', p.oid, 'EXECUTE') and has_function_privilege('authenticated', p.oid, 'EXECUTE'))
    from pg_proc p where p.oid in (reader, writer)) from objects
  union all
  select 'format guard installed and enabled', exists (
    select 1 from pg_trigger t where t.tgrelid = workspace and t.tgfoid = guard
      and t.tgname = 'tor_recipe_format_guard' and not t.tgisinternal and t.tgenabled = 'O' and t.tgtype = 23
  ) from objects
  union all
  select 'guard direct execution denied', coalesce(not has_function_privilege('anon', guard, 'EXECUTE') and
    not has_function_privilege('authenticated', guard, 'EXECUTE'), false) from objects
)
select check_name, coalesce(ok, false) as ok from checks;
