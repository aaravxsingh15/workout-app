-- IronLog v1.0 - cloud schema (PostgreSQL / Supabase)
-- All private tables carry user_id and are protected by Row Level Security.
-- Weights are stored in KG, distances in METERS, durations in SECONDS (canonical units).

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------------------------
-- Shared trigger: server-side sync cursor. Clients compare `updated_at` (client clock, last-write-wins)
-- but pull incrementally using `server_updated_at` (server clock) so clock skew cannot hide rows.
-- ---------------------------------------------------------------------------------------------
create or replace function public.set_server_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.server_updated_at := clock_timestamp();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- profiles (1:1 with auth.users)
-- ---------------------------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '',
  units text not null default 'kg' check (units in ('kg', 'lb')),
  training_level text not null default 'beginner' check (training_level in ('beginner', 'intermediate', 'advanced')),
  height_cm numeric,
  bodyweight_kg numeric,
  default_rest_sec integer not null default 90 check (default_rest_sec between 0 and 3600),
  theme text not null default 'dark' check (theme in ('dark', 'light', 'system')),
  vibration_enabled boolean not null default true,
  show_rpe boolean not null default true,
  show_rir boolean not null default false,
  prefill_mode text not null default 'previous_set' check (prefill_mode in ('previous_set', 'previous_workout', 'none')),
  auto_rest_timer boolean not null default true,
  bar_weight_kg numeric not null default 20,
  plates_json jsonb not null default '[25,20,15,10,5,2.5,1.25]'::jsonb,
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  server_updated_at timestamptz not null default clock_timestamp()
);

-- ---------------------------------------------------------------------------------------------
-- exercises: system library (user_id null, is_system true) + per-user custom exercises.
-- id is text so system exercises have stable, human-readable ids ("sys_bench_press_barbell").
-- ---------------------------------------------------------------------------------------------
create table public.exercises (
  id text primary key,
  user_id uuid references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  aliases text[] not null default '{}',
  tracking_mode text not null default 'weight_reps'
    check (tracking_mode in ('weight_reps','bodyweight_reps','assisted_bodyweight','duration','distance_duration','distance_weight','reps_only','time_weight','custom')),
  primary_muscle text not null default 'other',
  equipment text not null default 'other',
  movement_category text not null default '',
  instructions text not null default '',
  personal_notes text not null default '',
  is_system boolean not null default false,
  is_unilateral boolean not null default false,
  custom_fields jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  server_updated_at timestamptz not null default clock_timestamp(),
  constraint exercises_owner_ck check ((is_system and user_id is null) or (not is_system and user_id is not null))
);
create index exercises_user_idx on public.exercises (user_id);

create table public.exercise_secondary_muscles (
  exercise_id text not null references public.exercises (id) on delete cascade,
  muscle text not null,
  primary key (exercise_id, muscle)
);

-- Favorites: one row per (user, exercise).
create table public.favorites (
  user_id uuid not null references auth.users (id) on delete cascade,
  exercise_id text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  server_updated_at timestamptz not null default clock_timestamp(),
  primary key (user_id, exercise_id)
);

-- ---------------------------------------------------------------------------------------------
-- routines
-- ---------------------------------------------------------------------------------------------
create table public.routine_folders (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  server_updated_at timestamptz not null default clock_timestamp()
);

create table public.routines (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  folder_id uuid references public.routine_folders (id) on delete set null,
  name text not null,
  description text not null default '',
  notes text not null default '',
  position integer not null default 0,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  server_updated_at timestamptz not null default clock_timestamp()
);

-- Groups link 2+ exercises (superset / tri-set / circuit). Owned by a routine OR a workout.
create table public.exercise_groups (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  routine_id uuid references public.routines (id) on delete cascade,
  workout_id uuid, -- FK added after workouts is created
  group_type text not null default 'superset' check (group_type in ('superset','triset','circuit')),
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  server_updated_at timestamptz not null default clock_timestamp(),
  constraint exercise_groups_owner_ck check (routine_id is not null or workout_id is not null)
);

