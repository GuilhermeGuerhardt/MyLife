import { useMemo } from 'react'
import {
  useAccounts,
  useBudgets,
  useCategories,
  useGoals,
  useTransactions,
} from '@/data/queries'
import type { Account, Category, Transaction } from '@/data/types'
import { toCompetence, type Competence } from '@/lib/finance/billing'
import {
  accountBalance,
  availableLimit,
  budgetProgress,
  byCategory,
  goalProjection,
  invoiceTotal,
  monthlyFlow,
  type TransactionLike,
} from '@/lib/finance/reports'
import { today } from '@/lib/utils'

export interface AccountSummary {
  account: Account
  balance: number
  /** Só para cartão: total da fatura da competência e limite disponível. */
  invoice: number | null
  available: number | null
}

/**
 * Consolida o financeiro numa competência. As telas ficam declarativas e as
 * regras (saldo, fatura, orçamento, meta) continuam nas funções puras.
 */
export function useFinance(competence: Competence = toCompetence(today())) {
  const { data: accounts } = useAccounts()
  const { data: categories } = useCategories()
  const { data: transactions } = useTransactions()
  const { data: budgets } = useBudgets()
  const { data: goals } = useGoals()

  return useMemo(() => {
    const active = accounts.filter((a) => !a.archived)
    const rows = transactions as unknown as TransactionLike[]

    const summaries: AccountSummary[] = active.map((account) => ({
      account,
      balance: accountBalance(account, rows),
      invoice: account.kind === 'credit' ? invoiceTotal(account.id, competence, rows) : null,
      available: availableLimit(account, rows),
    }))

    // Cartão não entra no patrimônio: a fatura é dívida, não saldo.
    const totalBalance = summaries
      .filter((s) => s.account.kind !== 'credit')
      .reduce((sum, s) => sum + s.balance, 0)

    const openInvoices = summaries
      .filter((s) => s.account.kind === 'credit')
      .reduce((sum, s) => sum + (s.invoice ?? 0), 0)

    const categoryById = new Map(categories.map((c) => [c.id, c]))
    const flow = monthlyFlow(rows, competence)
    const expenses = byCategory(rows, competence, 'expense')
    const income = byCategory(rows, competence, 'income')

    const monthBudgets = budgets
      .filter((b) => b.competence === competence)
      .map((budget) => {
        const spent = expenses.find((e) => e.categoryId === budget.category_id)?.total ?? 0
        return {
          budget,
          category: categoryById.get(budget.category_id) ?? null,
          progress: budgetProgress(budget.limit_cents, spent),
        }
      })
      .sort((a, b) => b.progress.percent - a.progress.percent)

    const goalList = goals.map((goal) => ({
      goal,
      projection: goalProjection(
        goal.target_cents,
        goal.current_cents,
        goal.target_date,
        today(),
      ),
    }))

    return {
      competence,
      accounts: active,
      allAccounts: accounts,
      summaries,
      totalBalance,
      openInvoices,
      categories,
      categoryById,
      transactions,
      monthTransactions: transactions
        .filter((t) => t.competence === competence)
        .sort((a, b) => b.date.localeCompare(a.date)),
      flow,
      expensesByCategory: expenses,
      incomeByCategory: income,
      budgets: monthBudgets,
      goals: goalList,
      hasAccounts: active.length > 0,
    }
  }, [accounts, categories, transactions, budgets, goals, competence])
}

/** Categorias de um tipo, em ordem alfabética. */
export function sortCategories(categories: Category[], kind: 'income' | 'expense'): Category[] {
  return categories
    .filter((c) => c.kind === kind)
    .sort((a, b) => a.name.localeCompare(b.name))
}

export function describeInstallment(transaction: Transaction): string | null {
  if (!transaction.installment_total || transaction.installment_total <= 1) return null
  return `${transaction.installment_n}/${transaction.installment_total}`
}
