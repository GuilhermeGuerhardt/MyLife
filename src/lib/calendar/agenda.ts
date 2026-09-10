/**
 * Agenda unificada.
 *
 * O calendário só vira algo útil quando mostra tudo junto: a prova de terça, o
 * treino de quarta, a fatura que vence quinta. Separado por módulo, cada um
 * deles já existe em outra tela — o valor está na sobreposição, que é onde os
 * conflitos aparecem.
 *
 * Tudo aqui é função pura sobre listas já filtradas. Cada origem tem seu
 * construtor, e `buildAgenda` só junta e ordena — assim dá para testar cada
 * regra isoladamente e adicionar uma origem nova sem tocar nas outras.
 */

import { addDays, eachDay, weekdayOf } from '@/lib/dates'
import { addMonths, dateInCompetence, statementPeriod, toCompetence } from '@/lib/finance/billing'

export type AgendaSource =
  | 'class'
  | 'exam'
  | 'assignment'
  | 'workout'
  | 'bill'
  | 'invoice'
  | 'recurring'
  | 'goal'
  | 'term'
  | 'plan'

export type AgendaArea = 'health' | 'education' | 'finance'

export interface AgendaEvent {
  id: string
  date: string
  /** HH:MM, ou nulo quando o compromisso é do dia inteiro. */
  time: string | null
  endTime: string | null
  title: string
  detail: string | null
  source: AgendaSource
  area: AgendaArea
  /** Rota que abre o registro de origem. */
  href: string | null
  done: boolean
  /** Valor em centavos, nas origens financeiras. */
  amountCents?: number
}

export const SOURCE_LABELS: Record<AgendaSource, string> = {
  class: 'Aula',
  exam: 'Prova',
  assignment: 'Entrega',
  workout: 'Treino',
  bill: 'Conta',
  invoice: 'Fatura',
  recurring: 'Recorrente',
  goal: 'Meta',
  term: 'Curso',
  plan: 'Plano',
}

/**
 * A classe que dá a cor de cada área.
 *
 * Ela redefine `--accent` no elemento, então tudo que estiver dentro — ponto,
 * etiqueta, texto — sai na cor do módulo sem ninguém escrever a cor à mão.
 * Mora aqui, e não na tela do calendário, porque o painel de início pinta os
 * mesmos compromissos: duas tabelas separadas sairiam do lugar na primeira vez
 * que uma cor mudasse.
 */
export const AREA_ACCENT: Record<AgendaArea, string> = {
  health: 'accent-health',
  education: 'accent-education',
  finance: 'accent-finance',
}

const AREA_OF: Record<AgendaSource, AgendaArea> = {
  class: 'education',
  exam: 'education',
  assignment: 'education',
  workout: 'health',
  bill: 'finance',
  invoice: 'finance',
  recurring: 'finance',
  goal: 'finance',
  term: 'education',
  plan: 'health',
}

// ---------------------------------------------------------------------------
// Aulas — a grade semanal projetada sobre o intervalo
// ---------------------------------------------------------------------------

export interface SubjectLike {
  id: string
  program_id: string
  name: string
  status: string
  weekday: number | null
  start_time: string | null
  end_time: string | null
  room: string | null
}

/**
 * Só disciplinas em curso geram aula: uma matéria concluída no semestre
 * passado ainda tem dia e horário cadastrados, e projetá-la encheria a agenda
 * de aulas que não existem mais.
 */
export function classEvents(subjects: SubjectLike[], from: string, to: string): AgendaEvent[] {
  const active = subjects.filter((s) => s.status === 'doing' && s.weekday !== null)
  if (active.length === 0) return []

  const events: AgendaEvent[] = []
  for (const date of eachDay(from, to)) {
    const weekday = weekdayOf(date)
    for (const subject of active) {
      if (subject.weekday !== weekday) continue
      events.push({
        id: `class:${subject.id}:${date}`,
        date,
        time: subject.start_time,
        endTime: subject.end_time,
        title: subject.name,
        detail: subject.room ? `Sala ${subject.room}` : null,
        source: 'class',
        area: 'education',
        href: `/faculdade/${subject.program_id}`,
        done: false,
      })
    }
  }
  return events
}

