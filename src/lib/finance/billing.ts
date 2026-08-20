/**
 * Fatura de cartão de crédito.
 *
 * O detalhe que quase todo controle financeiro caseiro erra: uma compra não
 * pertence ao mês em que foi feita, e sim à fatura que a inclui. Comprar no dia
 * 29 com fechamento no dia 28 significa pagar só na fatura do mês seguinte — e
 * é por isso que o "gasto do mês" nunca bate com o extrato quando se usa a data
 * da compra.
 *
 * Convenção: a fatura de competência AAAA-MM fecha no dia de fechamento desse
 * mês e cobre as compras feitas desde o dia seguinte ao fechamento anterior.
 */

import { splitInstallments } from './money'

/** Competência no formato AAAA-MM. */
export type Competence = string

export function toCompetence(isoDate: string): Competence {
  return isoDate.slice(0, 7)
}

export function addMonths(competence: Competence, months: number): Competence {
  const [year, month] = competence.split('-').map(Number) as [number, number]
  const total = year * 12 + (month - 1) + months
  const nextYear = Math.floor(total / 12)
  const nextMonth = (total % 12) + 1
  return `${nextYear}-${String(nextMonth).padStart(2, '0')}`
}

export function competenceLabel(competence: Competence): string {
  const [year, month] = competence.split('-').map(Number) as [number, number]
  const formatted = new Intl.DateTimeFormat('pt-BR', {
    month: 'long',
    year: 'numeric',
  }).format(new Date(year, month - 1, 1))
  return formatted.charAt(0).toUpperCase() + formatted.slice(1)
}

/** Último dia do mês — evita cair no dia 31 de um mês que tem 30. */
export function lastDayOfMonth(competence: Competence): number {
  const [year, month] = competence.split('-').map(Number) as [number, number]
  return new Date(year, month, 0).getDate()
}

export function dateInCompetence(competence: Competence, day: number): string {
  const safeDay = Math.min(day, lastDayOfMonth(competence))
  return `${competence}-${String(safeDay).padStart(2, '0')}`
}

export interface CardConfig {
  /** Dia do fechamento da fatura. */
  closingDay: number
  /** Dia do vencimento. */
  dueDay: number
}

/**
 * Em qual fatura a compra cai.
 *
 * Comprou até o dia do fechamento, entra na fatura deste mês; depois disso,
 * na do mês seguinte.
 */
export function competenceForPurchase(isoDate: string, card: CardConfig): Competence {
  const competence = toCompetence(isoDate)
  const day = Number(isoDate.slice(8, 10))
  return day <= card.closingDay ? competence : addMonths(competence, 1)
}

export interface StatementPeriod {
  competence: Competence
  /** Primeira compra que entra nesta fatura. */
  start: string
  /** Fechamento — última compra que entra. */
  end: string
  dueDate: string
}

export function statementPeriod(competence: Competence, card: CardConfig): StatementPeriod {
  const previous = addMonths(competence, -1)
  const closing = dateInCompetence(competence, card.closingDay)
  const previousClosing = dateInCompetence(previous, card.closingDay)

  // O vencimento cai no mês seguinte quando o dia do vencimento vem antes do
  // fechamento (fecha dia 28, vence dia 5) — o caso mais comum.
  const dueCompetence = card.dueDay > card.closingDay ? competence : addMonths(competence, 1)

  return {
    competence,
    start: nextDay(previousClosing),
    end: closing,
    dueDate: dateInCompetence(dueCompetence, card.dueDay),
  }
}

export interface InstallmentPlan {
  number: number
  total: number
  amountCents: number
  competence: Competence
  dueDate: string
}

/**
 * Gera o plano de parcelas de uma compra no cartão.
 * A primeira cai na fatura da data da compra; as demais avançam um mês cada.
 */
export function buildInstallments(
  totalCents: number,
  count: number,
  purchaseDate: string,
  card: CardConfig,
): InstallmentPlan[] {
  const amounts = splitInstallments(totalCents, count)
  const first = competenceForPurchase(purchaseDate, card)

  return amounts.map((amountCents, index) => {
    const competence = addMonths(first, index)
    return {
      number: index + 1,
      total: count,
      amountCents,
      competence,
      dueDate: statementPeriod(competence, card).dueDate,
    }
  })
}

/**
 * Competência de um lançamento comum (conta, dinheiro, débito): é o próprio
 * mês da data. Existe para o resto do app não precisar saber se a conta é
 * cartão ou não.
 */
export function competenceFor(isoDate: string, card: CardConfig | null): Competence {
  return card ? competenceForPurchase(isoDate, card) : toCompetence(isoDate)
}

function nextDay(isoDate: string): string {
  const date = new Date(`${isoDate}T12:00:00`)
  date.setDate(date.getDate() + 1)
  const offset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offset).toISOString().slice(0, 10)
}
