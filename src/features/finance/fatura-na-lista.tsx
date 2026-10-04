import { CreditCard } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/misc'
import type { Account } from '@/data/types'
import { formatCents } from '@/lib/finance/money'
import type { MonthInvoice } from '@/lib/finance/reports'
import { longDate, relativeDay, shortDate } from '@/lib/format'
import { today } from '@/lib/utils'

/**
 * A fatura do cartão no meio dos lançamentos do mês.
 *
 * Ela não é um lançamento gravado — é a soma das compras da janela dela —, e é
 * justamente por isso que fica separada, acima da lista: o valor sobe sozinho a
 * cada compra nova, e somá-la ao total do mês contaria duas vezes o mesmo
 * dinheiro (as compras já estão lá, cada uma no mês em que aconteceu).
 *
 * O que ela acrescenta é o outro lado da conta: quanto o cartão vai cobrar
 * neste mês, e se já foi pago.
 */
export function FaturaNaLista({
  faturas,
  contas,
}: {
  faturas: MonthInvoice[]
  contas: Account[]
}) {
  if (faturas.length === 0) return null

  return (
    <Card className="overflow-hidden">
      <div className="divide-border-base divide-y">
        {faturas.map((fatura) => {
          const conta = contas.find((item) => item.id === fatura.accountId)
          const paga = fatura.openCents === 0
          const vencida = !paga && fatura.dueDate < today()
          // Paga pela metade: o numero da frente passa a ser o que falta, que e
          // a pergunta de quem olha. O total vira contexto, embaixo.
          const parcial = !paga && fatura.openCents !== fatura.totalCents

          return (
            <div
              key={`${fatura.accountId}-${fatura.competence}`}
              className="flex items-center gap-3 px-5 py-3.5 max-sm:px-4"
            >
              <span
                className="flex size-8 shrink-0 items-center justify-center rounded-lg"
                style={{ background: `${conta?.color ?? '#71717a'}1f` }}
              >
                <CreditCard className="size-4" style={{ color: conta?.color }} />
              </span>

              <div className="min-w-0 flex-1">
                <p className="text-fg truncate text-sm">
                  Fatura {conta?.name ?? 'do cartão'}
                </p>
                <p className="text-fg-subtle truncate text-xs first-letter:uppercase">
                  {paga
                    ? `Paga · venceu ${shortDate(fatura.dueDate)}`
                    : `Vence ${longDate(fatura.dueDate)} · ${relativeDay(fatura.dueDate)}`}
                  {parcial
                    ? ` · ${formatCents(fatura.totalCents - fatura.openCents)} já pagos de ${formatCents(fatura.totalCents)}`
                    : ''}
                </p>
              </div>

              {/* As mesmas colunas da lista logo abaixo: selo e valor alinhados,
                  e empilhados no celular pelo mesmo motivo de lá. */}
              <div className="flex shrink-0 items-center gap-3 max-sm:flex-col-reverse max-sm:items-end max-sm:gap-1">
                <span className="flex w-[5.5rem] shrink-0 justify-end max-sm:w-auto">
                  {paga ? (
                    <Badge tone="positive">paga</Badge>
                  ) : vencida ? (
                    <Badge tone="negative">vencida</Badge>
                  ) : (
                    <Badge tone="neutral">em aberto</Badge>
                  )}
                </span>

                <span className="text-fg min-w-[6.5rem] text-right text-sm font-medium whitespace-nowrap max-sm:min-w-0">
                  −{formatCents(paga ? fatura.totalCents : fatura.openCents)}
                </span>
              </div>

              {!paga && (
                <Link to="/financeiro/contas">
                  <Button variant="ghost" size="sm">
                    Quitar
                  </Button>
                </Link>
              )}
            </div>
          )
        })}
      </div>
    </Card>
  )
}
