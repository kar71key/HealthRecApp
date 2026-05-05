create table if not exists profiles (
  id text primary key,
  user_id text not null,
  timezone text not null,
  full_name text not null,
  email text,
  avatar_label text,
  age integer,
  height_cm double precision,
  weight_kg double precision,
  goal text,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  sync_status text not null
);

create unique index if not exists idx_profiles_user_id on profiles(user_id);

create table if not exists daily_logs (
  id text primary key,
  user_id text not null,
  local_date date not null,
  logged_at timestamptz not null,
  mood text not null,
  sleep_quality integer not null,
  sleep_hours double precision not null,
  hydration_liters double precision not null,
  symptom_summary text not null,
  food_note text not null,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  sync_status text not null,
  unique (user_id, local_date)
);

create table if not exists food_entries (
  id text primary key,
  user_id text not null,
  local_date date not null,
  occurred_at timestamptz not null,
  meal_type text not null,
  item_name text not null,
  quantity_value double precision not null,
  quantity_unit text not null,
  caffeine_mg double precision not null,
  is_caffeinated boolean not null,
  estimated_calories double precision,
  estimated_protein_g double precision,
  estimated_carbs_g double precision,
  estimated_fat_g double precision,
  source text not null,
  source_ref_id text,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  sync_status text not null
);

create table if not exists step_daily_summaries (
  id text primary key,
  user_id text not null,
  local_date date not null,
  step_count integer not null,
  step_calories_burned double precision not null default 0,
  activity_calories_burned double precision not null default 0,
  calories_burned double precision not null default 0,
  source text not null,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  sync_status text not null,
  unique (user_id, local_date)
);

alter table if exists step_daily_summaries
  add column if not exists step_calories_burned double precision not null default 0;

update step_daily_summaries
set step_calories_burned = calories_burned
where coalesce(step_calories_burned, 0) = 0;

alter table if exists step_daily_summaries
  add column if not exists activity_calories_burned double precision not null default 0;

alter table if exists step_daily_summaries
  add column if not exists calories_burned double precision not null default 0;

update step_daily_summaries
set calories_burned = coalesce(step_calories_burned, 0) + coalesce(activity_calories_burned, 0);

create table if not exists physical_activity_sessions (
  id text primary key,
  user_id text not null,
  local_date date not null,
  started_at timestamptz not null,
  ended_at timestamptz not null,
  category text not null,
  option_key text not null,
  title text not null,
  intensity_label text not null,
  met_value double precision not null,
  duration_seconds integer not null,
  calories_burned double precision not null,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  sync_status text not null
);

create table if not exists symptom_entries (
  id text primary key,
  user_id text not null,
  local_date date not null,
  symptom_name text not null,
  severity integer not null,
  note text not null,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  sync_status text not null
);

create table if not exists nutrition_scans (
  id text primary key,
  user_id text not null,
  title text not null,
  source text not null,
  scanned_at timestamptz not null,
  foods_count integer not null,
  total_calories double precision not null,
  protein_g double precision not null,
  carbs_g double precision not null,
  fat_g double precision not null,
  raw_payload_json text,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  sync_status text not null
);

create table if not exists insight_snapshots (
  id text primary key,
  user_id text not null,
  category text not null,
  title text not null,
  detail text not null,
  recommendation text not null,
  confidence text not null,
  sample_size integer not null,
  metric_delta double precision not null,
  generated_at timestamptz not null,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  sync_status text not null
);

alter table profiles enable row level security;
alter table daily_logs enable row level security;
alter table food_entries enable row level security;
alter table step_daily_summaries enable row level security;
alter table physical_activity_sessions enable row level security;
alter table symptom_entries enable row level security;
alter table nutrition_scans enable row level security;
alter table insight_snapshots enable row level security;

drop policy if exists profiles_owner_select on profiles;
drop policy if exists profiles_owner_insert on profiles;
drop policy if exists profiles_owner_update on profiles;
drop policy if exists profiles_owner_delete on profiles;
create policy profiles_owner_select on profiles for select using (auth.uid()::text = user_id);
create policy profiles_owner_insert on profiles for insert with check (auth.uid()::text = user_id);
create policy profiles_owner_update on profiles for update using (auth.uid()::text = user_id) with check (auth.uid()::text = user_id);
create policy profiles_owner_delete on profiles for delete using (auth.uid()::text = user_id);

drop policy if exists daily_logs_owner_select on daily_logs;
drop policy if exists daily_logs_owner_insert on daily_logs;
drop policy if exists daily_logs_owner_update on daily_logs;
drop policy if exists daily_logs_owner_delete on daily_logs;
create policy daily_logs_owner_select on daily_logs for select using (auth.uid()::text = user_id);
create policy daily_logs_owner_insert on daily_logs for insert with check (auth.uid()::text = user_id);
create policy daily_logs_owner_update on daily_logs for update using (auth.uid()::text = user_id) with check (auth.uid()::text = user_id);
create policy daily_logs_owner_delete on daily_logs for delete using (auth.uid()::text = user_id);

