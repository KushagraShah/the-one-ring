-- Versioned, per-record sync. Run after 202611060001_workout_schema.sql.
-- The sync records are separate from the read-only relational design; they
-- don't populate the tor_workout_* tables. Do not expose direct client writes.
begin;

create table public.tor_sync_records (
  user_id uuid not null references auth.users(id),
  kind text not null check (kind in ('exercise', 'routine', 'workout', 'session', 'settings')),
  entity_id uuid not null,
  revision bigint not null check (revision > 0),
  deleted boolean not null default false,
  body jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, kind, entity_id),
  check ((deleted and body is null) or (not deleted and jsonb_typeof(body) = 'object'))
);
alter table public.tor_sync_records enable row level security;
revoke all on public.tor_sync_records from public, anon, authenticated;
grant select on public.tor_sync_records to authenticated;
create policy owner_read on public.tor_sync_records for select to authenticated using ((select auth.uid()) = user_id);

create table public.tor_sync_batches (
  user_id uuid not null references auth.users(id),
  operation_id uuid not null,
  request jsonb not null,
  response jsonb not null,
  created_at timestamptz not null default now(),
  primary key (user_id, operation_id)
);
alter table public.tor_sync_batches enable row level security;
revoke all on public.tor_sync_batches from public, anon, authenticated;

create function public.tor_apply_sync_batch(p_operation_id uuid, p_changes jsonb)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  owner_id uuid := auth.uid();
  item jsonb;
  prior public.tor_sync_batches%rowtype;
  actual bigint;
  expected bigint;
  record_id uuid;
  record_kind text;
  removed boolean;
  conflicts jsonb := '[]'::jsonb;
  results jsonb := '[]'::jsonb;
  response jsonb;
begin
  if owner_id is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if p_operation_id is null or jsonb_typeof(p_changes) is distinct from 'array'
     or jsonb_array_length(p_changes) < 1 or jsonb_array_length(p_changes) > 500 then
    raise exception 'Invalid sync batch';
  end if;
  -- Serialize batches per user, including creation and retries. This is a
  -- deliberately simple correctness-first choice for a small personal app.
  perform pg_advisory_xact_lock(hashtextextended(owner_id::text, 0));
  select * into prior from public.tor_sync_batches where user_id = owner_id and operation_id = p_operation_id;
  if found then
    if prior.request <> p_changes then raise exception 'Operation ID already used for a different request'; end if;
    return prior.response;
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_changes) change
    group by change->>'kind', change->>'id' having count(*) > 1
  ) then raise exception 'Duplicate entity in sync batch'; end if;

  for item in select value from jsonb_array_elements(p_changes) loop
    if jsonb_typeof(item) is distinct from 'object'
       or jsonb_typeof(item->'kind') is distinct from 'string'
       or item->>'kind' not in ('exercise', 'routine', 'workout', 'session', 'settings')
       or jsonb_typeof(item->'id') is distinct from 'string'
       or jsonb_typeof(item->'base_revision') is distinct from 'number'
       or jsonb_typeof(item->'deleted') is distinct from 'boolean'
       or ((item->>'deleted')::boolean and item->'body' is distinct from 'null'::jsonb)
       or (not (item->>'deleted')::boolean and jsonb_typeof(item->'body') is distinct from 'object') then
      raise exception 'Invalid sync change';
    end if;
    record_id := (item->>'id')::uuid;
    record_kind := item->>'kind';
    expected := (item->>'base_revision')::bigint;
    if expected < 0 then raise exception 'Invalid base revision'; end if;
    select revision into actual from public.tor_sync_records where user_id = owner_id and kind = record_kind and entity_id = record_id;
    actual := coalesce(actual, 0);
    if actual <> expected then
      conflicts := conflicts || jsonb_build_array(jsonb_build_object('kind', record_kind, 'id', record_id, 'expected', expected, 'actual', actual));
    end if;
  end loop;
  if jsonb_array_length(conflicts) > 0 then return jsonb_build_object('status', 'conflict', 'conflicts', conflicts); end if;

  for item in select value from jsonb_array_elements(p_changes) loop
    record_id := (item->>'id')::uuid;
    record_kind := item->>'kind';
    removed := (item->>'deleted')::boolean;
    expected := (item->>'base_revision')::bigint;
    insert into public.tor_sync_records (user_id, kind, entity_id, revision, deleted, body)
      values (owner_id, record_kind, record_id, expected + 1, removed, case when removed then null else item->'body' end)
    on conflict (user_id, kind, entity_id) do update
      set revision = excluded.revision, deleted = excluded.deleted, body = excluded.body, updated_at = now();
    results := results || jsonb_build_array(jsonb_build_object('kind', record_kind, 'id', record_id, 'revision', expected + 1));
  end loop;
  response := jsonb_build_object('status', 'ok', 'records', results);
  insert into public.tor_sync_batches (user_id, operation_id, request, response) values (owner_id, p_operation_id, p_changes, response);
  return response;
end;
$$;
revoke all on function public.tor_apply_sync_batch(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.tor_apply_sync_batch(uuid, jsonb) to authenticated;
commit;
