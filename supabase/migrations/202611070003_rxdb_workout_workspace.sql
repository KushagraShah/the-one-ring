-- Proposed RxDB workout workspace. This is a new table; it does not alter the
-- existing manual-sync records or authentication users. Apply only after review.
begin;

create table public.tor_rx_workout_workspaces (
  id text primary key,
  user_id uuid not null references auth.users(id),
  payload text not null,
  alternatives text not null default '[]',
  _deleted boolean not null default false,
  _modified timestamptz not null default clock_timestamp(),
  constraint tor_rx_workout_id_owner check (id = user_id::text || '-workout'),
  constraint tor_rx_workout_payload_json check (jsonb_typeof(payload::jsonb) = 'object'),
  constraint tor_rx_workout_alternatives_json check (jsonb_typeof(alternatives::jsonb) = 'array')
);

create function public.tor_rx_workout_modified()
returns trigger language plpgsql set search_path = pg_catalog, public as $$
begin
  if tg_op = 'UPDATE' and (new.id <> old.id or new.user_id <> old.user_id) then
    raise exception 'Workspace identity cannot be changed';
  end if;
  new._modified := clock_timestamp();
  return new;
end;
$$;

create trigger tor_rx_workout_modified before insert or update
on public.tor_rx_workout_workspaces for each row execute function public.tor_rx_workout_modified();

alter table public.tor_rx_workout_workspaces enable row level security;
revoke all on public.tor_rx_workout_workspaces from public, anon, authenticated;
grant select, insert, update on public.tor_rx_workout_workspaces to authenticated;
create policy owner_read on public.tor_rx_workout_workspaces for select to authenticated using ((select auth.uid()) = user_id);
create policy owner_insert on public.tor_rx_workout_workspaces for insert to authenticated with check ((select auth.uid()) = user_id);
create policy owner_update on public.tor_rx_workout_workspaces for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
-- Tombstones are synchronized; hard deletion would hide deletions from offline clients.

-- Enable change notifications when the standard Supabase publication exists.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'tor_rx_workout_workspaces') then
    execute 'alter publication supabase_realtime add table public.tor_rx_workout_workspaces';
  end if;
end;
$$;

commit;
