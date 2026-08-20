-- =============================================================================
-- Life · Fase 1 — Saúde e Alimentação
--
-- Toda tabela tem user_id e RLS ligado: o front fala direto com o Postgres e é
-- o banco que garante o isolamento, não o cliente. Sem policy, sem acesso.
-- =============================================================================

create extension if not exists "pgcrypto";

-- Mantém updated_at correto sem depender do cliente.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Perfil
-- -----------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null default '',
  birthdate date,
  sex text not null default 'male' check (sex in ('male', 'female')),
  height_cm numeric(5, 1) not null default 175 check (height_cm between 80 and 260),
  activity_level text not null default 'moderate'
    check (activity_level in ('sedentary', 'light', 'moderate', 'high', 'athlete')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

-- -----------------------------------------------------------------------------
-- Atividades e treinos
-- -----------------------------------------------------------------------------
create table if not exists public.activity_types (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  met numeric(4, 1) not null check (met > 0),
  category text not null default 'other'
    check (category in ('sport', 'strength', 'cardio', 'mobility', 'other')),
  icon text not null default '⭐',
  tracks_distance boolean not null default false,
  is_custom boolean not null default false,
  enabled boolean not null default false,
  weekly_goal smallint check (weekly_goal between 1 and 14),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, name)
);

create table if not exists public.workout_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  activity_type_id uuid not null references public.activity_types (id) on delete cascade,
  date date not null,
  duration_min integer not null check (duration_min > 0 and duration_min <= 1440),
  rpe smallint check (rpe between 1 and 10),
  calories_estimated integer not null default 0 check (calories_estimated >= 0),
  distance_km numeric(6, 2) check (distance_km >= 0),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists workout_sessions_user_date_idx
  on public.workout_sessions (user_id, date desc);

-- -----------------------------------------------------------------------------
-- Medidas e métricas diárias
-- -----------------------------------------------------------------------------
create table if not exists public.body_measurements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null,
  weight_kg numeric(5, 2) not null check (weight_kg between 20 and 400),
  body_fat_pct numeric(4, 1) check (body_fat_pct between 1 and 70),
  waist_cm numeric(5, 1),
  hip_cm numeric(5, 1),
  arm_cm numeric(5, 1),
  thigh_cm numeric(5, 1),
  chest_cm numeric(5, 1),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Uma pesagem por dia: registrar duas vezes no mesmo dia distorce a média móvel.
  unique (user_id, date)
);

create index if not exists body_measurements_user_date_idx
  on public.body_measurements (user_id, date desc);

create table if not exists public.health_metrics_daily (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null,
  sleep_hours numeric(3, 1) check (sleep_hours between 0 and 24),
  sleep_quality smallint check (sleep_quality between 1 and 5),
  steps integer check (steps >= 0),
  water_ml integer check (water_ml >= 0),
  mood smallint check (mood between 1 and 10),
  energy smallint check (energy between 1 and 10),
  resting_hr smallint check (resting_hr between 25 and 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, date)
);

-- -----------------------------------------------------------------------------
-- Plano de emagrecimento
-- -----------------------------------------------------------------------------
create table if not exists public.diet_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  start_date date not null default current_date,
  start_weight_kg numeric(5, 2) not null,
  target_weight_kg numeric(5, 2) not null,
  target_date date,
  bmr integer not null,
  tdee integer not null,
  daily_calories integer not null check (daily_calories >= 1000),
  daily_deficit integer not null check (daily_deficit >= 0),
  weekly_loss_kg numeric(4, 2) not null check (weekly_loss_kg >= 0),
  protein_g integer not null,
  fat_g integer not null,
  carb_g integer not null,
  estimated_date date not null,
  status text not null default 'active' check (status in ('active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Só um plano ativo por vez.
create unique index if not exists diet_plans_one_active_idx
  on public.diet_plans (user_id)
  where status = 'active';

-- -----------------------------------------------------------------------------
-- Alimentação
-- -----------------------------------------------------------------------------
create table if not exists public.foods (
  id uuid primary key default gen_random_uuid(),
  -- null = alimento do catálogo público (TACO), visível para todos.
  user_id uuid references auth.users (id) on delete cascade,
  name text not null,
  brand text,
  source text not null default 'custom' check (source in ('taco', 'off', 'custom')),
  barcode text,
  kcal numeric(7, 2) not null default 0,
  protein_g numeric(6, 2) not null default 0,
  carb_g numeric(6, 2) not null default 0,
  fat_g numeric(6, 2) not null default 0,
  fiber_g numeric(6, 2) not null default 0,
  serving_g numeric(6, 1) not null default 100,
  serving_label text not null default '100 g',
  favorite boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists foods_barcode_idx on public.foods (barcode) where barcode is not null;

-- Busca por nome sem depender de acentos ou do começo da palavra.
create extension if not exists "pg_trgm";
create index if not exists foods_name_trgm_idx on public.foods using gin (name gin_trgm_ops);

create table if not exists public.meal_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null,
  slot text not null check (
    slot in ('breakfast', 'morning_snack', 'lunch', 'afternoon_snack', 'dinner', 'supper')
  ),
  food_id uuid references public.foods (id) on delete set null,
  -- Nome copiado no momento do registro: se o alimento mudar depois,
  -- o histórico continua contando o que foi realmente comido.
  food_name text not null,
  quantity_g numeric(7, 1) not null check (quantity_g > 0),
  kcal numeric(7, 1) not null default 0,
  protein_g numeric(6, 1) not null default 0,
  carb_g numeric(6, 1) not null default 0,
  fat_g numeric(6, 1) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists meal_logs_user_date_idx on public.meal_logs (user_id, date desc);

-- -----------------------------------------------------------------------------
-- Triggers de updated_at
-- -----------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles', 'activity_types', 'workout_sessions', 'body_measurements',
    'health_metrics_daily', 'diet_plans', 'foods', 'meal_logs'
  ] loop
    execute format('drop trigger if exists touch_%1$s on public.%1$I', t);
    execute format(
      'create trigger touch_%1$s before update on public.%1$I
       for each row execute function public.touch_updated_at()', t
    );
  end loop;
end;
$$;

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles', 'activity_types', 'workout_sessions', 'body_measurements',
    'health_metrics_daily', 'diet_plans', 'meal_logs'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "own rows" on public.%I', t);
    execute format(
      'create policy "own rows" on public.%I
       for all to authenticated
       using (user_id = (select auth.uid()))
       with check (user_id = (select auth.uid()))', t
    );
  end loop;
end;
$$;

-- foods é misto: catálogo público (user_id null) + alimentos do usuário.
alter table public.foods enable row level security;

drop policy if exists "read catalog and own" on public.foods;
create policy "read catalog and own" on public.foods
  for select to authenticated
  using (user_id is null or user_id = (select auth.uid()));

drop policy if exists "write own" on public.foods;
create policy "write own" on public.foods
  for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists "update own" on public.foods;
create policy "update own" on public.foods
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "delete own" on public.foods;
create policy "delete own" on public.foods
  for delete to authenticated
  using (user_id = (select auth.uid()));
