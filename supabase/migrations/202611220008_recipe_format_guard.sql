-- Local only: apply only after the migration preflight and owner authorization.
-- Prevent an old recipe client restoring over a workspace that uses meal-prep data.
begin;
create function public.tor_recipe_format_guard()
returns trigger language plpgsql set search_path = pg_catalog, public as $$
begin
  if coalesce(new.data->>'version', '') not in ('1', '2', '3') then
    raise exception 'Unsupported recipe workspace version';
  end if;
  if tg_op = 'UPDATE' and old.data->>'version' = '3' and new.data->>'version' <> '3' then
    raise exception 'App update required before saving meal-prep recipes';
  end if;
  if new.data->>'version' = '3' and (
    jsonb_typeof(new.data->'recipes') is distinct from 'array' or
    jsonb_typeof(new.data->'meta') is distinct from 'object' or
    jsonb_typeof(new.data->'plan') is distinct from 'array' or
    jsonb_typeof(new.data->'sides') is distinct from 'array'
  ) then raise exception 'Invalid meal-prep workspace'; end if;
  return new;
end $$;
revoke all on function public.tor_recipe_format_guard() from public, anon, authenticated;
create trigger tor_recipe_format_guard before insert or update on public.tor_online_recipe_workspaces
for each row execute function public.tor_recipe_format_guard();
commit;
