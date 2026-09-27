import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/misc'
import type { Category } from '@/data/types'
import { CategoryIcon } from '@/features/finance/category-icons'
import { formatCents } from '@/lib/finance/money'
import type { PendingOccurrence } from '@/lib/finance/recurring'
import { shortDate } from '@/lib/format'

/**
 * As recorrentes do mês que ainda não viraram lançamento.
 *
 * Elas já estão somadas no total acima — é dinheiro que vai sair — e aqui
 * aparecem uma a uma, com o botão que as transforma em lançamento previsto de
 * uma vez.
 */
export function RecorrentesALancar({
  pendentes,
  categoriaPorId,
  onLancarTodas,
}: {
  pendentes: PendingOccurrence[]
  categoriaPorId: Map<string, Category>
  onLancarTodas: (pendentes: PendingOccurrence[]) => Promise<unknown>
}) {
  const [lancando, setLancando] = useState(false)

  if (pendentes.length === 0) return null

  return (
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
            void onLancarTodas(pendentes).finally(() => setLancando(false))
          }}
        >
          {lancando ? 'Lançando…' : 'Lançar todas'}
        </Button>
      </div>

      <div className="divide-border-base divide-y">
        {pendentes.map(({ rule, date }) => {
          const category = rule.category_id ? categoriaPorId.get(rule.category_id) : null
          return (
            <div key={rule.id} className="flex items-center gap-3 px-5 py-2.5">
              <span
                className="flex size-8 shrink-0 items-center justify-center rounded-lg"
                style={{ background: `${category?.color ?? '#71717a'}1f` }}
              >
                <CategoryIcon icon={category?.icon} color={category?.color} className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-fg-muted truncate text-sm">{rule.description}</p>
                <p className="text-fg-subtle truncate text-[11px]">{shortDate(date)} · recorrente</p>
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
  )
}
