/**
 * A gravação da importação.
 *
 * `src/lib/finance/import.ts` transforma texto em `ImportRow` sem saber que o
 * app existe. Aqui é o contrário: nada de parsing, só a ponte entre as linhas
 * revisadas e as tabelas — inclusive criar a conta e a categoria que o arquivo
 * menciona e o app ainda não tem.
 */

import { useAccounts, useCategories, useTransactions } from '@/data/queries'
import { guessCategory } from '@/data/seed-finance'
import type { Account, BaseRow, Category, Transaction } from '@/data/types'
import { cardConfig } from '@/features/finance/actions'
import { competenceFor } from '@/lib/finance/billing'
import { normalizeText, type ImportRow } from '@/lib/finance/import'
import { uid } from '@/lib/utils'

/** Valor especial das listas de mapeamento. */
export const CREATE = '__create__'
export const IGNORE = '__ignore__'

const ACCOUNT_COLORS = ['#3b82f6', '#22c55e', '#f97316', '#a855f7', '#ef4444', '#14b8a6', '#eab308', '#64748b']
const CATEGORY_COLOR = '#71717a'

// ---------------------------------------------------------------------------
// Sugestão de correspondência
// ---------------------------------------------------------------------------

/**
 * Casa o rótulo do arquivo com uma conta que já existe.
 *
 * Compara normalizado e aceita conter: "Banco Inter" no arquivo encontra
 * "Inter" no app. Sem correspondência, sugere criar — melhor do que jogar tudo
 * numa conta qualquer e a pessoa descobrir depois.
 */
export function suggestAccounts(labels: string[], accounts: Account[]): Record<string, string> {
  const result: Record<string, string> = {}

  for (const label of labels) {
    const target = normalizeText(label)
    const exact = accounts.find((account) => normalizeText(account.name) === target)
    const partial =
      exact ??
      accounts.find((account) => {
        const name = normalizeText(account.name)
        return name.includes(target) || target.includes(name)
      })
    result[label] = partial?.id ?? CREATE
  }

  return result
}

/**
 * Casa o rótulo de categoria do arquivo com uma categoria do app.
 *
 * Primeiro pelo nome; depois pelas palavras-chave do catálogo, que já existem
 * para o registro rápido — é assim que "Combustível" cai em Transporte sem
 * ninguém ter configurado nada. O que sobra vira categoria nova.
 */
export function suggestCategories(
  labels: Array<{ label: string; kind: 'income' | 'expense' }>,
  categories: Category[],
): Record<string, string> {
  const result: Record<string, string> = {}

  for (const { label, kind } of labels) {
    const target = normalizeText(label)
    const byName = categories.find(
      (category) => category.kind === kind && normalizeText(category.name) === target,
    )
    result[label] = (byName ?? guessCategory(label, categories, kind))?.id ?? CREATE
  }

  return result
}

/** O tipo predominante de cada rótulo de categoria, para sugerir na chave certa. */
export function labelKinds(rows: ImportRow[]): Array<{ label: string; kind: 'income' | 'expense' }> {
  const tally = new Map<string, { income: number; expense: number }>()

  for (const row of rows) {
    const label = row.categoryLabel.trim()
    if (!label) continue
    const counts = tally.get(label) ?? { income: 0, expense: 0 }
    counts[row.kind]++
    tally.set(label, counts)
  }

  return [...tally].map(([label, counts]) => ({
    label,
    kind: counts.income > counts.expense ? ('income' as const) : ('expense' as const),
  }))
}

// ---------------------------------------------------------------------------
// Gravação
// ---------------------------------------------------------------------------

export interface ImportPlan {
  rows: ImportRow[]
  /** Rótulo do arquivo → id da conta, ou `CREATE`. */
  accounts: Record<string, string>
  /** Rótulo do arquivo → id da categoria, `CREATE` ou `IGNORE`. */
  categories: Record<string, string>
  /** Conta usada quando a linha não traz rótulo nenhum. */
  fallbackAccountId: string
}

export interface ImportResult {
  transactions: number
  accountsCreated: number
  categoriesCreated: number
}

