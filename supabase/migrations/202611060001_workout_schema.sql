-- Initial workout schema. Review docs/supabase-migrations.md before running.
-- This migration does not create a sync API or connect the current frontend.
begin;

create table public.tor_exercises (
  id uuid primary key,
  user_id uuid not null references auth.users(id),
  name text not null check (length(trim(name)) > 0),
  equipment text not null default '',
  tracking_type text not null check (tracking_type in ('strength', 'cardio')),
  setup_notes text not null default '',
  instructions text not null default '',
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, id)
);

create table public.tor_exercise_links (
  id uuid primary key,
  user_id uuid not null references auth.users(id),
  exercise_id uuid not null,
  label text not null default '',
  url text not null check (url ~* '^https?://'),
  position integer not null default 0,
  unique (user_id, id),
  foreign key (user_id, exercise_id) references public.tor_exercises(user_id, id)
);

create table public.tor_routines (
  id uuid primary key,
  user_id uuid not null references auth.users(id),
  name text not null check (length(trim(name)) > 0),
  description text not null default '',
  active boolean not null default false,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, id),
  check (not active or archived_at is null)
);
create unique index tor_one_active_routine on public.tor_routines(user_id) where active;

create table public.tor_routine_days (
  id uuid primary key,
  user_id uuid not null references auth.users(id),
  routine_id uuid not null,
  name text not null check (length(trim(name)) > 0),
  description text not null default '',
  position integer not null check (position >= 0),
  archived_at timestamptz,
  unique (user_id, id),
  unique (user_id, routine_id, id),
  foreign key (user_id, routine_id) references public.tor_routines(user_id, id)
);

create table public.tor_warmups (
  id uuid primary key,
  user_id uuid not null references auth.users(id),
  day_id uuid not null,
  title text not null check (length(trim(title)) > 0),
  description text not null default '',
  position integer not null check (position >= 0),
  unique (user_id, id),
  foreign key (user_id, day_id) references public.tor_routine_days(user_id, id)
);

create table public.tor_rotation_groups (
  id uuid primary key,
  user_id uuid not null references auth.users(id),
  routine_id uuid not null,
  name text not null check (length(trim(name)) > 0),
  last_performed_exercise_id uuid,
  unique (user_id, id),
  unique (user_id, routine_id, id),
  foreign key (user_id, routine_id) references public.tor_routines(user_id, id)
);

create table public.tor_rotation_options (
  id uuid primary key,
  user_id uuid not null references auth.users(id),
  group_id uuid not null,
  exercise_id uuid not null,
  position integer not null check (position >= 0),
  unique (user_id, id),
  unique (user_id, group_id, exercise_id),
  unique (user_id, group_id, position),
  foreign key (user_id, group_id) references public.tor_rotation_groups(user_id, id),
  foreign key (user_id, exercise_id) references public.tor_exercises(user_id, id)
);
alter table public.tor_rotation_groups add constraint tor_rotation_last_option_fk
  foreign key (user_id, id, last_performed_exercise_id)
  references public.tor_rotation_options(user_id, group_id, exercise_id);

create table public.tor_routine_slots (
  id uuid primary key,
  user_id uuid not null references auth.users(id),
  routine_id uuid not null,
  day_id uuid not null,
  label text not null default '',
  position integer not null check (position >= 0),
  selection_mode text not null check (selection_mode in ('fixed', 'rotation', 'complement')),
  default_exercise_id uuid,
  rotation_group_id uuid,
  unique (user_id, id),
  foreign key (user_id, routine_id, day_id) references public.tor_routine_days(user_id, routine_id, id),
  foreign key (user_id, default_exercise_id) references public.tor_exercises(user_id, id),
  foreign key (user_id, routine_id, rotation_group_id) references public.tor_rotation_groups(user_id, routine_id, id),
  check ((selection_mode = 'fixed' and default_exercise_id is not null and rotation_group_id is null)
      or (selection_mode in ('rotation', 'complement') and rotation_group_id is not null and default_exercise_id is null))
);

create table public.tor_slot_alternatives (
  id uuid primary key,
  user_id uuid not null references auth.users(id),
  slot_id uuid not null,
  exercise_id uuid not null,
  position integer not null check (position >= 0),
  unique (user_id, id),
  unique (user_id, slot_id, exercise_id),
  foreign key (user_id, slot_id) references public.tor_routine_slots(user_id, id),
  foreign key (user_id, exercise_id) references public.tor_exercises(user_id, id)
);

create table public.tor_cycles (
  id uuid primary key,
  user_id uuid not null references auth.users(id),
  routine_id uuid not null,
  started_at timestamptz not null default now(),
  closed_at timestamptz,
  close_reason text check (close_reason in ('completed', 'reset')),
  unique (user_id, id),
  unique (user_id, routine_id, id),
  foreign key (user_id, routine_id) references public.tor_routines(user_id, id),
  check ((closed_at is null and close_reason is null) or (closed_at is not null and close_reason is not null))
);
create unique index tor_one_open_cycle on public.tor_cycles(user_id, routine_id) where closed_at is null;