// ---------------------------------------------------------------------------
// Provas e entregas
// ---------------------------------------------------------------------------

export interface DeadlineLike {
  id: string
  title: string
  kind: 'prova' | 'trabalho' | 'entrega' | 'aula'
  start_date?: string | null
  date: string
  done: boolean
  program_id: string | null
  subject_id: string | null
  notes: string | null
}

/**
 * Provas, entregas e tudo que foi marcado à mão.
 *
 * Compromisso com data de início vira dois marcos no calendário — o dia em que
 * começa e o dia em que vence. Pintar todos os dias entre os dois encheria a
 * grade do mês: um trabalho de três semanas apagaria o resto da vida da pessoa
 * embaixo dele. As duas pontas são o que se precisa enxergar.
 *
 * `programHref` recebe o id do curso e devolve a rota certa: faculdade e curso
 * livre moram em telas diferentes.
 */
export function deadlineEvents(
  deadlines: DeadlineLike[],
  subjectName: (id: string | null) => string | null,
  programHref?: (id: string) => string | null,
): AgendaEvent[] {
  const events: AgendaEvent[] = []

  for (const deadline of deadlines) {
    const href = deadline.program_id
      ? (programHref?.(deadline.program_id) ?? `/faculdade/${deadline.program_id}`)
      : null
    const source: AgendaSource =
      deadline.kind === 'prova' ? 'exam' : deadline.kind === 'aula' ? 'class' : 'assignment'
    const detail = subjectName(deadline.subject_id) ?? deadline.notes

    const temInicio = Boolean(deadline.start_date && deadline.start_date !== deadline.date)

    if (temInicio) {
      events.push({
        id: `deadline-start:${deadline.id}`,
        date: deadline.start_date!,
        time: null,
        endTime: null,
        title: deadline.title,
        detail: detail ? `Início · ${detail}` : 'Início',
        source,
        area: 'education',
        href,
        done: deadline.done,
      })
    }

    events.push({
      id: `deadline:${deadline.id}`,
      date: deadline.date,
      time: null,
      endTime: null,
      title: deadline.title,
      detail: temInicio ? (detail ? `Entrega · ${detail}` : 'Entrega') : detail,
      source,
      area: 'education',
      href,
      done: deadline.done,
    })
  }

  return events
}

export interface AssessmentLike {
  id: string
  subject_id: string
  name: string
  date: string | null
  grade: number | null
}

/**
 * Avaliação com data vira compromisso — e some da agenda quando a nota chega:
 * prova feita não é mais prazo, é histórico.
 */
export function assessmentEvents(
  assessments: AssessmentLike[],
  subject: (id: string) => { name: string; program_id: string } | null,
  programHref?: (id: string) => string | null,
): AgendaEvent[] {
  return assessments
    .filter((item) => item.date !== null && item.grade === null)
    .map((item) => {
      const info = subject(item.subject_id)
      return {
        id: `assessment:${item.id}`,
        date: item.date!,
        time: null,
        endTime: null,
        title: info ? `${item.name} · ${info.name}` : item.name,
        detail: 'Avaliação sem nota lançada',
        source: 'exam' as const,
        area: 'education' as const,
        href: info
          ? (programHref?.(info.program_id) ?? `/faculdade/${info.program_id}`)
          : null,
        done: false,
      }
    })
}

// ---------------------------------------------------------------------------
// Treinos realizados
// ---------------------------------------------------------------------------

export interface SessionLike {
  id: string
  activity_type_id: string
  date: string
  duration_min: number
  calories_estimated: number
}

