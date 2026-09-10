-- Compromisso com período: além da data de entrega, a data em que começa.
--
-- Fica nula no compromisso de um dia só — que é a maioria —, e é o que permite
-- o trabalho de três semanas aparecer no calendário nas duas pontas.
alter table public.deadlines
  add column if not exists start_date date;

-- Início depois da entrega é sempre erro de digitação.
alter table public.deadlines
  drop constraint if exists deadlines_period_check;

alter table public.deadlines
  add constraint deadlines_period_check
  check (start_date is null or start_date <= date);
