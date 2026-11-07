-- Apply after 004, before deploying clients that write historyFormat 2.
-- Do not rerun existing migrations or reset data. This guard prevents an older
-- app from stripping the newer workout-history snapshot fields.
begin;
create or replace function public.tor_online_workout_write(p_owner uuid, p_revision bigint, p_operation uuid, p_documents jsonb)
returns jsonb language plpgsql security definer set search_path = pg_catalog, public, auth as $$
declare
  owner_id uuid := auth.uid();
  head public.tor_online_workout_heads%rowtype;
  request_hash text;
  item jsonb;
  old_format integer;
  new_format integer;
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
  if coalesce(head.revision, 0) <> p_revision then return jsonb_build_object('status', 'conflict'); end if;
  for item in select value from jsonb_array_elements(p_documents) loop
    if jsonb_typeof(item) is distinct from 'object' or item->>'kind' not in ('exercise','routine','workout','session','settings')
      or jsonb_typeof(item->'id') is distinct from 'string' or jsonb_typeof(item->'body') is distinct from 'object' then
      raise exception 'Invalid workout record';
    end if;
  end loop;
  select coalesce(max(case when body->>'historyFormat' ~ '^[0-9]{1,4}$' then (body->>'historyFormat')::integer else 1 end), 1)
    into old_format from public.tor_online_workout_records where user_id = owner_id and kind = 'settings';
  select coalesce(max(case when value->'body'->>'historyFormat' ~ '^[0-9]{1,4}$' then (value->'body'->>'historyFormat')::integer else 1 end), 1)
    into new_format from jsonb_array_elements(p_documents) where value->>'kind' = 'settings';
  if new_format < old_format then raise exception 'App update required before saving workout history' using errcode = 'P0001'; end if;
  delete from public.tor_online_workout_records where user_id = owner_id;
  insert into public.tor_online_workout_records(user_id, kind, entity_id, body)
    select owner_id, value->>'kind', (value->>'id')::uuid, value->'body' from jsonb_array_elements(p_documents);
  insert into public.tor_online_workout_heads(user_id, revision, last_operation, last_request_hash)
    values (owner_id, p_revision + 1, p_operation, request_hash)
    on conflict (user_id) do update set revision = excluded.revision, last_operation = excluded.last_operation, last_request_hash = excluded.last_request_hash;
  return jsonb_build_object('status', 'ok', 'revision', p_revision + 1);
end $$;
commit;
