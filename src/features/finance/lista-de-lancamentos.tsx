import { AlertTriangle, Check, Clock, Pencil, Repeat } from 'lucide-react'
import { useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { CaixaDeSelecao } from '@/components/ui/caixa-de-selecao'
import { Badge, EmptyState } from '@/components/ui/misc'
import type { Account, Category, Transaction } from '@/data/types'
import { formatCents } from '@/lib/finance/money'
import { isOverdue } from '@/lib/finance/reports'
import { aguardaFatura, podeMarcarPagamento } from '@/lib/finance/selecao'
import { shortDate } from '@/lib/format'
import { cn, today } from '@/lib/utils'
import { CategoryIcon } from './category-icons'

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
  // O sinal já diz o que é entrada e o que é saída; pintar de verde por cima
  // é dizer duas vezes, e gasta o verde que deveria significar alguma coisa.
  const tone = kind === 'transfer' ? 'text-fg-muted' : 'text-fg'
  const sign = kind === 'income' ? '+' : kind === 'expense' ? '−' : ''
  return (
    <span
      className={cn(
        tone,
        className,
        // Coluna de largura mínima: o valor alinha pela direita e o selo ao lado
        // para de andar conforme o número cresce.
        'min-w-[6.5rem] text-right text-sm font-medium whitespace-nowrap',
      )}
    >
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
  selecionada = false,
  children,
}: {
  onSetPaid?: (paid: boolean) => void
  onOpen?: () => void
  selecionada?: boolean
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
          'relative flex items-center gap-3 px-4 py-2.5',
          // Realce só de fundo: borda ou peso mudariam a altura da linha, e a
          // lista pularia a cada caixa marcada.
          selecionada ? 'bg-accent-soft' : 'bg-surface',
          onOpen && 'cursor-pointer transition-colors',
          onOpen && !selecionada && 'hover:bg-surface-2',
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

/**
 * Selo de situação: pago, previsto ou vencido.
 *
 * O atraso é calculado na hora a partir da data — nunca gravado. Um previsto do
 * dia 5 e um do dia 30 deixam de ter a mesma cara, que é a diferença entre um
 * lembrete e uma conta esquecida.
 */
function StatusBadge({
  transaction,
  naFatura,
}: {
  transaction: Transaction
  /** Compra no cartão em aberto: ela espera a fatura, não um pagamento seu. */
  naFatura: boolean
}) {
  if (transaction.paid) {
    return (
      <Badge tone="positive">
        <Check className="size-3" />
        pago
      </Badge>
    )
  }

  // A compra no cartão não tem prazo próprio: o prazo é o da fatura em que ela
  // caiu. Marcá-la de vencida enchia a lista de alarme vermelho no dia seguinte
  // a cada compra, e ainda ensinava a ignorar a cor.
  if (naFatura) return <Badge tone="neutral">na fatura</Badge>

  if (isOverdue(transaction, today())) {
    // Uma despesa vence; uma receita que não caiu está atrasada. A distinção
    // não é preciosismo: "salário vencido" lê como se você devesse o salário.
    return (
      <Badge tone="negative">
        <AlertTriangle className="size-3" />
        {transaction.kind === 'income' ? 'atrasado' : 'vencido'}
      </Badge>
    )
  }

  return <Badge tone="warning">previsto</Badge>
}

/** Impede que o clique na caixa chegue à linha, que abriria o editor ou começaria o arrasto. */
function pararNaCaixa(event: { stopPropagation: () => void }) {
  event.stopPropagation()
}

export function TransactionList({
  transactions,
  accounts,
  categoryById,
  onEdit,
  onSetPaid,
  selecao,
  emptyTitle = 'Nenhum lançamento',
  emptyDescription,
}: {
  transactions: Transaction[]
  accounts: Account[]
  categoryById: Map<string, Category>
  onEdit?: (transaction: Transaction) => void
  onSetPaid?: (transaction: Transaction, paid: boolean) => void
  /** Presente = cada linha ganha a caixa de marcar, para as ações em massa. */
  selecao?: { selecionados: ReadonlySet<string>; alternar: (id: string) => void }
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
        // A regra mora em `lib/finance/selecao`, e não aqui, porque a ação em
        // massa precisa obedecer à mesma: a linha e o lote não podem divergir.
        const naFatura = aguardaFatura(transaction, account)
        const podeMarcar = onSetPaid && podeMarcarPagamento(transaction, account)
        const target = transaction.transfer_account_id
          ? accountById.get(transaction.transfer_account_id)
          : null
        const selecionada = selecao?.selecionados.has(transaction.id) ?? false
        const titulo = transaction.description || category?.name || 'Lançamento'

        return (
          <SwipeRow
            key={transaction.id}
            onSetPaid={podeMarcar ? (paid) => onSetPaid!(transaction, paid) : undefined}
            onOpen={onEdit && (() => onEdit(transaction))}
            selecionada={selecionada}
          >
            {selecao && (
              // `contents` não ocupa lugar na linha: o invólucro existe só para
              // segurar o clique e o toque antes que subam para ela.
              <span className="contents" onClick={pararNaCaixa} onPointerDown={pararNaCaixa}>
                <CaixaDeSelecao
                  checked={selecionada}
                  onChange={() => selecao.alternar(transaction.id)}
                  // Data e valor no nome: dois "Uber" no mês soavam iguais no
                  // leitor de tela, e não dava para saber qual se marcava.
                  aria-label={`Selecionar ${titulo}, ${shortDate(transaction.date)}, ${formatCents(transaction.amount_cents)}`}
                />
              </span>
            )}

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
                {titulo}
                {transaction.installment_total && transaction.installment_total > 1 && (
                  <span className="text-fg-subtle ml-1.5 text-xs">
                    {transaction.installment_n}/{transaction.installment_total}
                  </span>
                )}
              </p>
              <p className="text-fg-subtle truncate text-xs">
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

            {/* Coluna de largura fixa: sem ela o selo flutuava com a largura do
                valor ao lado, e a lista virava uma escada de selos. */}
            <span className="flex w-[5.5rem] shrink-0 justify-end">
              {podeMarcar ? (
                // O gesto é a via rápida; o clique é a que funciona com teclado e
                // leitor de tela, e a que mostra que o estado tem volta.
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation()
                    onSetPaid(transaction, !transaction.paid)
                  }}
                  aria-label={transaction.paid ? 'Marcar como previsto' : 'Marcar como pago'}
                >
                  <StatusBadge transaction={transaction} naFatura={naFatura} />
                </button>
              ) : (
                !transaction.paid && <StatusBadge transaction={transaction} naFatura={naFatura} />
              )}
            </span>

            <Amount cents={transaction.amount_cents} kind={transaction.kind} />

            {/* No celular a caixa ocupa o lugar do lápis: a linha já não tinha
                folga, e o lápis só repete que tocar nela abre o lançamento. */}
            {onEdit && (
              <Pencil
                aria-hidden
                className={cn('text-fg-subtle size-3.5 shrink-0', selecao && 'max-sm:hidden')}
              />
            )}
          </SwipeRow>
        )
      })}
    </div>
  )
}
