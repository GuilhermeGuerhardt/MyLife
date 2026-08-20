import { Plus, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Field, Input, Select } from '@/components/ui/field'
import { Segmented, Stat } from '@/components/ui/misc'
import { useCategories, useTransactions } from '@/data/queries'
import type { Transaction, TransactionKind } from '@/data/types'
import { useCreateTransaction, useRemoveTransaction } from '@/features/finance/actions'
import { MonthNav, TransactionList } from '@/features/finance/shared'
import { TransactionForm } from '@/features/finance/transaction-form'
import { useFinance } from '@/features/finance/use-finance'
import { toCompetence } from '@/lib/finance/billing'
import { formatCents } from '@/lib/finance/money'
import { normalize } from '@/lib/quick-add/parser'
import { today } from '@/lib/utils'

type Filter = 'all' | TransactionKind

export function TransactionsPage() {
  const [competence, setCompetence] = useState(toCompetence(today()))
  const finance = useFinance(competence)
  const { data: categories } = useCategories()
  const { update } = useTransactions()
  const createTransaction = useCreateTransaction()
  const removeTransaction = useRemoveTransaction()

  const [filter, setFilter] = useState<Filter>('all')
  const [search, setSearch] = useState('')
  const [accountFilter, setAccountFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [adding, setAdding] = useState(false)

  const filtered = useMemo(() => {
    const term = normalize(search)
    return finance.monthTransactions
      .filter((t) => filter === 'all' || t.kind === filter)
      .filter((t) => !accountFilter || t.account_id === accountFilter)
      .filter((t) => !categoryFilter || t.category_id === categoryFilter)
      .filter((t) => !term || normalize(t.description).includes(term))
  }, [finance.monthTransactions, filter, accountFilter, categoryFilter, search])

  const total = filtered.reduce(
    (sum, t) => sum + (t.kind === 'income' ? t.amount_cents : t.kind === 'expense' ? -t.amount_cents : 0),
    0,
  )

  async function handleRemove(transaction: Transaction) {
    if (transaction.installment_group_id && transaction.installment_total) {
      const all = confirm(
        `Este lançamento é parcelado (${transaction.installment_n}/${transaction.installment_total}).\n\nOK remove todas as parcelas. Cancelar remove só esta.`,
      )
      await removeTransaction(transaction, all ? 'group' : 'single')
      return
    }
    await removeTransaction(transaction)
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-fg text-xl font-semibold">Lançamentos</h1>
          <p className="text-fg-muted mt-1 text-sm">
            Agrupados por competência — no cartão, pela fatura que os inclui.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <MonthNav competence={competence} onChange={setCompetence} />
          <Button onClick={() => setAdding(true)} disabled={!finance.hasAccounts}>
            <Plus />
            Lançamento
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <Segmented
              value={filter}
              onChange={setFilter}
              options={[
                { value: 'all' as const, label: 'Todos' },
                { value: 'expense' as const, label: 'Despesas' },
                { value: 'income' as const, label: 'Receitas' },
                { value: 'transfer' as const, label: 'Transferências' },
              ]}
            />
            <div className="ml-auto">
              <Stat
                label={`${filtered.length} lançamento${filtered.length === 1 ? '' : 's'}`}
                value={formatCents(Math.abs(total))}
                tone={total < 0 ? 'negative' : total > 0 ? 'positive' : undefined}
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <Field>
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar descrição..."
                className="pl-9"
              />
              <Search className="text-fg-subtle pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
            </Field>

            <Select
              value={accountFilter}
              onChange={(e) => setAccountFilter(e.target.value)}
              aria-label="Filtrar por conta"
            >
              <option value="">Todas as contas</option>
              {finance.accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </Select>

            <Select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              aria-label="Filtrar por categoria"
            >
              <option value="">Todas as categorias</option>
              {[...categories]
                .sort((a, b) => a.name.localeCompare(b.name))
                .map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.icon} {category.name}
                  </option>
                ))}
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <TransactionList
          transactions={filtered}
          accounts={finance.accounts}
          categoryById={finance.categoryById}
          onRemove={(transaction) => void handleRemove(transaction)}
          onTogglePaid={(transaction) =>
            update.mutate({ id: transaction.id, patch: { paid: true } })
          }
          emptyTitle="Nenhum lançamento com esses filtros"
          emptyDescription="Ajuste o mês, os filtros ou lance algo novo."
        />
      </Card>

      {adding && (
        <TransactionForm
          accounts={finance.accounts}
          categories={categories}
          onClose={() => setAdding(false)}
          onSave={async (draft) => {
            await createTransaction(draft)
            setAdding(false)
          }}
        />
      )}
    </div>
  )
}
