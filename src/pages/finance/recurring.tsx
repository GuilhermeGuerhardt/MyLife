import { Plus, Repeat } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { buttonStyles } from '@/components/ui/button'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge, EmptyState, SectionTitle, Stat } from '@/components/ui/misc'
import { useCategories, useRecurring, useTransactions } from '@/data/queries'
import type { RecurringTransaction } from '@/data/types'
import { CategoryIcon } from '@/features/finance/category-icons'
import { RecurringForm, type RecurringDraft } from '@/features/finance/recurring-form'
import { MonthNav } from '@/features/finance/shared'
import { useFinance } from '@/features/finance/use-finance'
import { useMaterializeRecurring } from '@/features/finance/actions'
import { competenceLabel, toCompetence } from '@/lib/finance/billing'
import { formatCents } from '@/lib/finance/money'
import { pendingBalance, pendingOccurrences } from '@/lib/finance/recurring'
import { shortDate } from '@/lib/format'
import { today } from '@/lib/utils'

/**
 * Contas que se repetem todo mês.
 *
 * A tela existe para não redigitar aluguel, internet e academia doze vezes por
 * ano. Ela mostra o que ainda não caiu no mês escolhido e lança de uma vez —
 * como previsto, porque a regra sabe que a conta existe, não que foi paga.
 */
export function RecurringPage() {
  const [competence, setCompetence] = useState(toCompetence(today()))
  const finance = useFinance(competence)
  const { data: categories } = useCategories()
  const { data: rules, update, remove } = useRecurring()
  const { data: transactions } = useTransactions()
  const materialize = useMaterializeRecurring()

  const [editing, setEditing] = useState<RecurringTransaction | null>(null)
  const [lancando, setLancando] = useState(false)

  const accountById = useMemo(
    () => new Map(finance.allAccounts.map((a) => [a.id, a])),
    [finance.allAccounts],
  )

  const pending = useMemo(
    () => pendingOccurrences(rules, competence, transactions),
    [rules, competence, transactions],
  )

  const monthly = rules
    .filter((r) => r.active)
    .reduce((sum, r) => sum + (r.kind === 'income' ? r.amount_cents : -r.amount_cents), 0)

  const ordered = [...rules].sort(
    (a, b) =>
      Number(b.active) - Number(a.active) ||
      a.day_of_month - b.day_of_month ||
      a.description.localeCompare(b.description),
  )

  async function lancarPendentes() {
    setLancando(true)
    try {
      await materialize(pending)
    } finally {
      setLancando(false)
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-fg text-xl font-semibold">Recorrentes</h1>
          <p className="text-fg-muted mt-1 text-sm">
            O que se repete todo mês. Uma recorrente nasce em Lançamentos, marcando
            "Se repete" — aqui você acompanha, pausa e edita.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <MonthNav competence={competence} onChange={setCompetence} />
          <Link to="/financeiro/transacoes" className={buttonStyles({ variant: 'secondary' })}>
            <Plus />
            Nova pelo lançamento
          </Link>
        </div>
      </div>

      {pending.length > 0 && (
        <Card className="border-warning/40">
          <CardContent className="flex flex-wrap items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-fg text-sm font-medium">
                {pending.length} recorrente{pending.length === 1 ? '' : 's'} ainda não lançada
                {pending.length === 1 ? '' : 's'} em {competenceLabel(competence)}
              </p>
              <p className="text-fg-muted mt-0.5 text-xs">
                {pending.map((p) => p.rule.description).join(' · ')}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Stat
                label="Saldo"
                value={formatCents(Math.abs(pendingBalance(pending)))}
                tone={pendingBalance(pending) < 0 ? 'negative' : 'positive'}
              />
              <Button onClick={() => void lancarPendentes()} disabled={lancando}>
                {lancando ? 'Lançando…' : 'Lançar como previsto'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <SectionTitle
        action={
          rules.length > 0 && (
            <span className="text-fg-muted text-xs">
              Saldo mensal das ativas:{' '}
              <span className={monthly < 0 ? 'text-negative' : 'text-positive'}>
                {monthly < 0 ? '−' : '+'}
                {formatCents(Math.abs(monthly))}
              </span>
            </span>
          )
        }
      >
        Regras
      </SectionTitle>

      <Card>
        {ordered.length === 0 ? (
          <EmptyState
            icon={<Repeat className="size-6" />}
            title="Nenhuma recorrente"
            description='Lance aluguel, internet ou assinatura em Lançamentos e marque "Se repete" — a regra aparece aqui.'
          />
        ) : (
          <div className="divide-border-base divide-y">
            {ordered.map((rule) => {
              const category = rule.category_id ? finance.categoryById.get(rule.category_id) : null
              const account = accountById.get(rule.account_id)
              const jaLancada = !pending.some((p) => p.rule.id === rule.id)

              return (
                <button
                  key={rule.id}
                  type="button"
                  onClick={() => setEditing(rule)}
                  className="hover:bg-surface-2 flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors"
                >
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
                    <p className={`truncate text-sm ${rule.active ? 'text-fg' : 'text-fg-subtle'}`}>
                      {rule.description}
                    </p>
                    <p className="text-fg-subtle truncate text-[11px]">
                      {[
                        `todo dia ${rule.day_of_month}`,
                        account?.name,
                        category?.name,
                        rule.end_date ? `até ${shortDate(rule.end_date)}` : null,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  </div>

                  {!rule.active ? (
                    <Badge>pausada</Badge>
                  ) : jaLancada ? (
                    <Badge tone="positive">lançada</Badge>
                  ) : (
                    <Badge tone="warning">pendente</Badge>
                  )}

                  <span
                    className={`text-sm font-medium whitespace-nowrap ${
                      rule.kind === 'income' ? 'text-positive' : 'text-fg'
                    }`}
                  >
                    {rule.kind === 'income' ? '+' : '−'}
                    {formatCents(rule.amount_cents)}
                  </span>
                </button>
              )
            })}
          </div>
        )}
      </Card>

      {editing && (
        <RecurringForm
          initial={editing}
          accounts={finance.allAccounts}
          categories={categories}
          onClose={() => setEditing(null)}
          onRemove={
            editing
              ? () => {
                  void remove.mutateAsync(editing.id).then(() => setEditing(null))
                }
              : null
          }
          onSave={async (draft: RecurringDraft) => {
            await update.mutateAsync({ id: editing.id, patch: draft })
            setEditing(null)
          }}
        />
      )}
    </div>
  )
}
