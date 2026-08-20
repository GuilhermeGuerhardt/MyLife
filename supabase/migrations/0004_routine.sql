-- =============================================================================
-- Life · Fase 4 — Rotina: hábitos, agenda e dashboard
--
-- A agenda não ganha tabela: ela é uma leitura sobre o que já existe
-- (disciplinas, deadlines, sessões, transações, recorrentes). Duplicar esses
-- registros num "eventos" próprio criaria duas verdades para o mesmo
-- compromisso, e a segunda envelheceria em silêncio.
--
-- Os insights também não são materializados: são calculados sobre a série
-- semanal a cada abertura. Guardar conclusão derivada de dado que muda todo dia
-- é garantir que a conclusão fique errada.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Hábitos
-- -----------------------------------------------------------------------------
create table if not exists public.habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  icon text not null default '🎯',
  area text not null default 'other' check (area in ('health', 'education', 'finance', 'other')),
  cadence text not null default 'daily' check (cadence in ('daily', 'weekly')),
  -- Dias por semana esperados. Hábito diário grava 7.
  target_per_week smallint not null default 7 check (target_per_week between 1 and 7),
  archived boolean not null default false,
  position smallint not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists habits_user_idx on public.habits (user_id, position) where not archived;

create table if not exists public.habit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  habit_id uuid not null references public.habits (id) on delete cascade,
  date date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Um registro por hábito por dia: marcar duas vezes é o mesmo dia cumprido,
  -- e sem esta trava a sequência contaria o dobro.
  unique (habit_id, date)
);

create index if not exists habit_logs_user_date_idx on public.habit_logs (user_id, date);
create index if not exists habit_logs_habit_idx on public.habit_logs (habit_id, date desc);

-- -----------------------------------------------------------------------------
-- Layout do dashboard
-- -----------------------------------------------------------------------------
-- Só o que o usuário personalizou vira linha. Widget sem linha assume o padrão
-- do catálogo — é o que faz um widget novo aparecer para quem já mexeu na tela,
-- em vez de sumir por falta de registro.
create table if not exists public.dashboard_widgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  widget text not null,
  position smallint not null default 0,
  visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, widget)
);

-- -----------------------------------------------------------------------------
-- Triggers e RLS
-- -----------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array['habits', 'habit_logs', 'dashboard_widgets'] loop
    execute format('drop trigger if exists touch_%1$s on public.%1$I', t);
    execute format(
      'create trigger touch_%1$s before update on public.%1$I
       for each row execute function public.touch_updated_at()', t
    );

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
