-- Online-only workout storage. Review docs/supabase-migrations.md before applying.
-- This is independent of the older, experimental sync tables.
begin;

create table public.tor_online_workout_heads (
  user_id uuid primary key references auth.users(id) on delete cascade,
  revision bigint not null check (revision > 0),
  last_operation uuid not null,
  last_request_hash text not null
);

create table public.tor_online_workout_records (
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('exercise', 'routine', 'workout', 'session', 'settings')),
  entity_id uuid not null,
  body jsonb not null check (jsonb_typeof(body) = 'object'),
  primary key (user_id, kind, entity_id)
);

alter table public.tor_online_workout_heads enable row level security;
alter table public.tor_online_workout_records enable row level security;
revoke all on public.tor_online_workout_heads, public.tor_online_workout_records from public, anon, authenticated;

create function public.tor_online_workout_read(p_owner uuid)
returns jsonb language plpgsql security definer set search_path = pg_catalog, public, auth as $$
declare
  owner_id uuid := auth.uid();
  result jsonb;
begin
  if owner_id is null or owner_id is distinct from p_owner then raise exception 'Account changed' using errcode = '42501'; end if;
  -- One statement sees a consistent snapshot of the head and its records.
  select jsonb_build_object('revision', h.revision, 'documents',
    coalesce((select jsonb_agg(jsonb_build_object('kind', r.kind, 'id', r.entity_id, 'body', r.body) order by r.kind, r.entity_id)
      from public.tor_online_workout_records r where r.user_id = owner_id), '[]'::jsonb))
    into result from public.tor_online_workout_heads h where h.user_id = owner_id;
  return coalesce(result, jsonb_build_object('revision', 0, 'documents', '[]'::jsonb));
end $$;

create function public.tor_online_workout_write(p_owner uuid, p_revision bigint, p_operation uuid, p_documents jsonb)
returns jsonb language plpgsql security definer set search_path = pg_catalog, public, auth as $$
declare
  owner_id uuid := auth.uid();
  head public.tor_online_workout_heads%rowtype;
  request_hash text;
  item jsonb;
begin
  if owner_id is null or owner_id is distinct from p_owner then raise exception 'Account changed' using errcode = '42501'; end if;
  if p_revision is null or p_revision < 0 or p_operation is null or jsonb_typeof(p_documents) is distinct from 'array'
    or octet_length(p_documents::text) > 10000000 then raise exception 'Invalid workout request'; end if;
  request_hash := md5(p_revision::text || ':' || p_documents::text);
  perform pg_advisory_xact_lock(hashtextextended(owner_id::text, 481));
  select * into head from public.tor_online_workout_heads where user_id = owner_id;
  if found and head.last_operation = p_operation then
    if head.last_request_hash <> request_hash then raise exception 'Operation ID reused'; end if;
    return jsonb_build_object('status', 'ok', 'revision', head.revision);
  end if;
  if coalesce(head.revision, 0) <> p_revision then
    return jsonb_build_object('status', 'conflict');
  end if;
  for item in select value from jsonb_array_elements(p_documents) loop
    if jsonb_typeof(item) is distinct from 'object' or item->>'kind' not in ('exercise','routine','workout','session','settings')
      or jsonb_typeof(item->'id') is distinct from 'string' or jsonb_typeof(item->'body') is distinct from 'object' then
      raise exception 'Invalid workout record';
    end if;
  end loop;
  delete from public.tor_online_workout_records where user_id = owner_id;
  insert into public.tor_online_workout_records(user_id, kind, entity_id, body)
    select owner_id, value->>'kind', (value->>'id')::uuid, value->'body' from jsonb_array_elements(p_documents);
  insert into public.tor_online_workout_heads(user_id, revision, last_operation, last_request_hash)
    values (owner_id, p_revision + 1, p_operation, request_hash)
    on conflict (user_id) do update set revision = excluded.revision, last_operation = excluded.last_operation, last_request_hash = excluded.last_request_hash;
  return jsonb_build_object('status', 'ok', 'revision', p_revision + 1);
end $$;

revoke all on function public.tor_online_workout_read(uuid) from public, anon;
revoke all on function public.tor_online_workout_write(uuid, bigint, uuid, jsonb) from public, anon;
grant execute on function public.tor_online_workout_read(uuid) to authenticated;
grant execute on function public.tor_online_workout_write(uuid, bigint, uuid, jsonb) to authenticated;
commit;
