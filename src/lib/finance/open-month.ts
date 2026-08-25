/**
 * O que ainda falta acontecer no mês.
 *
 * Duas coisas diferentes respondem a essa pergunta, e por isso ficam juntas: o
 * lançamento que existe mas não foi pago, e a recorrente que nem virou
 * lançamento ainda. Contar só a primeira faria o aluguel do dia 5 sumir da
 * conta enquanto ninguém confirmasse a regra.
 */

import type { PendingOccurrence } from './recurring'

export interface OpenLike {
  kind: 'income' | 'expense' | 'transfer'
  amount_cents: number
  date: string
  paid: boolean
}

export interface OpenMonthSummary {
  /** Quantos itens estão em aberto, somando lançamentos e recorrentes. */
  count: number
  /** Sempre positivo: é o quanto falta sair. */
  toPayCents: number
  /** Sempre positivo: é o quanto falta entrar. */
  toReceiveCents: number
  /** Receber menos pagar — negativo quer dizer que falta mais saída que entrada. */
  balanceCents: number
  /** Quantos já passaram da data. */
  overdueCount: number
}

/** Transferência não entra: dinheiro que anda entre contas suas não é conta a pagar. */
export function isOpen(item: OpenLike): boolean {
  return !item.paid && item.kind !== 'transfer'
}

export function summarizeOpenMonth(
  transactions: OpenLike[],
  pending: PendingOccurrence[],
  today: string,
): OpenMonthSummary {
  const abertos = transactions.filter(isOpen)

  let toPay = 0
  let toReceive = 0
  let overdue = 0

  for (const item of abertos) {
    if (item.kind === 'income') toReceive += item.amount_cents
    else toPay += item.amount_cents
    if (item.date < today) overdue += 1
  }

  for (const { rule, date } of pending) {
    if (rule.kind === 'income') toReceive += rule.amount_cents
    else toPay += rule.amount_cents
    if (date < today) overdue += 1
  }

  return {
    count: abertos.length + pending.length,
    toPayCents: toPay,
    toReceiveCents: toReceive,
    balanceCents: toReceive - toPay,
    overdueCount: overdue,
  }
}