export function workoutEvents(
  sessions: SessionLike[],
  activityName: (id: string) => string,
): AgendaEvent[] {
  return sessions.map((session) => ({
    id: `session:${session.id}`,
    date: session.date,
    time: null,
    endTime: null,
    title: activityName(session.activity_type_id),
    detail: `${session.duration_min} min · ${Math.round(session.calories_estimated)} kcal`,
    source: 'workout' as const,
    area: 'health' as const,
    href: '/saude/atividades',
    // Treino registrado é treino feito.
    done: true,
  }))
}

// ---------------------------------------------------------------------------
// Financeiro: contas a pagar, faturas e recorrentes
// ---------------------------------------------------------------------------

export interface TransactionLike {
  id: string
  account_id: string
  kind: 'income' | 'expense' | 'transfer'
  amount_cents: number
  date: string
  description: string
  paid: boolean
}

export interface AccountLike {
  id: string
  name: string
  kind: string
  closing_day: number | null
  due_day: number | null
}

/**
 * Despesa não paga vira conta a pagar na agenda. Compra no cartão fica de
 * fora: ela não se paga sozinha, é a fatura que vence — e a fatura entra em
 * `invoiceEvents`. Sem essa separação a mesma despesa apareceria duas vezes.
 */
export function billEvents(
  transactions: TransactionLike[],
  accounts: AccountLike[],
  from: string,
  to: string,
): AgendaEvent[] {
  const cardIds = new Set(accounts.filter((a) => a.kind === 'credit').map((a) => a.id))

  return transactions
    .filter(
      (tx) =>
        tx.kind === 'expense' &&
        !tx.paid &&
        !cardIds.has(tx.account_id) &&
        tx.date >= from &&
        tx.date <= to,
    )
    .map((tx) => ({
      id: `bill:${tx.id}`,
      date: tx.date,
      time: null,
      endTime: null,
      title: tx.description || 'Despesa',
      detail: accounts.find((a) => a.id === tx.account_id)?.name ?? null,
      source: 'bill' as const,
      area: 'finance' as const,
      href: '/financeiro/transacoes',
      done: false,
      amountCents: tx.amount_cents,
    }))
}

/** Vencimento de cada fatura de cartão dentro do intervalo, com o total dela. */
export function invoiceEvents(
  accounts: AccountLike[],
  transactions: TransactionLike[],
  from: string,
  to: string,
): AgendaEvent[] {
  const events: AgendaEvent[] = []

  for (const account of accounts) {
    if (account.kind !== 'credit' || account.closing_day === null || account.due_day === null) {
      continue
    }
    const card = { closingDay: account.closing_day, dueDay: account.due_day }

    // Uma competência a mais de cada lado: a fatura de um mês pode vencer no
    // seguinte, e a do mês anterior pode vencer dentro do intervalo.
    let competence = addMonths(toCompetence(from), -1)
    const lastCompetence = addMonths(toCompetence(to), 1)

    while (competence <= lastCompetence) {
      const period = statementPeriod(competence, card)
      if (period.dueDate >= from && period.dueDate <= to) {
        const total = transactions
          .filter((tx) => tx.account_id === account.id && tx.date >= period.start && tx.date <= period.end)
          .reduce((sum, tx) => sum + (tx.kind === 'income' ? -tx.amount_cents : tx.amount_cents), 0)

        if (total > 0) {
          events.push({
            id: `invoice:${account.id}:${competence}`,
            date: period.dueDate,
            time: null,
            endTime: null,
            title: `Fatura ${account.name}`,
            detail: `Fechou em ${period.end}`,
            source: 'invoice',
            area: 'finance',
            href: '/financeiro/contas',
            done: false,
            amountCents: total,
          })
        }
      }
      competence = addMonths(competence, 1)
    }
  }

  return events
}

export interface RecurringLike {
  id: string
  description: string
  kind: 'income' | 'expense'
  amount_cents: number
  day_of_month: number
  start_date: string
  end_date: string | null
  active: boolean
}

