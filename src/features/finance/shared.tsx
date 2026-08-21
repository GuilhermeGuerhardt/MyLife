import { Check, ChevronLeft, ChevronRight, Clock, Pencil, Repeat } from 'lucide-react'
import { useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Badge, EmptyState } from '@/components/ui/misc'
import type { Account, Category, Transaction } from '@/data/types'
import { CategoryIcon } from './category-icons'
import { addMonths, competenceLabel, type Competence } from '@/lib/finance/billing'
import { formatCents } from '@/lib/finance/money'
import { shortDate } from '@/lib/format'
import { cn } from '@/lib/utils'
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

/** Arrasto necessário para a ação disparar ao soltar. */
const SWIPE_THRESHOLD = 68
const SWIPE_MAX = 140

/**
 * Linha que responde ao arrasto horizontal: direita paga, esquerda desfaz.
 *
 * O eixo só é travado depois de alguns pixels de movimento. Antes disso o gesto
 * ainda pode virar rolagem vertical, e roubá-la deixaria a lista presa no
 * celular — `touch-action: pan-y` é a outra metade dessa regra.
 *
 * As duas direções são idempotentes de propósito: arrastar para a direita
 * sempre resulta em pago, para a esquerda sempre em previsto. Um gesto que
 * alternasse o estado obrigaria a olhar a linha antes de agir.
 */
function SwipeRow({
  onSetPaid,
  onOpen,
  children,
}: {
  onSetPaid?: (paid: boolean) => void
  onOpen?: () => void
  children: ReactNode
}) {
  const [offset, setOffset] = useState(0)
  const [settling, setSettling] = useState(false)
  const origin = useRef<{ x: number; y: number } | null>(null)
  const axis = useRef<'none' | 'x'>('none')
  const dragged = useRef(false)
  // O deslocamento também vive num ref porque quem decide a ação é o `pointerup`,
  // e o state dele ainda pode estar um render atrás quando o dedo levanta.
  const distance = useRef(0)

  const armed = Math.abs(offset) >= SWIPE_THRESHOLD
  const toPaid = offset > 0

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (!onSetPaid || event.button !== 0) return
    origin.current = { x: event.clientX, y: event.clientY }
    axis.current = 'none'
    dragged.current = false
    setSettling(false)
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!origin.current) return
    const dx = event.clientX - origin.current.x
    const dy = event.clientY - origin.current.y

    if (axis.current === 'none') {
      if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return
      // Gesto vertical: solta o controle e deixa a página rolar.
      if (Math.abs(dy) >= Math.abs(dx)) {
        origin.current = null
        return
      }
      axis.current = 'x'
      dragged.current = true
      // A captura é o que garante o `pointerup` mesmo se o dedo sair da linha.
      // Onde ela não estiver disponível o arrasto ainda funciona, só perde o
      // fim do gesto fora da área — não vale derrubar a interação por isso.
      try {
        event.currentTarget.setPointerCapture(event.pointerId)
      } catch {
        /* ponteiro já liberado */
      }
    }

    distance.current = Math.max(-SWIPE_MAX, Math.min(SWIPE_MAX, dx))
    setOffset(distance.current)
  }

  function handlePointerUp() {
    if (!origin.current) return
    origin.current = null
    if (distance.current >= SWIPE_THRESHOLD) onSetPaid?.(true)
    else if (distance.current <= -SWIPE_THRESHOLD) onSetPaid?.(false)
    distance.current = 0
    setSettling(true)
    setOffset(0)
  }

  return (
    <div className="relative overflow-hidden" style={{ touchAction: 'pan-y' }}>
      {offset !== 0 && (
        <div
          aria-hidden
          className={cn(
            'absolute inset-0 flex items-center px-4 text-xs font-medium transition-colors',
            toPaid ? 'justify-start' : 'justify-end',
            toPaid
              ? armed
                ? 'bg-positive/25 text-positive'
                : 'bg-positive/10 text-positive'
              : armed
                ? 'bg-warning/25 text-warning'
                : 'bg-warning/10 text-warning',
          )}
        >
          {toPaid ? (
            <>
              <Check className={cn('mr-1.5 transition-all', armed ? 'size-4.5' : 'size-3.5')} />
              pago
            </>
          ) : (
            <>
              previsto
              <Clock className={cn('ml-1.5 transition-all', armed ? 'size-4.5' : 'size-3.5')} />
            </>
          )}
        </div>
      )}

      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onClick={() => {
          // Um arrasto termina em click no desktop; ele não pode abrir o modal.
          if (dragged.current) {
            dragged.current = false
            return
          }
          onOpen?.()
        }}
        className={cn(
          'bg-surface relative flex items-center gap-3 px-4 py-2.5',
          onOpen && 'hover:bg-surface-2 cursor-pointer transition-colors',
        )}
        style={{
          transform: `translateX(${offset}px)`,
          transition: settling ? 'transform 0.22s cubic-bezier(0.2, 0.8, 0.3, 1)' : 'none',
        }}
      >
        {children}
      </div>
    </div>
  )
}

export function TransactionList({
  transactions,
  accounts,
  categoryById,
  onEdit,
  onSetPaid,
  emptyTitle = 'Nenhum lançamento',
  emptyDescription,
}: {
  transactions: Transaction[]
  accounts: Account[]
  categoryById: Map<string, Category>
  onEdit?: (transaction: Transaction) => void
  onSetPaid?: (transaction: Transaction, paid: boolean) => void
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
          <SwipeRow
            key={transaction.id}
            onSetPaid={onSetPaid && ((paid) => onSetPaid(transaction, paid))}
            onOpen={onEdit && (() => onEdit(transaction))}
          >
            <span
              className="flex size-8 shrink-0 items-center justify-center rounded-lg text-sm"
              style={{ background: `${category?.color ?? '#71717a'}1f` }}
            >
              {transaction.kind === 'transfer' ? (
                <Repeat className="text-fg-muted size-3.5" />
              ) : (
                <CategoryIcon icon={category?.icon} color={category?.color} className="size-4" />
              )}
            </span>

            <div className="min-w-0 flex-1">
              <p className={cn('truncate text-sm', transaction.paid ? 'text-fg' : 'text-fg-muted')}>
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

            {onSetPaid ? (
              // O gesto é a via rápida; o clique é a que funciona com teclado e
              // leitor de tela, e a que mostra que o estado tem volta.
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation()
                  onSetPaid(transaction, !transaction.paid)
                }}
                aria-label={transaction.paid ? 'Marcar como previsto' : 'Marcar como pago'}
                className="shrink-0"
              >
                {transaction.paid ? (
                  <Badge tone="positive">
                    <Check className="size-3" />
                    pago
                  </Badge>
                ) : (
                  <Badge tone="warning">previsto</Badge>
                )}
              </button>
            ) : (
              !transaction.paid && <Badge tone="warning">previsto</Badge>
            )}

            <Amount cents={transaction.amount_cents} kind={transaction.kind} />

            {onEdit && <Pencil aria-hidden className="text-fg-subtle size-3.5 shrink-0" />}
          </SwipeRow>
        )
      })}
    </div>
  )
}
