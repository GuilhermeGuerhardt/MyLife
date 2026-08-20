import { ChevronLeft, ChevronRight, Repeat, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge, EmptyState } from '@/components/ui/misc'
import type { Account, Category, Transaction } from '@/data/types'
import { addMonths, competenceLabel, type Competence } from '@/lib/finance/billing'
import { formatCents } from '@/lib/finance/money'
import { shortDate } from '@/lib/format'
import { toCompetence } from '@/lib/finance/billing'
import { today } from '@/lib/utils'

export function MonthNav({
  competence,
  onChange,
}: {
  competence: Competence
  onChange: (competence: Competence) => void
}) {
  const isCurrent = competence === toCompetence(today())

  return (
    <div className="flex items-center gap-1">
      <Button
        variant="ghost"
        size="icon"
        onClick={() => onChange(addMonths(competence, -1))}
        aria-label="Mês anterior"
      >
        <ChevronLeft />
      </Button>
      <div className="min-w-36 text-center">
        <p className="text-fg text-sm font-medium">{competenceLabel(competence)}</p>
        {!isCurrent && (
          <button
            type="button"
            onClick={() => onChange(toCompetence(today()))}
            className="text-fg-subtle hover:text-fg text-[11px] transition-colors"
          >
            voltar para o mês atual
          </button>
        )}
      </div>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => onChange(addMonths(competence, 1))}
        aria-label="Próximo mês"
      >
        <ChevronRight />
      </Button>
    </div>
  )
}

/** Valor com sinal e cor conforme o tipo do lançamento. */
export function Amount({
  cents,
  kind,
  className,
}: {
  cents: number
  kind: Transaction['kind']
  className?: string
}) {
  const tone =
    kind === 'income' ? 'text-positive' : kind === 'transfer' ? 'text-fg-muted' : 'text-fg'
  const sign = kind === 'income' ? '+' : kind === 'expense' ? '−' : ''
  return (
    <span className={`${tone} ${className ?? ''} text-sm font-medium whitespace-nowrap`}>
      {sign}
      {formatCents(cents)}
    </span>
  )
}

export function TransactionList({
  transactions,
  accounts,
  categoryById,
  onRemove,
  onTogglePaid,
  emptyTitle = 'Nenhum lançamento',
  emptyDescription,
}: {
  transactions: Transaction[]
  accounts: Account[]
  categoryById: Map<string, Category>
  onRemove?: (transaction: Transaction) => void
  onTogglePaid?: (transaction: Transaction) => void
  emptyTitle?: string
  emptyDescription?: string
}) {
  if (transactions.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />
  }

  const accountById = new Map(accounts.map((a) => [a.id, a]))

  return (
    <div className="divide-border-base divide-y">
      {transactions.map((transaction) => {
        const category = transaction.category_id
          ? categoryById.get(transaction.category_id)
          : null
        const account = accountById.get(transaction.account_id)
        const target = transaction.transfer_account_id
          ? accountById.get(transaction.transfer_account_id)
          : null

        return (
          <div key={transaction.id} className="flex items-center gap-3 px-4 py-2.5">
            <span
              className="flex size-8 shrink-0 items-center justify-center rounded-lg text-sm"
              style={{ background: `${category?.color ?? '#71717a'}1f` }}
            >
              {transaction.kind === 'transfer' ? (
                <Repeat className="text-fg-muted size-3.5" />
              ) : (
                (category?.icon ?? '•')
              )}
            </span>

            <div className="min-w-0 flex-1">
              <p className="text-fg truncate text-sm">
                {transaction.description || category?.name || 'Lançamento'}
                {transaction.installment_total && transaction.installment_total > 1 && (
                  <span className="text-fg-subtle ml-1.5 text-[11px]">
                    {transaction.installment_n}/{transaction.installment_total}
                  </span>
                )}
              </p>
              <p className="text-fg-subtle truncate text-[11px]">
                {[
                  shortDate(transaction.date),
                  transaction.kind === 'transfer'
                    ? `${account?.name} → ${target?.name}`
                    : account?.name,
                  transaction.kind !== 'transfer' ? category?.name : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            </div>

            {!transaction.paid && (
              <button type="button" onClick={() => onTogglePaid?.(transaction)}>
                <Badge tone="warning">previsto</Badge>
              </button>
            )}

            <Amount cents={transaction.amount_cents} kind={transaction.kind} />

            {onRemove && (
              <button
                type="button"
                onClick={() => onRemove(transaction)}
                className="text-fg-subtle hover:text-negative transition-colors"
                aria-label="Remover lançamento"
              >
                <Trash2 className="size-3.5" />
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}