/**
 * Projeta as recorrentes no intervalo. São previsões, não lançamentos: só
 * aparecem na agenda para o mês não terminar em surpresa.
 */
export function recurringEvents(
  recurring: RecurringLike[],
  from: string,
  to: string,
): AgendaEvent[] {
  const events: AgendaEvent[] = []

  for (const rule of recurring) {
    if (!rule.active || rule.kind !== 'expense') continue

    let competence = toCompetence(from)
    const lastCompetence = toCompetence(to)

    while (competence <= lastCompetence) {
      const date = dateInCompetence(competence, rule.day_of_month)
      const withinRule = date >= rule.start_date && (!rule.end_date || date <= rule.end_date)

      if (withinRule && date >= from && date <= to) {
        events.push({
          id: `recurring:${rule.id}:${competence}`,
          date,
          time: null,
          endTime: null,
          title: rule.description,
          detail: 'Previsto',
          source: 'recurring',
          area: 'finance',
          href: '/financeiro/transacoes',
          done: false,
          amountCents: rule.amount_cents,
        })
      }
      competence = addMonths(competence, 1)
    }
  }

  return events
}

// ---------------------------------------------------------------------------
// Metas financeiras
// ---------------------------------------------------------------------------

export interface GoalLike {
  id: string
  name: string
  target_cents: number
  current_cents: number
  target_date: string | null
  done: boolean
}

/**
 * A data-alvo de cada meta.
 *
 * Meta sem prazo é intenção, não compromisso — e não tem onde cair no
 * calendário. `amountCents` carrega o que ainda falta juntar, que é o número
 * que interessa ao olhar a data se aproximando.
 */
export function goalEvents(goals: GoalLike[], from: string, to: string): AgendaEvent[] {
  return goals
    .filter((goal) => goal.target_date !== null && goal.target_date >= from && goal.target_date <= to)
    .map((goal) => {
      const missing = Math.max(0, goal.target_cents - goal.current_cents)
      const reached = goal.done || missing === 0
      return {
        id: `goal:${goal.id}`,
        date: goal.target_date!,
        time: null,
        endTime: null,
        title: `Meta: ${goal.name}`,
        detail: reached ? 'Alcançada' : 'Ainda falta',
        source: 'goal' as const,
        area: 'finance' as const,
        href: '/financeiro/orcamento',
        done: reached,
        ...(reached ? {} : { amountCents: missing }),
      }
    })
}

// ---------------------------------------------------------------------------
// Faculdade e cursos: início e término
// ---------------------------------------------------------------------------

export interface ProgramLike {
  id: string
  name: string
  track: 'academic' | 'course'
  status: string
  start_date: string | null
  expected_end: string | null
}

/**
 * Marcos de cada curso e graduação.
 *
 * Abandonado fica de fora: a data de término prevista de algo que a pessoa
 * largou não é um compromisso, é lembrança ruim. Concluído continua aparecendo,
 * já riscado — some do "próximos" e permanece no histórico do mês.
 */
export function programEvents(programs: ProgramLike[], from: string, to: string): AgendaEvent[] {
  const events: AgendaEvent[] = []

  for (const program of programs) {
    if (program.status === 'dropped') continue
    const href = program.track === 'academic' ? `/faculdade/${program.id}` : `/cursos/${program.id}`

    if (program.start_date && program.start_date >= from && program.start_date <= to) {
      events.push({
        id: `program-start:${program.id}`,
        date: program.start_date,
        time: null,
        endTime: null,
        title: program.name,
        detail: 'Início',
        source: 'term',
        area: 'education',
        href,
        done: program.status !== 'planned',
      })
    }

    if (program.expected_end && program.expected_end >= from && program.expected_end <= to) {
      events.push({
        id: `program-end:${program.id}`,
        date: program.expected_end,
        time: null,
        endTime: null,
        title: program.name,
        detail: program.status === 'done' ? 'Concluído' : 'Término previsto',
        source: 'term',
        area: 'education',
        href,
        done: program.status === 'done',
      })
    }
  }

  return events
}