create table public.tor_cycle_days (
  id uuid primary key,
  user_id uuid not null references auth.users(id),
  routine_id uuid not null,
  cycle_id uuid not null,
  day_id uuid not null,
  day_name_snapshot text not null,
  position_snapshot integer not null check (position_snapshot >= 0),
  status text not null default 'remaining' check (status in ('remaining', 'completed', 'skipped')),
  unique (user_id, id),
  unique (user_id, cycle_id, day_id),
  foreign key (user_id, routine_id, cycle_id) references public.tor_cycles(user_id, routine_id, id),
  foreign key (user_id, routine_id, day_id) references public.tor_routine_days(user_id, routine_id, id)
);

create table public.tor_workouts (
  id uuid primary key,
  user_id uuid not null references auth.users(id),
  routine_id uuid,
  day_id uuid,
  cycle_id uuid,
  routine_name_snapshot text,
  day_name_snapshot text,
  status text not null check (status in ('in_progress', 'completed', 'abandoned')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  workout_date date,
  notes text not null default '',
  unique (user_id, id),
  foreign key (user_id, routine_id) references public.tor_routines(user_id, id),
  foreign key (user_id, routine_id, day_id) references public.tor_routine_days(user_id, routine_id, id),
  foreign key (user_id, routine_id, cycle_id) references public.tor_cycles(user_id, routine_id, id),
  check ((routine_id is null and day_id is null and cycle_id is null) or (routine_id is not null and day_id is not null))
);

create table public.tor_workout_warmups (
  id uuid primary key,
  user_id uuid not null references auth.users(id),
  workout_id uuid not null,
  title_snapshot text not null,
  description_snapshot text not null default '',
  position integer not null check (position >= 0),
  checked boolean not null default false,
  unique (user_id, id),
  foreign key (user_id, workout_id) references public.tor_workouts(user_id, id)
);

create table public.tor_workout_exercises (
  id uuid primary key,
  user_id uuid not null references auth.users(id),
  workout_id uuid not null,
  planned_slot_id uuid,
  planned_exercise_id uuid,
  performed_exercise_id uuid,
  planned_name_snapshot text,
  performed_name_snapshot text,
  equipment_snapshot text,
  source text not null check (source in ('planned', 'substituted', 'added')),
  status text not null check (status in ('pending', 'completed', 'skipped')),
  tracking_type text not null check (tracking_type in ('strength', 'cardio')),
  position integer not null check (position >= 0),
  notes text not null default '',
  unique (user_id, id),
  foreign key (user_id, workout_id) references public.tor_workouts(user_id, id),
  foreign key (user_id, planned_slot_id) references public.tor_routine_slots(user_id, id),
  foreign key (user_id, planned_exercise_id) references public.tor_exercises(user_id, id),
  foreign key (user_id, performed_exercise_id) references public.tor_exercises(user_id, id)
);

create table public.tor_workout_sets (
  id uuid primary key,
  user_id uuid not null references auth.users(id),
  workout_exercise_id uuid not null,
  position integer not null check (position between 1 and 3),
  weight numeric check (weight is null or weight >= 0),
  weight_unit text not null default 'kg' check (weight_unit = 'kg'),
  reps integer not null check (reps >= 0),
  unique (user_id, id),
  unique (user_id, workout_exercise_id, position),
  foreign key (user_id, workout_exercise_id) references public.tor_workout_exercises(user_id, id)
);

create table public.tor_workout_cardio (
  workout_exercise_id uuid primary key,
  user_id uuid not null references auth.users(id),
  duration_minutes numeric not null check (duration_minutes >= 0),
  speed_kmh numeric check (speed_kmh >= 0),
  incline_degrees numeric check (incline_degrees >= 0),
  distance_km numeric check (distance_km >= 0),
  foreign key (user_id, workout_exercise_id) references public.tor_workout_exercises(user_id, id)
);

create index tor_exercise_history on public.tor_workout_exercises(user_id, performed_exercise_id);
create index tor_workouts_by_date on public.tor_workouts(user_id, started_at desc);
create index tor_days_by_routine on public.tor_routine_days(user_id, routine_id, position);
create index tor_slots_by_day on public.tor_routine_slots(user_id, day_id, position);
create index tor_workout_exercises_by_workout on public.tor_workout_exercises(user_id, workout_id, position);

-- This first migration intentionally grants read-only access. Writes require a
-- future, tested sync contract; do not turn on direct client writes prematurely.
do $$
declare table_name text;
begin
  foreach table_name in array array['tor_exercises','tor_exercise_links','tor_routines','tor_routine_days','tor_warmups','tor_rotation_groups','tor_rotation_options','tor_routine_slots','tor_slot_alternatives','tor_cycles','tor_cycle_days','tor_workouts','tor_workout_warmups','tor_workout_exercises','tor_workout_sets','tor_workout_cardio'] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('revoke all on public.%I from anon, authenticated', table_name);
    execute format('grant select on public.%I to authenticated', table_name);
    execute format('create policy owner_read on public.%I for select to authenticated using ((select auth.uid()) = user_id)', table_name);
  end loop;
end $$;
commit;
