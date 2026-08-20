-- =============================================================================
-- Life · Fase 3 — Financeiro
--
-- Todo valor monetário é bigint em centavos. Guardar reais em numeric decimal
-- também funcionaria, mas centavos inteiros eliminam qualquer discussão sobre
-- arredondamento entre o banco, a API e o JavaScript do navegador.
--
-- A coluna `competence` (AAAA-MM) é o que faz o relatório bater com o extrato:
-- uma compra no cartão pertence à fatura que a inclui, não ao mês da compra.
-- =============================================================================

create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  kind text not null default 'checking'
    check (kind in ('checking', 'savings', 'cash', 'credit', 'investment')),
  bank text,
  initial_balance_cents bigint not null default 0,
  credit_limit_cents bigint check (credit_limit_cents >= 0),
  closing_day smallint check (closing_day between 1 and 31),
  due_day smallint check (due_day between 1 and 31),
  color text not null default '#3b82f6',
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Cartão precisa de fechamento e vencimento; as demais contas, não.
  constraint credit_card_needs_cycle check (
    kind <> 'credit' or (closing_day is not null and due_day is not null)
  )
);

create index if not exists accounts_user_idx on public.accounts (user_id) where not archived;

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  kind text not null check (kind in ('income', 'expense')),
  color text not null default '#71717a',
  icon text not null default '📦',
  -- Palavras usadas para adivinhar a categoria pela descrição.
  keywords text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, name, kind)
);

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  account_id uuid not null references public.accounts (id) on delete cascade,
  transfer_account_id uuid references public.accounts (id) on delete set null,
  category_id uuid references public.categories (id) on delete set null,
  kind text not null check (kind in ('income', 'expense', 'transfer')),
  -- Sempre positivo: o sinal vem de `kind`, nunca do valor.
  amount_cents bigint not null check (amount_cents > 0),
  date date not null,
  competence text not null check (competence ~ '^\d{4}-\d{2}$'),
  description text not null default '',
  tags text[] not null default '{}',
  paid boolean not null default true,
  installment_group_id uuid,
  installment_n smallint check (installment_n > 0),
  installment_total smallint check (installment_total > 0),
  recurring_id uuid,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Transferência exige destino diferente da origem; os outros tipos não têm destino.
  constraint transfer_needs_target check (
    (kind = 'transfer' and transfer_account_id is not null and transfer_account_id <> account_id)
    or (kind <> 'transfer' and transfer_account_id is null)
  ),
  -- Parcela solta não existe: ou tem grupo, número e total, ou não tem nada.
  constraint installment_is_complete check (
    (installment_group_id is null and installment_n is null and installment_total is null)
    or (installment_group_id is not null and installment_n is not null and installment_total is not null
        and installment_n <= installment_total)
  )
);

create index if not exists transactions_user_competence_idx
  on public.transactions (user_id, competence, date desc);
create index if not exists transactions_account_idx on public.transactions (account_id, competence);
create index if not exists transactions_category_idx on public.transactions (category_id, competence);
create index if not exists transactions_group_idx
  on public.transactions (installment_group_id) where installment_group_id is not null;

create table if not exists public.budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  category_id uuid not null references public.categories (id) on delete cascade,
  competence text not null check (competence ~ '^\d{4}-\d{2}$'),
  limit_cents bigint not null check (limit_cents > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Um envelope por categoria por mês.
  unique (user_id, category_id, competence)
);

create table if not exists public.financial_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  target_cents bigint not null check (target_cents > 0),
  current_cents bigint not null default 0 check (current_cents >= 0),
  target_date date,
  account_id uuid references public.accounts (id) on delete set null,
  color text not null default '#22c55e',
  done boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.recurring_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  description text not null,
  account_id uuid not null references public.accounts (id) on delete cascade,
  category_id uuid references public.categories (id) on delete set null,
  kind text not null check (kind in ('income', 'expense')),
  amount_cents bigint not null check (amount_cents > 0),
  day_of_month smallint not null check (day_of_month between 1 and 31),
  start_date date not null default current_date,
  end_date date,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Triggers e RLS
-- -----------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'accounts', 'categories', 'transactions', 'budgets',
    'financial_goals', 'recurring_transactions'
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
