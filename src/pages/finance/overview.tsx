import { ArrowRight, CreditCard, Plus, TrendingDown, TrendingUp, Wallet } from 'lucide-react'
import { useCallback, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge, EmptyState, Progress, SectionTitle, Segmented, Stat } from '@/components/ui/misc'
import { useAccounts, useCategories } from '@/data/queries'
import { AccountForm } from '@/features/finance/account-form'
import { useCreateTransaction, useSetTransactionPaid } from '@/features/finance/actions'
import { CategoryIcon } from '@/features/finance/category-icons'
import { CashFlowChart, CategoryDonut } from '@/features/finance/charts'
import { MonthNav, TransactionList } from '@/features/finance/shared'
import { TransactionForm } from '@/features/finance/transaction-form'
import { useFinance } from '@/features/finance/use-finance'
import { useTransactionEditor } from '@/features/finance/use-transaction-editor'
import { useMaterializeRecurring } from '@/features/finance/actions'
import { pendingOccurrences } from '@/lib/finance/recurring'
import { isOpen, summarizeOpenMonth } from '@/lib/finance/open-month'
import { overdueSummary } from '@/lib/finance/reports'
import { useRecurring } from '@/data/queries'
import { addMonths, competenceLabel, toCompetence } from '@/lib/finance/billing'
import { formatCents } from '@/lib/finance/money'
import { resolveSliceColors } from '@/lib/finance/palette'
import { monthlySeries } from '@/lib/finance/reports'
import { percent, shortDate } from '@/lib/format'
import { today } from '@/lib/utils'

/** Onde a aba escolhida do painel fica lembrada. */
const PANEL_KEY = 'life:financeiro-painel'

type Panel = 'latest' | 'open'

function readPanel(): Panel {
  try {
    return localStorage.getItem(PANEL_KEY) === 'open' ? 'open' : 'latest'
  } catch {
    return 'latest'
  }
}

/**
 * Qual metade do mês o painel mostra: o que já passou ou o que ainda falta.
 *
 * Começa em "Últimos lançamentos" para a tela seguir igual à de antes de quem
 * já usava, e passa a lembrar a escolha na primeira troca.
 */
function usePanel(): [Panel, (panel: Panel) => void] {
  const [panel, setPanel] = useState<Panel>(readPanel)

  const change = useCallback((next: Panel) => {
    setPanel(next)
    try {
      localStorage.setItem(PANEL_KEY, next)
    } catch {
      // Sem localStorage a escolha vale só nesta sessão.
    }
  }, [])

  return [panel, change]
}

