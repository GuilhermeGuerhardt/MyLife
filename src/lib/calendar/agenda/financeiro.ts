/**
 * Dinheiro na agenda: conta a pagar, fatura de cartão, recorrente e meta.
 */

import { addMonths, dateInCompetence, statementPeriod, toCompetence } from '@/lib/finance/billing'
import type { AgendaEvent } from './tipos'

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