-- exercise_id is intentionally NOT a foreign key: history must survive exercise edits/deletes.
create table public.routine_exercises (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  routine_id uuid not null references public.routines (id) on delete cascade,
  exercise_id text not null,
  position integer not null default 0,
  group_id uuid references public.exercise_groups (id) on delete set null,
  rest_sec integer,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  server_updated_at timestamptz not null default clock_timestamp()
);

create table public.routine_sets (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  routine_exercise_id uuid not null references public.routine_exercises (id) on delete cascade,
  position integer not null default 0,
  set_type text not null default 'normal' check (set_type in ('warmup','normal','drop','failure','backoff','top','amrap','other')),
  target_reps_min integer,
  target_reps_max integer,
  target_weight_kg numeric,
  target_duration_sec integer,
  target_distance_m numeric,
  target_rpe numeric check (target_rpe is null or target_rpe between 1 and 10),
  target_rir integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  server_updated_at timestamptz not null default clock_timestamp()
);

-- ---------------------------------------------------------------------------------------------
-- workouts (completed sessions are historical snapshots: names/muscles/modes are copied in)
-- ---------------------------------------------------------------------------------------------
create table public.workouts (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  routine_id uuid, -- provenance only; deliberately not a FK so deleting a routine never touches history
  routine_name text,
  title text not null default '',
  status text not null default 'completed' check (status in ('active','completed')),
  started_at timestamptz not null,
  ended_at timestamptz,
  bodyweight_kg numeric,
  notes text not null default '',
  location text not null default '',
  rating integer check (rating is null or rating between 1 and 5),
  energy integer check (energy is null or energy between 1 and 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  server_updated_at timestamptz not null default clock_timestamp()
);
create index workouts_user_started_idx on public.workouts (user_id, started_at desc);

alter table public.exercise_groups
  add constraint exercise_groups_workout_fk foreign key (workout_id) references public.workouts (id) on delete cascade;

create table public.workout_exercises (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  workout_id uuid not null references public.workouts (id) on delete cascade,
  exercise_id text not null,
  exercise_name text not null,
  primary_muscle text not null default 'other',
  tracking_mode text not null default 'weight_reps',
  is_unilateral boolean not null default false,
  custom_fields jsonb not null default '[]'::jsonb,
  position integer not null default 0,
  group_id uuid references public.exercise_groups (id) on delete set null,
  rest_sec integer,
  notes text not null default '',
  replaced_from_exercise_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  server_updated_at timestamptz not null default clock_timestamp()
);
create index workout_exercises_workout_idx on public.workout_exercises (workout_id);
create index workout_exercises_user_exercise_idx on public.workout_exercises (user_id, exercise_id);

create table public.workout_sets (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  workout_id uuid not null references public.workouts (id) on delete cascade,
  workout_exercise_id uuid not null references public.workout_exercises (id) on delete cascade,
  position integer not null default 0,
  set_type text not null default 'normal' check (set_type in ('warmup','normal','drop','failure','backoff','top','amrap','other')),
  weight_kg numeric,
  added_weight_kg numeric,
  assistance_kg numeric,
  reps integer,
  duration_sec integer,
  distance_m numeric,
  rpe numeric check (rpe is null or rpe between 1 and 10),
  rir integer check (rir is null or rir between 0 and 10),
  side text not null default 'both' check (side in ('both','left','right')),
  is_completed boolean not null default false,
  completed_at timestamptz,
  note text not null default '',
  rest_sec integer,
  plan_reps_min integer,
  plan_reps_max integer,
  plan_weight_kg numeric,
  plan_duration_sec integer,
  plan_distance_m numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  server_updated_at timestamptz not null default clock_timestamp()
);
create index workout_sets_we_idx on public.workout_sets (workout_exercise_id);
create index workout_sets_user_workout_idx on public.workout_sets (user_id, workout_id);

create table public.bodyweight_entries (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  entry_date date not null,
  weight_kg numeric not null check (weight_kg > 0),
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  server_updated_at timestamptz not null default clock_timestamp()
);
create index bodyweight_user_date_idx on public.bodyweight_entries (user_id, entry_date desc);

-- ---------------------------------------------------------------------------------------------
-- server_updated_at triggers + sync-cursor indexes
-- ---------------------------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'profiles','exercises','favorites','routine_folders','routines','exercise_groups','routine_exercises',
    'routine_sets','workouts','workout_exercises','workout_sets','bodyweight_entries'
  ] loop
    execute format('create trigger %I before insert or update on public.%I for each row execute function public.set_server_updated_at()', t || '_server_ts', t);
    if t <> 'profiles' and t <> 'exercises' then
      execute format('create index %I on public.%I (user_id, server_updated_at)', t || '_sync_idx', t);
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.exercises enable row level security;
alter table public.exercise_secondary_muscles enable row level security;
alter table public.favorites enable row level security;
alter table public.routine_folders enable row level security;
alter table public.routines enable row level security;
alter table public.exercise_groups enable row level security;
alter table public.routine_exercises enable row level security;
alter table public.routine_sets enable row level security;
alter table public.workouts enable row level security;
alter table public.workout_exercises enable row level security;
alter table public.workout_sets enable row level security;
alter table public.bodyweight_entries enable row level security;

