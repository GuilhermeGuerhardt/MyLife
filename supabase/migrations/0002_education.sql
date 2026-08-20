-- =============================================================================
-- Life · Fase 2 — Faculdade, Cursos e Caderno
--
-- Faculdade e cursos livres compartilham as mesmas tabelas; a coluna `track`
-- separa os dois. Isso evita duplicar grade, anotações e progresso.
-- =============================================================================

create table if not exists public.institutions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  track text not null check (track in ('academic', 'course')),
  link text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, name, track)
);

create table if not exists public.programs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  institution_id uuid references public.institutions (id) on delete set null,
  track text not null check (track in ('academic', 'course')),
  name text not null,
  degree text not null default 'graduacao'
    check (degree in ('graduacao', 'pos', 'mba', 'tecnico', 'livre')),
  status text not null default 'active'
    check (status in ('planned', 'active', 'paused', 'done', 'dropped')),
  total_hours integer not null default 0 check (total_hours >= 0),
  complementary_hours_required integer not null default 0 check (complementary_hours_required >= 0),
  complementary_hours_done integer not null default 0 check (complementary_hours_done >= 0),
  start_date date,
  expected_end date,
  current_term smallint check (current_term between 1 and 30),
  passing_grade numeric(4, 2) not null default 6 check (passing_grade >= 0),
  link text,
  instructor text,
  cost numeric(10, 2) check (cost >= 0),
  rating smallint check (rating between 1 and 5),
  certificate_url text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists programs_user_track_idx on public.programs (user_id, track, status);

create table if not exists public.subjects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  program_id uuid not null references public.programs (id) on delete cascade,
  name text not null,
  code text,
  hours integer not null default 0 check (hours >= 0),
  credits integer not null default 0 check (credits >= 0),
  period smallint check (period between 1 and 30),
  status text not null default 'pending'
    check (status in ('pending', 'doing', 'done', 'exempted', 'failed')),
  term_label text,
  grade numeric(4, 2) check (grade >= 0),
  absences integer not null default 0 check (absences >= 0),
  total_classes integer check (total_classes >= 0),
  -- IDs de outras disciplinas do mesmo curso. Array em vez de tabela de
  -- ligação: a lista é curta, sempre lida junto da disciplina e nunca
  -- consultada no sentido inverso.
  prerequisites uuid[] not null default '{}',
  weekday smallint check (weekday between 0 and 6),
  start_time time,
  end_time time,
  room text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists subjects_program_idx on public.subjects (program_id, period);

create table if not exists public.assessments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  subject_id uuid not null references public.subjects (id) on delete cascade,
  name text not null,
  weight numeric(6, 2) not null default 1 check (weight > 0),
  grade numeric(4, 2) check (grade >= 0),
  date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists assessments_subject_idx on public.assessments (subject_id);

create table if not exists public.course_lessons (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  program_id uuid not null references public.programs (id) on delete cascade,
  module text not null default 'Geral',
  title text not null,
  duration_min integer not null default 0 check (duration_min >= 0),
  done boolean not null default false,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists course_lessons_program_idx on public.course_lessons (program_id, position);

-- -----------------------------------------------------------------------------
-- Caderno
-- -----------------------------------------------------------------------------
create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  track text not null check (track in ('academic', 'course')),
  program_id uuid references public.programs (id) on delete set null,
  subject_id uuid references public.subjects (id) on delete set null,
  title text not null default '',
  content text not null default '',
  tags text[] not null default '{}',
  pinned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists notes_user_track_idx on public.notes (user_id, track);
create index if not exists notes_tags_idx on public.notes using gin (tags);

-- Busca em português no título e no conteúdo. A coluna é gerada, então nunca
-- fica dessincronizada do texto.
alter table public.notes
  drop column if exists search_vector;

alter table public.notes
  add column search_vector tsvector
  generated always as (
    setweight(to_tsvector('portuguese', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('portuguese', coalesce(content, '')), 'B')
  ) stored;

create index if not exists notes_search_idx on public.notes using gin (search_vector);

-- -----------------------------------------------------------------------------
-- Provas, trabalhos e entregas
-- -----------------------------------------------------------------------------
create table if not exists public.deadlines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  program_id uuid references public.programs (id) on delete cascade,
  subject_id uuid references public.subjects (id) on delete cascade,
  title text not null,
  kind text not null default 'entrega' check (kind in ('prova', 'trabalho', 'entrega', 'aula')),
  date date not null,
  done boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists deadlines_user_date_idx on public.deadlines (user_id, date) where not done;

-- -----------------------------------------------------------------------------
-- Triggers e RLS
-- -----------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'institutions', 'programs', 'subjects', 'assessments',
    'course_lessons', 'notes', 'deadlines'
  ] loop
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