export function FinanceOverview() {
  const [competence, setCompetence] = useState(toCompetence(today()))
  const finance = useFinance(competence)
  const { create: createAccount } = useAccounts()
  const { data: categories } = useCategories()
  const createTransaction = useCreateTransaction()
  const setPaid = useSetTransactionPaid()
  const { open: openEditor, editor } = useTransactionEditor()
  const { data: rules } = useRecurring()
  const materialize = useMaterializeRecurring()

  const [addingAccount, setAddingAccount] = useState(false)
  const [addingTransaction, setAddingTransaction] = useState(false)
  const [lancando, setLancando] = useState(false)
  const [panel, setPanel] = usePanel()

  // Os dois avisos que valem interromper: o que venceu e o que ainda nem foi
  // lançado. O resto da tela é consulta.
  const atrasos = overdueSummary(finance.transactions, today())
  const pendentes = pendingOccurrences(rules, competence, finance.transactions)

  // O que falta no mês: o previsto que já existe, mais a regra que ainda não
  // virou lançamento. A ordem é da data mais antiga para a mais nova, o que
  // sobe o vencido ao topo sem precisar de regra separada.
  const emAberto = finance.monthTransactions
    .filter(isOpen)
    .sort((a, b) => a.date.localeCompare(b.date))
  const resumoAberto = summarizeOpenMonth(finance.monthTransactions, pendentes, today())

  if (!finance.hasAccounts) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-fg text-xl font-semibold">Financeiro</h1>
          <p className="text-fg-muted mt-1 text-sm">
            Controle de gastos, orçamento e metas.
          </p>
        </div>
        <Card>
          <EmptyState
            icon={<Wallet className="size-6" />}
            title="Cadastre sua primeira conta"
            description="Pode ser a conta corrente, a carteira ou um cartão de crédito. No cartão, informe fechamento e vencimento — é o que faz cada compra cair na fatura certa."
            action={
              <Button size="sm" onClick={() => setAddingAccount(true)}>
                <Plus />
                Nova conta
              </Button>
            }
          />
        </Card>
        {addingAccount && (
          <AccountForm
            onClose={() => setAddingAccount(false)}
            onSave={async (values) => {
              await createAccount.mutateAsync(values)
              setAddingAccount(false)
            }}
          />
        )}
      </div>
    )
  }

  // Seis meses até a competência aberta.
  const months = Array.from({ length: 6 }, (_, i) => addMonths(competence, i - 5))
  const series = monthlySeries(finance.transactions, months).map((point) => ({
    ...point,
    label: competenceLabel(point.competence).slice(0, 3),
  }))

  /**
   * Fatias do gráfico e da legenda, resolvidas de uma vez só.
   *
   * Antes o donut lia as 8 maiores e a legenda as 5 maiores por conta própria,
   * cada um resolvendo a cor do seu lado — o que abria espaço para a bolinha da
   * legenda não bater com a fatia que ela nomeia.
   */
  const donut = resolveSliceColors(
    finance.expensesByCategory.slice(0, 8).map((item) => {
      const category = item.categoryId ? finance.categoryById.get(item.categoryId) : null
      return {
        key: item.categoryId ?? 'none',
        name: category?.name ?? 'Sem categoria',
        value: item.total,
        percent: item.percent,
        color: category?.color ?? null,
      }
    }),
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-fg text-xl font-semibold">Financeiro</h1>
          <p className="text-fg-muted mt-1 text-sm">
            Fatura de cartão contada por competência, não pela data da compra.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <MonthNav competence={competence} onChange={setCompetence} />
          <Button onClick={() => setAddingTransaction(true)}>
            <Plus />
            Lançamento
          </Button>
        </div>
      </div>

      {atrasos.count > 0 && (
        <div className="grid gap-3 sm:grid-cols-2">
          {atrasos.count > 0 && (
            <Card className="border-negative/40">
              <CardContent className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-negative text-sm font-medium">
                    {atrasos.count} lançamento{atrasos.count === 1 ? '' : 's'} vencido
                    {atrasos.count === 1 ? '' : 's'}
                  </p>
                  <p className="text-fg-muted mt-0.5 text-xs">
                    {formatCents(atrasos.totalCents)} em aberto
                    {atrasos.oldestDate && ` · o mais antigo de ${shortDate(atrasos.oldestDate)}`}
                  </p>
                </div>
                <Link to="/financeiro/transacoes">
                  <Button variant="secondary" size="sm">
                    Ver
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent>
            <Stat
              icon={<Wallet className="size-3.5" />}
              label="Saldo em contas"
              value={formatCents(finance.totalBalance)}
              hint={
                finance.openInvoices > 0
                  ? `${formatCents(finance.openInvoices)} em faturas abertas`
                  : 'Cartões não entram no saldo'
              }
              tone={finance.totalBalance < 0 ? 'negative' : undefined}
            />
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <Stat
              icon={<TrendingUp className="size-3.5" />}
              label="Receitas do mês"
              value={formatCents(finance.flow.income)}
              tone="positive"
            />
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <Stat
              icon={<TrendingDown className="size-3.5" />}
              label="Despesas do mês"
              value={formatCents(finance.flow.expense)}
              tone="negative"
            />
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <Stat
              label="Sobrou"
              value={formatCents(finance.flow.net)}
              tone={finance.flow.net < 0 ? 'negative' : 'positive'}
              hint={
                finance.flow.income > 0
                  ? `Taxa de poupança: ${percent(finance.flow.savingsRate, 0)}`
                  : 'Sem receita lançada no mês'
              }
            />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Fluxo de caixa"
            description="Receitas e despesas dos últimos 6 meses"
          />
          <CardContent>
            <CashFlowChart data={series} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader title="Onde foi o dinheiro" description={competenceLabel(competence)} />
          <CardContent>
            {donut.length === 0 ? (
              <p className="text-fg-muted py-8 text-center text-sm">
                Nenhuma despesa neste mês.
              </p>
            ) : (
              <>
                <CategoryDonut data={donut} />
                <div className="mt-3 space-y-1.5">
                  {donut.map((slice) => (
                    <div key={slice.key} className="flex items-center gap-2 text-xs">
                      <span
                        className="size-2 shrink-0 rounded-full"
                        style={{ background: slice.color }}
                      />
                      <span className="text-fg-muted flex-1 truncate">{slice.name}</span>
                      <span className="text-fg-subtle">{percent(slice.percent, 0)}</span>
                      <span className="text-fg font-medium tabular-nums">
                        {formatCents(slice.value)}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <Segmented
              value={panel}
              onChange={setPanel}
              options={[
                { value: 'latest' as const, label: 'Últimos lançamentos' },
                {
                  value: 'open' as const,
                  label:
                    resumoAberto.count > 0
                      ? `Ainda esse mês (${resumoAberto.count})`
                      : 'Ainda esse mês',
                },
              ]}
            />
            <Link to="/financeiro/transacoes">
              <Button variant="ghost" size="sm">
                Ver todos <ArrowRight />
              </Button>
            </Link>
          </div>

          {panel === 'latest' ? (
            <Card>
              <TransactionList
                transactions={finance.monthTransactions.slice(0, 8)}
                accounts={finance.accounts}
                categoryById={finance.categoryById}
                onEdit={openEditor}
                onSetPaid={(transaction, paid) => void setPaid(transaction, paid)}
                emptyTitle="Nada lançado neste mês"
                emptyDescription='Use o botão acima ou o registro rápido (Ctrl+K): "gastei 35 no mercado".'
              />
            </Card>
          ) : (
            <Card>
              {resumoAberto.count > 0 && (
                <div className="border-border-base flex flex-wrap items-end gap-x-8 gap-y-3 border-b px-5 py-4">
                  <Stat
                    label="A pagar"
                    value={formatCents(resumoAberto.toPayCents)}
                    tone={resumoAberto.toPayCents > 0 ? 'negative' : undefined}
                  />
                  <Stat
                    label="A receber"
                    value={formatCents(resumoAberto.toReceiveCents)}
                    tone={resumoAberto.toReceiveCents > 0 ? 'positive' : undefined}
                  />
                  <Stat
                    label="Saldo do que falta"
                    value={`${resumoAberto.balanceCents < 0 ? '−' : '+'}${formatCents(
                      Math.abs(resumoAberto.balanceCents),
                    )}`}
                    tone={resumoAberto.balanceCents < 0 ? 'negative' : 'positive'}
                  />
                  {resumoAberto.overdueCount > 0 && (
                    <div className="ml-auto">
                      <Badge tone="negative">
                        {resumoAberto.overdueCount} vencido
                        {resumoAberto.overdueCount === 1 ? '' : 's'}
                      </Badge>
                    </div>
                  )}
                </div>
              )}

              <TransactionList
                transactions={emAberto}
                accounts={finance.accounts}
                categoryById={finance.categoryById}
                onEdit={openEditor}
                onSetPaid={(transaction, paid) => void setPaid(transaction, paid)}
                emptyTitle={
                  pendentes.length > 0 ? 'Nenhum lançamento em aberto' : 'Nada em aberto'
                }
                emptyDescription={
                  pendentes.length > 0
                    ? 'Só faltam as recorrentes abaixo.'
                    : 'Tudo deste mês já está pago.'
                }
              />

              {pendentes.length > 0 && (
                <div className="border-border-base border-t">
                  <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                    <div>
                      <p className="text-fg text-xs font-medium">
                        {pendentes.length} recorrente{pendentes.length === 1 ? '' : 's'} a lançar
                      </p>
                      <p className="text-fg-muted mt-0.5 text-[11px]">
                        Já contam no total acima; viram lançamento previsto ao confirmar.
                      </p>
                    </div>
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={lancando}
                      onClick={() => {
                        setLancando(true)
                        void materialize(pendentes).finally(() => setLancando(false))
                      }}
                    >
                      {lancando ? 'Lançando…' : 'Lançar todas'}
                    </Button>
                  </div>

                  <div className="divide-border-base divide-y">
                    {pendentes.map(({ rule, date }) => {
                      const category = rule.category_id
                        ? finance.categoryById.get(rule.category_id)
                        : null
                      return (
                        <div key={rule.id} className="flex items-center gap-3 px-5 py-2.5">
                          <span
                            className="flex size-8 shrink-0 items-center justify-center rounded-lg"
                            style={{ background: `${category?.color ?? '#71717a'}1f` }}
                          >
                            <CategoryIcon
                              icon={category?.icon}
                              color={category?.color}
                              className="size-4"
                            />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="text-fg-muted truncate text-sm">{rule.description}</p>
                            <p className="text-fg-subtle truncate text-[11px]">
                              {shortDate(date)} · recorrente
                            </p>
                          </div>
                          <Badge>a lançar</Badge>
                          <span
                            className={`text-sm font-medium whitespace-nowrap ${
                              rule.kind === 'income' ? 'text-positive' : 'text-fg'
                            }`}
                          >
                            {rule.kind === 'income' ? '+' : '−'}
                            {formatCents(rule.amount_cents)}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </Card>
          )}
        </div>

        <div>
          <SectionTitle
            action={
              <Link to="/financeiro/contas">
                <Button variant="ghost" size="sm">
                  <ArrowRight />
                </Button>
              </Link>
            }
          >
            Contas
          </SectionTitle>
          <div className="space-y-2">
            {finance.summaries.map((summary) => (
              <Card key={summary.account.id}>
                <CardContent className="flex items-center gap-3 py-3">
                  <span
                    className="size-8 shrink-0 rounded-lg"
                    style={{ background: `${summary.account.color}2a` }}
                  >
                    <CreditCard
                      className="m-auto size-4 translate-y-2"
                      style={{ color: summary.account.color }}
                    />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-fg truncate text-sm font-medium">
                      {summary.account.name}
                    </p>
                    <p className="text-fg-subtle text-[11px]">
                      {summary.account.kind === 'credit'
                        ? `Fatura de ${competenceLabel(competence).toLowerCase()}`
                        : (summary.account.bank ?? 'Conta')}
                    </p>
                  </div>
                  <span
                    className={
                      summary.account.kind === 'credit'
                        ? 'text-fg text-sm font-medium'
                        : summary.balance < 0
                          ? 'text-negative text-sm font-medium'
                          : 'text-fg text-sm font-medium'
                    }
                  >
                    {formatCents(
                      summary.account.kind === 'credit' ? (summary.invoice ?? 0) : summary.balance,
                    )}
                  </span>
                </CardContent>
              </Card>
            ))}
          </div>

          {finance.budgets.length > 0 && (
            <>
              <SectionTitle
                action={
                  <Link to="/financeiro/orcamento">
                    <Button variant="ghost" size="sm">
                      <ArrowRight />
                    </Button>
                  </Link>
                }
              >
                Orçamento
              </SectionTitle>
              <Card>
                <CardContent className="space-y-3">
                  {finance.budgets.slice(0, 4).map(({ budget, category, progress }) => (
                    <div key={budget.id} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-fg-muted flex min-w-0 items-center gap-1.5 truncate">
                          <CategoryIcon icon={category?.icon} color={category?.color} className="size-3.5 shrink-0" />
                          {category?.name ?? 'Categoria'}
                        </span>
                        <Badge
                          tone={
                            progress.status === 'exceeded'
                              ? 'negative'
                              : progress.status === 'warning'
                                ? 'warning'
                                : 'neutral'
                          }
                        >
                          {percent(progress.percent, 0)}
                        </Badge>
                      </div>
                      <Progress
                        value={progress.percent}
                        tone={
                          progress.status === 'exceeded'
                            ? 'negative'
                            : progress.status === 'warning'
                              ? 'warning'
                              : 'accent'
                        }
                      />
                    </div>
                  ))}
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>

      {addingTransaction && (
        <TransactionForm
          accounts={finance.accounts}
          categories={categories}
          onClose={() => setAddingTransaction(false)}
          onSave={async (draft) => {
            await createTransaction(draft)
            setAddingTransaction(false)
          }}
        />
      )}

      {editor}
    </div>
  )
}