-- profiles: id = auth.uid()
create policy profiles_select on public.profiles for select to authenticated using (id = (select auth.uid()));
create policy profiles_insert on public.profiles for insert to authenticated with check (id = (select auth.uid()));
create policy profiles_update on public.profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy profiles_delete on public.profiles for delete to authenticated using (id = (select auth.uid()));

-- exercises: system library is readable by everyone signed in; custom exercises only by their owner.
create policy exercises_select on public.exercises for select to authenticated
  using (is_system or user_id = (select auth.uid()));
create policy exercises_insert on public.exercises for insert to authenticated
  with check (not is_system and user_id = (select auth.uid()));
create policy exercises_update on public.exercises for update to authenticated
  using (not is_system and user_id = (select auth.uid()))
  with check (not is_system and user_id = (select auth.uid()));
create policy exercises_delete on public.exercises for delete to authenticated
  using (not is_system and user_id = (select auth.uid()));

create policy esm_select on public.exercise_secondary_muscles for select to authenticated
  using (exists (select 1 from public.exercises e where e.id = exercise_id and (e.is_system or e.user_id = (select auth.uid()))));
create policy esm_write on public.exercise_secondary_muscles for all to authenticated
  using (exists (select 1 from public.exercises e where e.id = exercise_id and not e.is_system and e.user_id = (select auth.uid())))
  with check (exists (select 1 from public.exercises e where e.id = exercise_id and not e.is_system and e.user_id = (select auth.uid())));

-- every other private table: strictly own rows
do $$
declare t text;
begin
  foreach t in array array[
    'favorites','routine_folders','routines','exercise_groups','routine_exercises','routine_sets',
    'workouts','workout_exercises','workout_sets','bodyweight_entries'
  ] loop
    execute format('create policy %I on public.%I for select to authenticated using (user_id = (select auth.uid()))', t || '_select', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (user_id = (select auth.uid()))', t || '_insert', t);
    execute format('create policy %I on public.%I for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t || '_update', t);
    execute format('create policy %I on public.%I for delete to authenticated using (user_id = (select auth.uid()))', t || '_delete', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------------------------
-- New-user bootstrap: create the profile row when an auth user is created.
-- ---------------------------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------------------------
-- Account deletion: a signed-in user can delete ONLY their own account. Every table above
-- cascades from auth.users, so all their data goes with it. No service-role key needed in the app.
-- ---------------------------------------------------------------------------------------------
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
