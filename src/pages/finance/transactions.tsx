import { Plus, Search, Upload } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button, buttonStyles } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Field, Input, Select } from '@/components/ui/field'
import { Segmented, Stat } from '@/components/ui/misc'
import { PageHeader } from '@/components/ui/page-header'
import { useCategories } from '@/data/queries'
import type { TransactionKind } from '@/data/types'
import { useCreateTransaction, useSetTransactionPaid } from '@/features/finance/actions'
import { BarraDeSelecao } from '@/features/finance/barra-de-selecao'
import { TransactionList } from '@/features/finance/lista-de-lancamentos'
import { FaturaNaLista } from '@/features/finance/fatura-na-lista'
import { MonthNav } from '@/features/finance/month-nav'
import { useAvisoDeCompetencia } from '@/features/finance/aviso-de-competencia'
import { TransactionForm } from '@/features/finance/transaction-form'
import { useFinance } from '@/features/finance/use-finance'
import { useSelecao } from '@/features/finance/use-selecao'
import { useTransactionEditor } from '@/features/finance/use-transaction-editor'
import { toCompetence } from '@/lib/finance/billing'
import { invoicesOfMonth } from '@/lib/finance/reports'
import { formatCents } from '@/lib/finance/money'
import { normalize } from '@/lib/quick-add/parser'
import { today } from '@/lib/utils'

type Filter = 'all' | TransactionKind

export function TransactionsPage() {
  const [competence, setCompetence] = useState(toCompetence(today()))
  const finance = useFinance(competence)
  const { data: categories } = useCategories()
  const createTransaction = useCreateTransaction()
  const setPaid = useSetTransactionPaid()
  const { open: openEditor, editor } = useTransactionEditor()
  const { avisar, aviso } = useAvisoDeCompetencia(competence, setCompetence)

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

  const selecao = useSelecao(filtered, competence)

  const total = filtered.reduce(
    (sum, t) => sum + (t.kind === 'income' ? t.amount_cents : t.kind === 'expense' ? -t.amount_cents : 0),
    0,
  )

  // A fatura do mes nao e um lancamento gravado: ela e derivada das compras, e
  // por isso o valor acompanha sozinho cada compra nova.
  const faturas = invoicesOfMonth(finance.accounts, finance.transactions, competence)

  return (
    <div className="space-y-5">
      <PageHeader
        title="Lançamentos"
        description="Cada lançamento no mês em que aconteceu — a compra no cartão inclusive. A fatura aparece à parte, no mês em que vence, somando as compras que caíram nela."
        action={
          <div className="flex items-center gap-2">
            <MonthNav competence={competence} onChange={setCompetence} />
            <Link to="/financeiro/importar" className={buttonStyles({ variant: 'secondary' })}>
              <Upload />
              Importar
            </Link>
            <Button onClick={() => setAdding(true)} disabled={!finance.hasAccounts}>
              <Plus />
              Lançamento
            </Button>
          </div>
        }
      />

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
                tone={total < 0 ? 'negative' : undefined}
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
                    {category.name}
                  </option>
                ))}
            </Select>
          </div>
        </CardContent>
      </Card>

      <FaturaNaLista faturas={faturas} contas={finance.accounts} />

      <Card>
        <BarraDeSelecao selecao={selecao} />
        {/* Com as arquivadas: a barra julga a compra no cartão com todas as
            contas, e a linha precisa julgar igual — senão a compra de um cartão
            arquivado ficava bloqueada no lote e liberada na própria linha. */}
        <TransactionList
          transactions={filtered}
          accounts={finance.allAccounts}
          categoryById={finance.categoryById}
          onEdit={openEditor}
          onSetPaid={(transaction, paid) => void setPaid(transaction, paid)}
          selecao={selecao}
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
            avisar(await createTransaction(draft))
            setAdding(false)
          }}
        />
      )}

      {editor}
      {aviso}
    </div>
  )
}
