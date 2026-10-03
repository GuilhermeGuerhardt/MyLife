import { CardContent } from '@/components/ui/card'
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
 *
 * Entrega só o conteúdo: quem desenha a caixa é o carrossel que o abriga.
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
    <>
      <div className="border-border-base flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b px-5 py-4">
        <div>
          <p className="text-fg-muted text-xs font-medium">
            Comprometido nos próximos {meses} meses
          </p>
          <p className="text-fg font-serif mt-1.5 text-[22px] leading-none font-semibold">
            {formatCents(projecao.total)}
          </p>
        </div>
        {projecao.heaviest && (
          <p className="text-fg-muted text-xs">
            Pico em {competenceLabel(projecao.heaviest.competence).toLowerCase()}:{' '}
            <span className="text-fg">{formatCents(projecao.heaviest.total)}</span>
          </p>
        )}
      </div>

      <CardContent className="space-y-3">
        {/* Uma cor só na barra que importa. Doze barras no acento do módulo
            viram parede âmbar, e aí nenhuma delas chama atenção. */}
        <div className="flex items-end gap-1.5">
          {projecao.months.map((mes) => (
            <div key={mes.competence} className="flex flex-1 flex-col items-center gap-1.5">
              <div className="flex h-14 w-full items-end" title={formatCents(mes.total)}>
                <div
                  className={cn(
                    'w-full transition-[height] duration-500',
                    mes.competence === projecao.heaviest?.competence
                      ? 'bg-accent'
                      : mes.total > 0
                        ? 'bg-border-strong'
                        : 'bg-border-base',
                  )}
                  // Uma lasquinha de 2px mesmo no mês vazio: a coluna sumir de
                  // vez faria parecer que o mês não existe na fila.
                  style={{ height: `${pico > 0 ? Math.max((mes.total / pico) * 100, 2) : 2}%` }}
                />
              </div>
              <span
                className={cn(
                  'text-xs',
                  mes.competence === projecao.heaviest?.competence ? 'text-fg' : 'text-fg-subtle',
                )}
              >
                {competenceLabel(mes.competence).slice(0, 3).toLowerCase()}
              </span>
            </div>
          ))}
        </div>

        <p className="text-fg-subtle text-xs leading-relaxed">
          {projecao.purchases > 0 &&
            `${projecao.purchases} compra${projecao.purchases === 1 ? '' : 's'} parcelada${
              projecao.purchases === 1 ? '' : 's'
            } entre o que falta pagar. `}
          {alemDoPeriodo &&
            projecao.lastCompetence &&
            `A última parcela só cai em ${competenceLabel(projecao.lastCompetence)}. `}
          Recorrente que ainda não foi lançada não entra nesta conta.
        </p>
      </CardContent>
    </>
  )
}
