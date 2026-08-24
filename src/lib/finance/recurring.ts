/**
 * Regras de repetição do financeiro.
 *
 * Uma recorrente não é um lançamento: é a regra que diz quando um lançamento
 * deveria existir. Materializar é o passo que transforma a regra em linha no
 * extrato, e ele é explícito de propósito — criar linhas sozinho, no mês que a
 * pessoa só abriu para consultar, é como um app perde a confiança de quem
 * confere o saldo.
 */

import { dateInCompetence, type Competence } from './billing'

export interface RecurringLike {
  id: string
  description: string
  account_id: string
  category_id: string | null
  kind: 'income' | 'expense'
  amount_cents: number
  /** Dia do mês em que se repete. */
  day_of_month: number
  start_date: string
  end_date: string | null
  active: boolean
}

/** O que já existe no extrato, para não materializar duas vezes. */
export interface MaterializedLike {
  recurring_id: string | null
  /** A data do lançamento, não a competência. */
  date: string
}

/**
 * Data em que a regra cai nesta competência — `null` se ela não vale ali.
 *
 * O dia é limitado ao tamanho do mês (`dateInCompetence`), então uma regra no
 * dia 31 cai no dia 28 em fevereiro em vez de sumir.
 */
export function occurrenceDate(rule: RecurringLike, competence: Competence): string | null {
  if (!rule.active) return null

  const date = dateInCompetence(competence, rule.day_of_month)
  if (date < rule.start_date) return null
  if (rule.end_date && date > rule.end_date) return null

  return date
}

export interface PendingOccurrence {
  rule: RecurringLike
  date: string
}

/**
 * Regras que valem neste mês e ainda não viraram lançamento.
 *
 * A checagem é por `recurring_id` + mês da **data**, não da competência. Numa
 * assinatura no cartão as duas divergem — a compra de 25 de agosto cai na
 * fatura de setembro — e comparar competência faria a regra reaparecer como
 * pendente logo depois de ter sido lançada.
 *
 * Comparar por mês, e não pelo dia exato, é o que deixa a pessoa mover o
 * lançamento do dia 5 para o dia 7 sem ver a recorrente ressuscitar.
 */
export function pendingOccurrences(
  rules: RecurringLike[],
  competence: Competence,
  existing: MaterializedLike[],
): PendingOccurrence[] {
  const done = new Set(
    existing
      .filter((row) => row.recurring_id && row.date.slice(0, 7) === competence)
      .map((row) => row.recurring_id as string),
  )

  return rules
    .filter((rule) => !done.has(rule.id))
    .map((rule) => ({ rule, date: occurrenceDate(rule, competence) }))
    .filter((item): item is PendingOccurrence => item.date !== null)
    .sort((a, b) => a.date.localeCompare(b.date) || a.rule.description.localeCompare(b.rule.description))
}

/** Soma das pendentes, com receita entrando positiva e despesa negativa. */
export function pendingBalance(pending: PendingOccurrence[]): number {
  return pending.reduce(
    (total, { rule }) =>
      total + (rule.kind === 'income' ? rule.amount_cents : -rule.amount_cents),
    0,
  )
}
