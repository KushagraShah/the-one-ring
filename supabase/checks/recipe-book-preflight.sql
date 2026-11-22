-- Read-only. Run in the intended existing project's SQL Editor before 007/008.
-- Every row must show ok = true. This checks metadata, not app/account records.
select check_name, ok from (values
  ('auth available', to_regclass('auth.users') is not null and to_regprocedure('auth.uid()') is not null),
  ('workout RPCs present', to_regprocedure('public.tor_online_workout_read(uuid)') is not null and to_regprocedure('public.tor_online_workout_write(uuid,bigint,uuid,jsonb)') is not null),
  ('habit RPCs present', to_regprocedure('public.tor_online_habit_read(uuid)') is not null and to_regprocedure('public.tor_online_habit_write(uuid,bigint,uuid,jsonb)') is not null),
  ('recipe table absent', to_regclass('public.tor_online_recipe_workspaces') is null),
  ('recipe functions absent', not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in ('tor_online_recipe_read', 'tor_online_recipe_write', 'tor_recipe_format_guard')
  ))
) as checks(check_name, ok);
