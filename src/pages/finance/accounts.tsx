import { CalendarClock, Pencil, Plus, Wallet } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge, EmptyState, Progress, SectionTitle, Stat } from '@/components/ui/misc'
import { useAccounts } from '@/data/queries'
import { ACCOUNT_KIND_LABELS, type Account } from '@/data/types'
import { AccountForm } from '@/features/finance/account-form'
import { usePayInvoice, useSetTransactionPaid } from '@/features/finance/actions'
import { PayInvoiceForm } from '@/features/finance/pay-invoice-form'
import { MonthNav, TransactionList } from '@/features/finance/shared'
import { useFinance } from '@/features/finance/use-finance'
import { useTransactionEditor } from '@/features/finance/use-transaction-editor'
import { competenceLabel, statementPeriod, toCompetence } from '@/lib/finance/billing'
import { formatCents } from '@/lib/finance/money'
import { longDate, percent, relativeDay, shortDate } from '@/lib/format'
import { today } from '@/lib/utils'

export function AccountsPage() {
  const [competence, setCompetence] = useState(toCompetence(today()))
  const finance = useFinance(competence)
  const { create, update } = useAccounts()
  const setPaid = useSetTransactionPaid()
  const payInvoice = usePayInvoice()
  const { open: openEditor, editor: transactionEditor } = useTransactionEditor()
  const [editing, setEditing] = useState<Account | null>(null)
  const [payingCard, setPayingCard] = useState<Account | null>(null)
  const [adding, setAdding] = useState(false)

  /** Total ainda previsto na fatura da competência — o que o botão vai quitar. */
  const faturaEmAberto = (accountId: string) =>
    finance.monthTransactions
      .filter((t) => t.account_id === accountId && !t.paid)
      .reduce((total, t) => total + (t.kind === 'income' ? -t.amount_cents : t.amount_cents), 0)

  const cards = finance.summaries.filter((s) => s.account.kind === 'credit')
  const others = finance.summaries.filter((s) => s.account.kind !== 'credit')

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-fg text-xl font-semibold">Contas e cartões</h1>
          <p className="text-fg-muted mt-1 text-sm">
            Saldo das contas e a fatura de cada cartão, por competência.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <MonthNav competence={competence} onChange={setCompetence} />
          <Button onClick={() => setAdding(true)}>
            <Plus />
            Conta
          </Button>
        </div>
      </div>

      {finance.summaries.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Wallet className="size-6" />}
            title="Nenhuma conta cadastrada"
            action={
              <Button size="sm" onClick={() => setAdding(true)}>
                Cadastrar
              </Button>
            }
          />
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Card>
              <CardContent>
                <Stat
                  label="Saldo total"
                  value={formatCents(finance.totalBalance)}
                  tone={finance.totalBalance < 0 ? 'negative' : undefined}
                  hint="Soma das contas, sem cartões"
                />
              </CardContent>
            </Card>
            <Card>
              <CardContent>
                <Stat
                  label="Faturas do mês"
                  value={formatCents(finance.openInvoices)}
                  hint={competenceLabel(competence)}
                />
              </CardContent>
            </Card>
            <Card>
              <CardContent>
                <Stat
                  label="Saldo após faturas"
                  value={formatCents(finance.totalBalance - finance.openInvoices)}
                  tone={
                    finance.totalBalance - finance.openInvoices < 0 ? 'negative' : 'positive'
                  }
                  hint="O que sobra depois de pagar os cartões"
                />
              </CardContent>
            </Card>
          </div>

          {others.length > 0 && (
            <div>
              <SectionTitle>Contas</SectionTitle>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {others.map((summary) => (
                  <Card key={summary.account.id}>
                    <CardContent className="space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <span
                            className="size-8 rounded-lg"
                            style={{ background: summary.account.color }}
                          />
                          <div>
                            <p className="text-fg text-sm font-medium">{summary.account.name}</p>
                            <p className="text-fg-subtle text-[11px]">
                              {summary.account.bank ??
                                ACCOUNT_KIND_LABELS[summary.account.kind]}
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setEditing(summary.account)}
                          className="text-fg-subtle hover:text-fg transition-colors"
                          aria-label={`Editar ${summary.account.name}`}
                        >
                          <Pencil className="size-3.5" />
                        </button>
                      </div>
                      <p
                        className={
                          summary.balance < 0
                            ? 'text-negative text-xl font-semibold'
                            : 'text-fg text-xl font-semibold'
                        }
                      >
                        {formatCents(summary.balance)}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {cards.length > 0 && (
            <div>
              <SectionTitle>Cartões</SectionTitle>
              <div className="space-y-4">
                {cards.map((summary) => {
                  const period = statementPeriod(competence, {
                    closingDay: summary.account.closing_day ?? 1,
                    dueDay: summary.account.due_day ?? 10,
                  })
                  const items = finance.monthTransactions.filter(
                    (t) => t.account_id === summary.account.id,
                  )
                  const emAberto = items.filter((t) => !t.paid)
                  const limit = summary.account.credit_limit_cents
                  const used = limit && summary.available !== null ? limit - summary.available : 0

                  return (
                    <Card key={summary.account.id}>
                      <CardHeader
                        title={
                          <span className="flex items-center gap-2">
                            <span
                              className="size-3 rounded-full"
                              style={{ background: summary.account.color }}
                            />
                            {summary.account.name}
                          </span>
                        }
                        description={`Fatura de ${competenceLabel(competence)} · compras de ${shortDate(period.start)} a ${shortDate(period.end)}`}
                        action={
                          <button
                            type="button"
                            onClick={() => setEditing(summary.account)}
                            className="text-fg-subtle hover:text-fg transition-colors"
                            aria-label={`Editar ${summary.account.name}`}
                          >
                            <Pencil className="size-3.5" />
                          </button>
                        }
                      />
                      <CardContent className="space-y-4">
                        <div className="flex flex-wrap items-end justify-between gap-4">
                          <Stat
                            label="Total da fatura"
                            value={formatCents(summary.invoice ?? 0)}
                            hint={
                              (summary.invoice ?? 0) > 0 && (summary.openInvoice ?? 0) === 0 ? (
                                <Badge tone="positive">fatura paga</Badge>
                              ) : (summary.openInvoice ?? 0) > 0 &&
                                summary.openInvoice !== summary.invoice ? (
                                `${formatCents(summary.openInvoice ?? 0)} ainda em aberto`
                              ) : undefined
                            }
                          />
                          <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2">
                              <CalendarClock className="text-fg-subtle size-3.5" />
                              <div>
                                <p className="text-fg text-sm font-medium">
                                  Vence {longDate(period.dueDate)}
                                </p>
                                <p className="text-fg-subtle text-[11px] first-letter:uppercase">
                                  {relativeDay(period.dueDate)}
                                </p>
                              </div>
                            </div>
                            {emAberto.length > 0 && (
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => setPayingCard(summary.account)}
                              >
                                Quitar fatura
                              </Button>
                            )}
                          </div>
                        </div>

                        {limit && summary.available !== null && (
                          <div className="space-y-1.5">
                            <div className="text-fg-muted flex justify-between text-xs">
                              <span>
                                {formatCents(summary.available)} disponíveis de{' '}
                                {formatCents(limit)}
                              </span>
                              <Badge
                                tone={
                                  used / limit > 0.8
                                    ? 'negative'
                                    : used / limit > 0.5
                                      ? 'warning'
                                      : 'neutral'
                                }
                              >
                                {percent((used / limit) * 100, 0)} usado
                              </Badge>
                            </div>
                            <Progress
                              value={used}
                              max={limit}
                              tone={
                                used / limit > 0.8
                                  ? 'negative'
                                  : used / limit > 0.5
                                    ? 'warning'
                                    : 'accent'
                              }
                            />
                          </div>
                        )}

                        <div className="border-border-base -mx-5 border-t">
                          <TransactionList
                            transactions={items}
                            accounts={finance.accounts}
                            categoryById={finance.categoryById}
                            onEdit={openEditor}
                            onSetPaid={(transaction, paid) => void setPaid(transaction, paid)}
                            emptyTitle="Fatura sem lançamentos"
                            emptyDescription="Compras feitas depois do fechamento aparecem na fatura seguinte."
                          />
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            </div>
          )}
        </>
      )}

      {(adding || editing) && (
        <AccountForm
          initial={editing ?? undefined}
          onClose={() => {
            setAdding(false)
            setEditing(null)
          }}
          onSave={async (values) => {
            if (editing) await update.mutateAsync({ id: editing.id, patch: values })
            else await create.mutateAsync(values)
            setAdding(false)
            setEditing(null)
          }}
        />
      )}

      {payingCard && (
        <PayInvoiceForm
          card={payingCard}
          competence={competence}
          amountCents={faturaEmAberto(payingCard.id)}
          count={
            finance.monthTransactions.filter(
              (t) => t.account_id === payingCard.id && !t.paid,
            ).length
          }
          accounts={finance.accounts.filter((a) => a.kind !== 'credit')}
          defaultDate={today()}
          onClose={() => setPayingCard(null)}
          onConfirm={async (fromAccountId, date) => {
            await payInvoice(payingCard, competence, fromAccountId, date)
            setPayingCard(null)
          }}
        />
      )}

      {transactionEditor}
    </div>
  )
}
