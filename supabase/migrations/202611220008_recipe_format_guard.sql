-- Apply after 007, following docs/recipe-book-supabase.md.
-- Reject malformed containers and older clients overwriting a newer workspace format.
begin;
create function public.tor_recipe_format_guard()
returns trigger language plpgsql set search_path = pg_catalog, public as $$
begin
  if new.data->'version' is null or new.data->'version' not in ('1'::jsonb, '2'::jsonb, '3'::jsonb) then
    raise exception 'Unsupported recipe workspace version';
  end if;
  if tg_op = 'UPDATE' and old.data->>'version' in ('2', '3') and (old.data->>'version')::integer > (new.data->>'version')::integer then
    raise exception 'App update required before saving recipes';
  end if;
  if jsonb_typeof(new.data->'recipes') is distinct from 'array' or
     coalesce(jsonb_typeof(new.data->'shopping'), '') not in ('object', 'null') or
     coalesce(jsonb_typeof(new.data->'cooking'), '') not in ('object', 'null') or
     (new.data->>'version' in ('2', '3') and jsonb_typeof(new.data->'meta') is distinct from 'object') then
    raise exception 'Invalid recipe workspace';
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
notify pgrst, 'reload schema';
commit;
