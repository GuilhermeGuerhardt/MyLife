import { CalendarClock } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Stat } from '@/components/ui/misc'
import { competenceLabel } from '@/lib/finance/billing'
import { formatCents } from '@/lib/finance/money'
import type { Commitment } from '@/lib/finance/reports'
import { cn } from '@/lib/utils'

/**
 * Quanto dos meses que vêm já está gasto.
 *
 * O resto da tela olha para o mês aberto, e quem parcela em dez vezes não tem
 * problema neste mês — tem nos próximos nove. O cartão existe para mostrar essa
 * fila antes de ela virar surpresa, e some quando não há nada marcado à frente.
 */
export function CompromissoFuturo({
  projecao,
  meses,
}: {
  projecao: Commitment
  meses: number
}) {
  if (projecao.total === 0) return null

  const pico = projecao.heaviest?.total ?? 0
  const alemDoPeriodo =
    projecao.lastCompetence && projecao.lastCompetence > (projecao.months.at(-1)?.competence ?? '')

  return (
    <Card>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
          <Stat
            icon={<CalendarClock className="size-3.5" />}
            label={`Comprometido nos próximos ${meses} meses`}
            value={formatCents(projecao.total)}
            hint={
              projecao.purchases > 0
                ? `${projecao.purchases} compra${projecao.purchases === 1 ? '' : 's'} parcelada${
                    projecao.purchases === 1 ? '' : 's'
                  } entre o que falta pagar`
                : 'Despesas já lançadas, ainda não pagas'
            }
          />
          <div className="text-fg-subtle space-y-1 text-right text-[11px]">
            {projecao.heaviest && (
              <p>
                Mês mais pesado: {competenceLabel(projecao.heaviest.competence)} ·{' '}
                {formatCents(projecao.heaviest.total)}
              </p>
            )}
            {alemDoPeriodo && projecao.lastCompetence && (
              <p>A última parcela só cai em {competenceLabel(projecao.lastCompetence)}</p>
            )}
            <p>Recorrente que ainda não foi lançada não entra nesta conta.</p>
          </div>
        </div>

        <div className="flex items-end gap-1">
          {projecao.months.map((mes) => (
            <div key={mes.competence} className="flex flex-1 flex-col items-center gap-1">
              <div className="flex h-16 w-full items-end" title={formatCents(mes.total)}>
                <div
                  className={cn(
                    'w-full rounded-t-sm transition-[height] duration-500',
                    mes.competence === projecao.heaviest?.competence
                      ? 'bg-warning'
                      : 'bg-accent/60',
                  )}
                  // Uma lasquinha de 2px mesmo no mês vazio: a coluna sumir de
                  // vez faria parecer que o mês não existe na fila.
                  style={{ height: `${pico > 0 ? Math.max((mes.total / pico) * 100, 2) : 2}%` }}
                />
              </div>
              <span className="text-fg-subtle text-[10px]">
                {competenceLabel(mes.competence).slice(0, 3)}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
