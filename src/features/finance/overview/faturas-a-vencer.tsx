import { CreditCard } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import type { Account } from '@/data/types'
import { competenceLabel } from '@/lib/finance/billing'
import { formatCents } from '@/lib/finance/money'
import type { OpenInvoice } from '@/lib/finance/reports'
import { longDate, relativeDay } from '@/lib/format'

/**
 * As faturas que vencem no mês, dentro do painel do que falta.
 *
 * Fica ao lado das recorrentes a lançar pelo mesmo motivo: as duas são coisas
 * que o mês ainda vai cobrar e que não existem como lançamento seu. A compra no
 * cartão não aparece na lista de contas a pagar — ela é linha desta fatura, e
 * quem tem valor e prazo é a fatura.
 */
export function FaturasAVencer({
  faturas,
  contas,
}: {
  faturas: OpenInvoice[]
  contas: Account[]
}) {
  if (faturas.length === 0) return null

  return (
    <div className="border-border-base border-t">
      <div className="flex items-center justify-between gap-4 px-5 py-3">
        <p className="text-fg-muted text-xs font-medium">
          {faturas.length === 1 ? 'Fatura que vence neste mês' : 'Faturas que vencem neste mês'}
        </p>
        <Link to="/financeiro/contas">
          <Button variant="ghost" size="sm">
            Quitar
          </Button>
        </Link>
      </div>

      <div className="divide-border-base divide-y">
        {faturas.map((fatura) => {
          const conta = contas.find((item) => item.id === fatura.accountId)

          return (
            <div
              key={`${fatura.accountId}-${fatura.competence}`}
              className="flex items-center gap-3 px-5 py-3"
            >
              <span
                className="flex size-8 shrink-0 items-center justify-center rounded-lg"
                style={{ background: `${conta?.color ?? '#71717a'}1f` }}
              >
                <CreditCard className="size-4" style={{ color: conta?.color }} />
              </span>

              <div className="min-w-0 flex-1">
                <p className="text-fg truncate text-sm">
                  {conta?.name ?? 'Cartão'}
                  <span className="text-fg-subtle ml-1.5 text-xs">
                    {competenceLabel(fatura.competence).toLowerCase()}
                  </span>
                </p>
                <p className="text-fg-subtle truncate text-xs first-letter:uppercase">
                  Vence {longDate(fatura.dueDate)} · {relativeDay(fatura.dueDate)}
                </p>
              </div>

              <span className="text-fg text-sm font-medium">{formatCents(fatura.totalCents)}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
