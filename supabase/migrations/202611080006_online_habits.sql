-- Habit-only online workspace. Review docs/supabase-migrations.md before applying.
begin;
create table public.tor_online_habit_workspaces (
  user_id uuid primary key references auth.users(id) on delete cascade,
  revision bigint not null check (revision > 0),
  last_operation uuid not null,
  last_request_hash text not null,
  data jsonb not null check (jsonb_typeof(data) = 'object')
);
alter table public.tor_online_habit_workspaces enable row level security;
revoke all on public.tor_online_habit_workspaces from public, anon, authenticated;

create function public.tor_online_habit_read(p_owner uuid)
returns jsonb language plpgsql security definer set search_path = pg_catalog, public, auth as $$
declare owner_id uuid := auth.uid(); result jsonb;
begin
  if owner_id is null or owner_id is distinct from p_owner then raise exception 'Account changed' using errcode = '42501'; end if;
  select jsonb_build_object('revision', revision, 'data', data) into result from public.tor_online_habit_workspaces where user_id = owner_id;
  return coalesce(result, jsonb_build_object('revision', 0, 'data', null));
end $$;

create function public.tor_online_habit_write(p_owner uuid, p_revision bigint, p_operation uuid, p_data jsonb)
returns jsonb language plpgsql security definer set search_path = pg_catalog, public, auth as $$
declare owner_id uuid := auth.uid(); head public.tor_online_habit_workspaces%rowtype; request_hash text;
begin
  if owner_id is null or owner_id is distinct from p_owner then raise exception 'Account changed' using errcode = '42501'; end if;
  if p_revision is null or p_revision < 0 or p_operation is null or jsonb_typeof(p_data) is distinct from 'object' or octet_length(p_data::text) > 10000000 then raise exception 'Invalid habit request'; end if;
  request_hash := md5(p_revision::text || ':' || p_data::text);
  perform pg_advisory_xact_lock(hashtextextended(owner_id::text, 482));
  select * into head from public.tor_online_habit_workspaces where user_id = owner_id;
  if found and head.last_operation = p_operation then
    if head.last_request_hash <> request_hash then raise exception 'Operation ID reused'; end if;
    return jsonb_build_object('status', 'ok', 'revision', head.revision);
  end if;
  if coalesce(head.revision, 0) <> p_revision then return jsonb_build_object('status', 'conflict'); end if;
  insert into public.tor_online_habit_workspaces(user_id, revision, last_operation, last_request_hash, data)
    values (owner_id, p_revision + 1, p_operation, request_hash, p_data)
    on conflict (user_id) do update set revision = excluded.revision, last_operation = excluded.last_operation, last_request_hash = excluded.last_request_hash, data = excluded.data;
  return jsonb_build_object('status', 'ok', 'revision', p_revision + 1);
end $$;
revoke all on function public.tor_online_habit_read(uuid), public.tor_online_habit_write(uuid, bigint, uuid, jsonb) from public, anon;
grant execute on function public.tor_online_habit_read(uuid), public.tor_online_habit_write(uuid, bigint, uuid, jsonb) to authenticated;
commit;