/**
 * Agrupa as parcelas espalhadas pelo arquivo.
 *
 * O extrato traz uma linha por parcela — `CG 160 Fan (5/48)` e `(4/48)` são
 * linhas distintas do mesmo financiamento. Dar a elas o mesmo
 * `installment_group_id` é o que permite ao app tratá-las como uma compra só,
 * inclusive apagar tudo de uma vez.
 */
function installmentGroups(rows: ImportRow[]): Map<string, string> {
  const groups = new Map<string, string>()
  for (const row of rows) {
    if (!row.installment) continue
    const key = `${normalizeText(row.description)}|${row.installment.total}`
    if (!groups.has(key)) groups.set(key, uid())
  }
  return groups
}

export function useRunImport() {
  const { data: accounts, create: createAccount } = useAccounts()
  const { create: createCategory } = useCategories()
  const { create: createTransaction } = useTransactions()

  return async function runImport(plan: ImportPlan): Promise<ImportResult> {
    const result: ImportResult = { transactions: 0, accountsCreated: 0, categoriesCreated: 0 }

    // As contas e categorias novas nascem antes do primeiro lançamento: cada
    // uma precisa do id para as linhas apontarem, e criar sob demanda dentro do
    // laço faria a mesma conta nascer duas vezes.
    const accountIds = new Map<string, string>()
    for (const [label, choice] of Object.entries(plan.accounts)) {
      if (choice !== CREATE) {
        accountIds.set(label, choice)
        continue
      }
      const draft: Omit<Account, keyof BaseRow> = {
        name: label,
        kind: 'checking',
        bank: null,
        initial_balance_cents: 0,
        credit_limit_cents: null,
        closing_day: null,
        due_day: null,
        color: ACCOUNT_COLORS[result.accountsCreated % ACCOUNT_COLORS.length]!,
        archived: false,
      }
      const created = await createAccount.mutateAsync(draft)
      accountIds.set(label, created.id)
      result.accountsCreated++
    }

    const kindByLabel = new Map(labelKinds(plan.rows).map((item) => [item.label, item.kind]))
    const categoryIds = new Map<string, string | null>()
    for (const [label, choice] of Object.entries(plan.categories)) {
      if (choice === IGNORE) {
        categoryIds.set(label, null)
        continue
      }
      if (choice !== CREATE) {
        categoryIds.set(label, choice)
        continue
      }
      const draft: Omit<Category, keyof BaseRow> = {
        name: label,
        kind: kindByLabel.get(label) ?? 'expense',
        color: CATEGORY_COLOR,
        icon: '📦',
        // O próprio nome vira palavra-chave: a próxima importação (e o registro
        // rápido) já reconhecem essa categoria sozinhos.
        keywords: [normalizeText(label)],
      }
      const created = await createCategory.mutateAsync(draft)
      categoryIds.set(label, created.id)
      result.categoriesCreated++
    }

    const accountById = new Map(accounts.map((account) => [account.id, account]))
    const groups = installmentGroups(plan.rows)

    for (const row of plan.rows) {
      const accountId = accountIds.get(row.accountLabel) ?? plan.fallbackAccountId
      if (!accountId) continue

      // Conta recém-criada não está em `accounts` (a lista é a do render), mas
      // também não é cartão — só cartão muda a competência, então o `undefined`
      // aqui leva à competência pela data, que é o certo.
      const card = cardConfig(accountById.get(accountId))
      const group = row.installment
        ? (groups.get(`${normalizeText(row.description)}|${row.installment.total}`) ?? null)
        : null

      const draft: Omit<Transaction, keyof BaseRow> = {
        account_id: accountId,
        transfer_account_id: null,
        category_id: categoryIds.get(row.categoryLabel) ?? null,
        kind: row.kind,
        amount_cents: row.amountCents,
        date: row.date,
        competence: competenceFor(row.date, card),
        description: row.description,
        tags: ['importado'],
        paid: row.paid,
        installment_group_id: group,
        installment_n: row.installment?.n ?? null,
        installment_total: row.installment?.total ?? null,
        recurring_id: null,
        notes: row.detail,
      }

      await createTransaction.mutateAsync(draft)
      result.transactions++
    }

    return result
  }
}
