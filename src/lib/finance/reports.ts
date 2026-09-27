/**
 * Consolidações do financeiro: saldo, fluxo mensal, orçamento e metas.
 * Funções puras sobre listas já filtradas por usuário.
 */

import { addMonths, type Competence } from './billing'

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
  /** Agrupa as parcelas de uma mesma compra, quando houver. */
  installment_group_id?: string | null
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

/**
 * Quanto a fatura da competência somou — pago ou não.
 *
 * É o valor histórico do mês, o que a fatura cobrou. Para saber o que ainda
 * falta pagar use `openInvoiceTotal`: depois de quitada, esta continua valendo
 * o mesmo, e é isso que se quer num extrato.
 */
export function invoiceTotal(
  accountId: string,
  competence: Competence,
  transactions: TransactionLike[],
): number {
  return transactions
    .filter((tx) => tx.account_id === accountId && tx.competence === competence)
    .reduce((sum, tx) => sum + (tx.kind === 'income' ? -tx.amount_cents : tx.amount_cents), 0)
}

/**
 * O que ainda falta pagar da fatura.
 *
 * Separado de `invoiceTotal` porque as duas perguntas são diferentes, e
 * confundi-las faz o saldo previsto descontar duas vezes uma fatura já paga:
 * uma no saldo da conta, que já caiu, e outra na projeção.
 */
export function openInvoiceTotal(
  accountId: string,
  competence: Competence,
  transactions: TransactionLike[],
): number {
  return transactions
    .filter((tx) => tx.account_id === accountId && tx.competence === competence && !tx.paid)
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

/**
 * Um lançamento previsto cuja data já passou.
 *
 * O atraso é derivado, nunca gravado: uma coluna `atrasado` no banco começaria
 * a mentir na virada da meia-noite, e passaria a exigir alguém para corrigi-la.
 *
 * Transferência fica de fora — dinheiro que anda entre contas suas não vence.
 */
export function isOverdue(transaction: TransactionLike, today: string): boolean {
  if (transaction.paid || transaction.kind === 'transfer') return false
  return transaction.date < today
}

export interface OverdueSummary {
  count: number
  /** Sempre positivo: é o quanto está em aberto, não um saldo. */
  totalCents: number
  /** A mais antiga primeiro — é a que costuma custar juros. */
  oldestDate: string | null
}

/** Resumo do que venceu e não foi pago, para avisar sem precisar abrir o mês. */
export function overdueSummary(
  transactions: TransactionLike[],
  today: string,
): OverdueSummary {
  const late = transactions.filter((t) => isOverdue(t, today))

  return {
    count: late.length,
    totalCents: late.reduce((sum, t) => sum + t.amount_cents, 0),
    oldestDate: late.reduce<string | null>(
      (oldest, t) => (oldest === null || t.date < oldest ? t.date : oldest),
      null,
    ),
  }
}

export interface CommitmentMonth {
  competence: Competence
  total: number
}

export interface Commitment {
  /** Um item por mês do período, do mais próximo ao mais distante. */
  months: CommitmentMonth[]
  /** Soma do período. */
  total: number
  /** O mês mais pesado — é o que costuma apertar. */
  heaviest: CommitmentMonth | null
  /** Quantas compras parceladas entram na conta. */
  purchases: number
  /** Último mês com algo comprometido, mesmo depois do período. */
  lastCompetence: Competence | null
}

/**
 * O que os meses à frente já têm de despesa marcada.
 *
 * Conta só o que existe como lançamento — parcela de cartão, conta agendada —
 * e deixa de fora a recorrente que ainda não foi lançada: a regra é uma
 * intenção, e somá-la aqui faria a projeção cobrar duas vezes o mesmo aluguel
 * assim que a pessoa o lançasse.
 *
 * O mês atual fica de fora porque ele já está na tela inteira acima; esta é a
 * pergunta do que vem depois.
 */
export function commitmentProjection(
  transactions: TransactionLike[],
  from: Competence,
  months: number,
): Commitment {
  const janela = Array.from({ length: months }, (_, i) => addMonths(from, i + 1))
  const fim = janela.at(-1) ?? from

  const porMes = new Map<Competence, number>(janela.map((competence) => [competence, 0]))
  const compras = new Set<string>()
  let lastCompetence: Competence | null = null

  for (const tx of transactions) {
    if (tx.paid || tx.kind !== 'expense' || tx.competence <= from) continue

    if (lastCompetence === null || tx.competence > lastCompetence) lastCompetence = tx.competence
    if (tx.competence > fim) continue

    porMes.set(tx.competence, (porMes.get(tx.competence) ?? 0) + tx.amount_cents)
    if (tx.installment_group_id) compras.add(tx.installment_group_id)
  }

  const lista = janela.map((competence) => ({ competence, total: porMes.get(competence) ?? 0 }))
  const total = lista.reduce((soma, mes) => soma + mes.total, 0)

  return {
    months: lista,
    total,
    heaviest: total > 0 ? lista.reduce((maior, mes) => (mes.total > maior.total ? mes : maior)) : null,
    purchases: compras.size,
    lastCompetence,
  }
}
