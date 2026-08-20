/**
 * Consolidações do financeiro: saldo, fluxo mensal, orçamento e metas.
 * Funções puras sobre listas já filtradas por usuário.
 */

import type { Competence } from './billing'

export type TransactionKind = 'income' | 'expense' | 'transfer'
export type AccountKind = 'checking' | 'savings' | 'cash' | 'credit' | 'investment'

export interface TransactionLike {
  id: string
  account_id: string
  transfer_account_id: string | null
  category_id: string | null
  kind: TransactionKind
  amount_cents: number
  date: string
  competence: Competence
  paid: boolean
}

export interface AccountLike {
  id: string
  kind: AccountKind
  initial_balance_cents: number
  credit_limit_cents: number | null
}

/** Cartão de crédito não tem saldo — tem fatura aberta e limite. */
export function isCreditCard(account: AccountLike): boolean {
  return account.kind === 'credit'
}

/**
 * Saldo da conta: saldo inicial mais entradas, menos saídas, considerando
 * transferências nos dois sentidos. Só conta o que já foi efetivado.
 */
export function accountBalance(account: AccountLike, transactions: TransactionLike[]): number {
  let balance = account.initial_balance_cents

  for (const tx of transactions) {
    if (!tx.paid) continue

    if (tx.kind === 'transfer') {
      if (tx.account_id === account.id) balance -= tx.amount_cents
      if (tx.transfer_account_id === account.id) balance += tx.amount_cents
      continue
    }

    if (tx.account_id !== account.id) continue
    balance += tx.kind === 'income' ? tx.amount_cents : -tx.amount_cents
  }

  return balance
}

/** Total em aberto da fatura de um cartão numa competência. */
export function invoiceTotal(
  accountId: string,
  competence: Competence,
  transactions: TransactionLike[],
): number {
  return transactions
    .filter((tx) => tx.account_id === accountId && tx.competence === competence)
    .reduce((sum, tx) => sum + (tx.kind === 'income' ? -tx.amount_cents : tx.amount_cents), 0)
}

/** Quanto ainda dá para gastar no cartão. */
export function availableLimit(
  account: AccountLike,
  transactions: TransactionLike[],
): number | null {
  if (!isCreditCard(account) || account.credit_limit_cents === null) return null
  const used = transactions
    .filter((tx) => tx.account_id === account.id && !tx.paid)
    .reduce((sum, tx) => sum + (tx.kind === 'income' ? -tx.amount_cents : tx.amount_cents), 0)
  return account.credit_limit_cents - used
}

export interface MonthlyFlow {
  income: number
  expense: number
  net: number
  /** Percentual da receita que sobrou. */
  savingsRate: number
}

/**
 * Fluxo do mês por competência — não pela data.
 *
 * Transferências ficam de fora: dinheiro que sai de uma conta e entra em outra
 * não é receita nem despesa, e contá-lo infla os dois lados.
 */
export function monthlyFlow(
  transactions: TransactionLike[],
  competence: Competence,
): MonthlyFlow {
  let income = 0
  let expense = 0

  for (const tx of transactions) {
    if (tx.competence !== competence || tx.kind === 'transfer') continue
    if (tx.kind === 'income') income += tx.amount_cents
    else expense += tx.amount_cents
  }

  const net = income - expense
  return {
    income,
    expense,
    net,
    savingsRate: income > 0 ? Math.round((net / income) * 1000) / 10 : 0,
  }
}

export interface CategoryTotal {
  categoryId: string | null
  total: number
  count: number
  percent: number
}

export function byCategory(
  transactions: TransactionLike[],
  competence: Competence,
  kind: TransactionKind = 'expense',
): CategoryTotal[] {
  const totals = new Map<string | null, { total: number; count: number }>()
  let grand = 0

  for (const tx of transactions) {
    if (tx.competence !== competence || tx.kind !== kind) continue
    const current = totals.get(tx.category_id) ?? { total: 0, count: 0 }
    current.total += tx.amount_cents
    current.count++
    totals.set(tx.category_id, current)
    grand += tx.amount_cents
  }

  return [...totals.entries()]
    .map(([categoryId, value]) => ({
      categoryId,
      total: value.total,
      count: value.count,
      percent: grand > 0 ? Math.round((value.total / grand) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.total - a.total)
}

export type BudgetStatus = 'ok' | 'warning' | 'exceeded'

export interface BudgetProgress {
  limit: number
  spent: number
  remaining: number
  percent: number
  status: BudgetStatus
}

export function budgetProgress(limitCents: number, spentCents: number): BudgetProgress {
  const percent = limitCents > 0 ? Math.round((spentCents / limitCents) * 1000) / 10 : 0
  return {
    limit: limitCents,
    spent: spentCents,
    remaining: limitCents - spentCents,
    percent,
    status: percent > 100 ? 'exceeded' : percent >= 80 ? 'warning' : 'ok',
  }
}

export interface GoalProjection {
  percent: number
  remaining: number
  /** Aporte mensal necessário para chegar na data alvo. */
  monthlyNeeded: number | null
  monthsLeft: number | null
  reached: boolean
}

export function goalProjection(
  targetCents: number,
  currentCents: number,
  targetDate: string | null,
  today: string,
): GoalProjection {
  const remaining = Math.max(targetCents - currentCents, 0)
  const percent = targetCents > 0 ? Math.round((currentCents / targetCents) * 1000) / 10 : 0

  if (!targetDate || remaining === 0) {
    return {
      percent,
      remaining,
      monthlyNeeded: null,
      monthsLeft: null,
      reached: remaining === 0,
    }
  }

  const months = monthsBetween(today, targetDate)
  return {
    percent,
    remaining,
    monthsLeft: months,
    monthlyNeeded: months > 0 ? Math.ceil(remaining / months) : remaining,
    reached: false,
  }
}

export function monthsBetween(fromIso: string, toIso: string): number {
  const [fy, fm] = fromIso.split('-').map(Number) as [number, number]
  const [ty, tm] = toIso.split('-').map(Number) as [number, number]
  return Math.max((ty - fy) * 12 + (tm - fm), 0)
}

/** Série mensal de receitas e despesas para o gráfico de fluxo de caixa. */
export function monthlySeries(
  transactions: TransactionLike[],
  competences: Competence[],
): Array<{ competence: Competence; income: number; expense: number; net: number }> {
  return competences.map((competence) => {
    const flow = monthlyFlow(transactions, competence)
    return {
      competence,
      income: flow.income,
      expense: flow.expense,
      net: flow.net,
    }
  })
}