// ---------------------------------------------------------------------------
// Saúde: as datas do plano de emagrecimento
// ---------------------------------------------------------------------------

export interface DietPlanLike {
  id: string
  target_weight_kg: number
  target_date: string | null
  /** Data em que o ritmo atual chega ao peso-alvo. */
  estimated_date: string
  status: 'active' | 'archived'
}

/**
 * A data que a pessoa escolheu e a que o ritmo atual promete.
 *
 * As duas juntas são o ponto: a distância entre elas é o atraso do plano, e
 * vê-la no calendário é mais honesto do que só mostrar a meta. Quando coincidem
 * vira um evento só — repetir a mesma data com dois rótulos seria ruído.
 */
export function dietPlanEvents(plans: DietPlanLike[], from: string, to: string): AgendaEvent[] {
  const events: AgendaEvent[] = []
  const inRange = (date: string) => date >= from && date <= to

  for (const plan of plans) {
    if (plan.status !== 'active') continue
    const weight = `${plan.target_weight_kg.toLocaleString('pt-BR')} kg`

    if (plan.target_date && inRange(plan.target_date)) {
      events.push({
        id: `plan-target:${plan.id}`,
        date: plan.target_date,
        time: null,
        endTime: null,
        title: `Meta de peso: ${weight}`,
        detail: plan.estimated_date === plan.target_date ? 'No ritmo' : 'Data escolhida',
        source: 'plan',
        area: 'health',
        href: '/saude/plano',
        done: false,
      })
    }

    if (inRange(plan.estimated_date) && plan.estimated_date !== plan.target_date) {
      events.push({
        id: `plan-estimate:${plan.id}`,
        date: plan.estimated_date,
        time: null,
        endTime: null,
        title: `Previsão: ${weight}`,
        detail: 'No ritmo atual',
        source: 'plan',
        area: 'health',
        href: '/saude/plano',
        done: false,
      })
    }
  }

  return events
}

// ---------------------------------------------------------------------------
// Junção
// ---------------------------------------------------------------------------

export function sortAgenda(events: AgendaEvent[]): AgendaEvent[] {
  return [...events].sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date)
    // Compromisso do dia inteiro vem antes dos que têm hora marcada.
    if (a.time === null && b.time !== null) return -1
    if (a.time !== null && b.time === null) return 1
    if (a.time && b.time && a.time !== b.time) return a.time.localeCompare(b.time)
    return a.title.localeCompare(b.title, 'pt-BR')
  })
}

export function groupByDay(events: AgendaEvent[]): Map<string, AgendaEvent[]> {
  const map = new Map<string, AgendaEvent[]>()
  for (const event of sortAgenda(events)) {
    const list = map.get(event.date)
    if (list) list.push(event)
    else map.set(event.date, [event])
  }
  return map
}

/** Os próximos compromissos a partir de uma data, ignorando o que já passou. */
export function upcoming(events: AgendaEvent[], from: string, limit = 5): AgendaEvent[] {
  return sortAgenda(events)
    .filter((event) => event.date >= from && !event.done && event.source !== 'workout')
    .slice(0, limit)
}

export function areaOf(source: AgendaSource): AgendaArea {
  return AREA_OF[source]
}

/** Intervalo que a tela do mês precisa carregar (as 6 semanas visíveis). */
export function monthRange(competence: string): { from: string; to: string } {
  const [year, month] = competence.split('-').map(Number) as [number, number]
  const first = `${competence}-01`
  const last = `${competence}-${String(new Date(year, month, 0).getDate()).padStart(2, '0')}`
  return { from: addDays(first, -weekdayOf(first)), to: addDays(last, 6 - weekdayOf(last)) }
}