drop policy if exists food_entries_owner_select on food_entries;
drop policy if exists food_entries_owner_insert on food_entries;
drop policy if exists food_entries_owner_update on food_entries;
drop policy if exists food_entries_owner_delete on food_entries;
create policy food_entries_owner_select on food_entries for select using (auth.uid()::text = user_id);
create policy food_entries_owner_insert on food_entries for insert with check (auth.uid()::text = user_id);
create policy food_entries_owner_update on food_entries for update using (auth.uid()::text = user_id) with check (auth.uid()::text = user_id);
create policy food_entries_owner_delete on food_entries for delete using (auth.uid()::text = user_id);

drop policy if exists step_daily_summaries_owner_select on step_daily_summaries;
drop policy if exists step_daily_summaries_owner_insert on step_daily_summaries;
drop policy if exists step_daily_summaries_owner_update on step_daily_summaries;
drop policy if exists step_daily_summaries_owner_delete on step_daily_summaries;
create policy step_daily_summaries_owner_select on step_daily_summaries for select using (auth.uid()::text = user_id);
create policy step_daily_summaries_owner_insert on step_daily_summaries for insert with check (auth.uid()::text = user_id);
create policy step_daily_summaries_owner_update on step_daily_summaries for update using (auth.uid()::text = user_id) with check (auth.uid()::text = user_id);
create policy step_daily_summaries_owner_delete on step_daily_summaries for delete using (auth.uid()::text = user_id);

drop policy if exists physical_activity_sessions_owner_select on physical_activity_sessions;
drop policy if exists physical_activity_sessions_owner_insert on physical_activity_sessions;
drop policy if exists physical_activity_sessions_owner_update on physical_activity_sessions;
drop policy if exists physical_activity_sessions_owner_delete on physical_activity_sessions;
create policy physical_activity_sessions_owner_select on physical_activity_sessions for select using (auth.uid()::text = user_id);
create policy physical_activity_sessions_owner_insert on physical_activity_sessions for insert with check (auth.uid()::text = user_id);
create policy physical_activity_sessions_owner_update on physical_activity_sessions for update using (auth.uid()::text = user_id) with check (auth.uid()::text = user_id);
create policy physical_activity_sessions_owner_delete on physical_activity_sessions for delete using (auth.uid()::text = user_id);

drop policy if exists symptom_entries_owner_select on symptom_entries;
drop policy if exists symptom_entries_owner_insert on symptom_entries;
drop policy if exists symptom_entries_owner_update on symptom_entries;
drop policy if exists symptom_entries_owner_delete on symptom_entries;
create policy symptom_entries_owner_select on symptom_entries for select using (auth.uid()::text = user_id);
create policy symptom_entries_owner_insert on symptom_entries for insert with check (auth.uid()::text = user_id);
create policy symptom_entries_owner_update on symptom_entries for update using (auth.uid()::text = user_id) with check (auth.uid()::text = user_id);
create policy symptom_entries_owner_delete on symptom_entries for delete using (auth.uid()::text = user_id);

drop policy if exists nutrition_scans_owner_select on nutrition_scans;
drop policy if exists nutrition_scans_owner_insert on nutrition_scans;
drop policy if exists nutrition_scans_owner_update on nutrition_scans;
drop policy if exists nutrition_scans_owner_delete on nutrition_scans;
create policy nutrition_scans_owner_select on nutrition_scans for select using (auth.uid()::text = user_id);
create policy nutrition_scans_owner_insert on nutrition_scans for insert with check (auth.uid()::text = user_id);
create policy nutrition_scans_owner_update on nutrition_scans for update using (auth.uid()::text = user_id) with check (auth.uid()::text = user_id);
create policy nutrition_scans_owner_delete on nutrition_scans for delete using (auth.uid()::text = user_id);

drop policy if exists insight_snapshots_owner_select on insight_snapshots;
drop policy if exists insight_snapshots_owner_insert on insight_snapshots;
drop policy if exists insight_snapshots_owner_update on insight_snapshots;
drop policy if exists insight_snapshots_owner_delete on insight_snapshots;
create policy insight_snapshots_owner_select on insight_snapshots for select using (auth.uid()::text = user_id);
create policy insight_snapshots_owner_insert on insight_snapshots for insert with check (auth.uid()::text = user_id);
create policy insight_snapshots_owner_update on insight_snapshots for update using (auth.uid()::text = user_id) with check (auth.uid()::text = user_id);
create policy insight_snapshots_owner_delete on insight_snapshots for delete using (auth.uid()::text = user_id);
