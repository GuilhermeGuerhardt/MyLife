import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { CashFlowChart, CategoryDonut } from '@/features/finance/charts'
import { competenceLabel, type Competence } from '@/lib/finance/billing'
import { formatCents } from '@/lib/finance/money'
import { percent } from '@/lib/format'

/** Uma fatia do donut, já com a cor resolvida. */
interface Fatia {
  key: string
  name: string
  value: number
  percent: number
  color: string
}

/** Receitas e despesas dos últimos seis meses. */
export function FluxoDeCaixa({
  serie,
}: {
  serie: Array<{ competence: Competence; income: number; expense: number; label: string }>
}) {
  return (
    <Card className="lg:col-span-2">
      <CardHeader title="Fluxo de caixa" description="Receitas e despesas dos últimos 6 meses" />
      <CardContent>
        <CashFlowChart data={serie} />
      </CardContent>
    </Card>
  )
}

/**
 * Para onde foram as despesas do mês.
 *
 * O donut e a legenda recebem as mesmas fatias, já resolvidas: cada um lendo o
 * seu recorte abria espaço para a bolinha da legenda não bater com a fatia que
 * ela nomeia.
 */
export function DespesasPorCategoria({
  fatias,
  competence,
}: {
  fatias: Fatia[]
  competence: Competence
}) {
  return (
    <Card>
      <CardHeader title="Onde foi o dinheiro" description={competenceLabel(competence)} />
      <CardContent>
        {fatias.length === 0 ? (
          <p className="text-fg-muted py-8 text-center text-sm">Nenhuma despesa neste mês.</p>
        ) : (
          <>
            <CategoryDonut data={fatias} />
            <div className="mt-3 space-y-1.5">
              {fatias.map((fatia) => (
                <div key={fatia.key} className="flex items-center gap-2 text-xs">
                  <span
                    className="size-2 shrink-0 rounded-full"
                    style={{ background: fatia.color }}
                  />
                  <span className="text-fg-muted flex-1 truncate">{fatia.name}</span>
                  <span className="text-fg-subtle">{percent(fatia.percent, 0)}</span>
                  <span className="text-fg font-medium tabular-nums">
                    {formatCents(fatia.value)}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
