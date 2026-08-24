import { ArrowDown, ArrowUp, Lightbulb, Minus } from 'lucide-react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge, EmptyState } from '@/components/ui/misc'
import { useInsights } from '@/features/routine/use-insights'
import type { Insight, ReviewMetric } from '@/lib/insights/insights'
import type { WeekStats } from '@/lib/insights/weeks'
import { decimal, integer, shortDate } from '@/lib/format'
import { cn } from '@/lib/utils'

const AREA_ACCENT: Record<Insight['area'], string> = {
  health: 'accent-health',
  education: 'accent-education',
  finance: 'accent-finance',
  routine: 'accent-routine',
}

const AREA_LABELS: Record<Insight['area'], string> = {
  health: 'Saúde',
  education: 'Estudos',
  finance: 'Financeiro',
  routine: 'Rotina',
}

export function InsightsPage() {
  const { insights, review, weeks, weeksWithData } = useInsights()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-fg text-xl font-semibold">Insights</h1>
        <p className="text-fg-muted mt-1 max-w-2xl text-sm">
          O que aparece quando os módulos são olhados juntos. Tudo aqui compara semanas — o dia é
          ruído demais — e nada é afirmado sem pelo menos três semanas de cada lado.
        </p>
      </div>

      <Card>
        <CardHeader
          title="Revisão semanal"
          description={
            review.week
              ? `Semana de ${shortDate(review.week.start)} a ${shortDate(review.week.end)}${review.previous ? ', comparada com a anterior' : ''}`
              : 'Sem dados ainda'
          }
        />
        <CardContent>
          {review.metrics.length === 0 ? (
            <EmptyState
              title="Nada registrado ainda"
              description="Registre treinos, peso, sono ou gastos e a revisão aparece aqui."
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
              {review.metrics.map((metric) => (
                <ReviewCell key={metric.label} metric={metric} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div>
        <div className="mb-3 flex items-baseline justify-between gap-4">
          <h2 className="text-fg text-base font-semibold">Padrões encontrados</h2>
          <span className="text-fg-subtle text-xs">
            {weeksWithData} semana{weeksWithData === 1 ? '' : 's'} com registro
          </span>
        </div>

        {insights.length === 0 ? (
          <Card>
            <EmptyState
              icon={<Lightbulb className="size-6" />}
              title="Ainda não dá para afirmar nada"
              description="Os cruzamentos precisam de algumas semanas de histórico. Registre treino, sono, humor e gastos por um mês e os primeiros padrões aparecem — vazio aqui é honestidade, não falta de recurso."
            />
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {insights.map((insight) => (
              <Card key={insight.id} className={AREA_ACCENT[insight.area]}>
                <CardContent className="space-y-2.5">
                  <div className="flex items-center gap-2">
                    <Badge tone="accent">{AREA_LABELS[insight.area]}</Badge>
                    <Badge tone={insight.strength === 'forte' ? 'positive' : 'neutral'}>
                      evidência {insight.strength}
                    </Badge>
                  </div>
                  <p className="text-fg text-sm leading-relaxed">{insight.text}</p>
                  <p className="text-fg-subtle text-[11px]">
                    Baseado em {insight.sample} semanas. É um padrão observado, não uma relação de
                    causa.
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Card>
        <CardHeader
          title="Semana a semana"
          description="Treinos e gasto de cada semana, do mais antigo para o mais recente."
        />
        <CardContent>
          <WeekBars weeks={weeks} />
        </CardContent>
      </Card>
    </div>
  )
}

function ReviewCell({ metric }: { metric: ReviewMetric }) {
  const { delta, higherIsBetter } = metric
  const good = delta === null || delta === 0 ? null : higherIsBetter ? delta > 0 : delta < 0
  const Icon = delta === null || delta === 0 ? Minus : delta > 0 ? ArrowUp : ArrowDown

  return (
    <div className="space-y-1">
      <p className="text-fg-muted text-xs font-medium">{metric.label}</p>
      <p className="text-fg flex items-baseline gap-1 text-lg font-semibold">
        {metric.unit === 'R$' && <span className="text-fg-subtle text-xs">R$</span>}
        {metric.value}
        {metric.unit && metric.unit !== 'R$' && (
          <span className="text-fg-subtle text-xs font-medium">{metric.unit}</span>
        )}
      </p>
      <p
        className={cn(
          'flex items-center gap-0.5 text-[11px]',
          good === null ? 'text-fg-subtle' : good ? 'text-positive' : 'text-negative',
        )}
      >
        <Icon className="size-3" />
        {delta === null
          ? 'sem comparação'
          : delta === 0
            ? 'igual à semana anterior'
            : formatDelta(metric, delta)}
      </p>
    </div>
  )
}

function formatDelta(metric: ReviewMetric, delta: number): string {
  if (metric.unit === 'R$') return `R$ ${integer(Math.abs(delta) / 100)}`
  if (metric.unit === 'kg' || metric.unit === 'h') return `${decimal(Math.abs(delta), 1)} ${metric.unit}`
  return `${integer(Math.abs(delta))}${metric.unit ? ` ${metric.unit}` : ''}`
}

/**
 * Barras em CSS puro. Um gráfico de 16 pontos não justifica carregar a
 * biblioteca inteira de charts numa rota que já tem o que mostrar.
 */
function WeekBars({ weeks }: { weeks: WeekStats[] }) {
  const maxWorkouts = Math.max(...weeks.map((week) => week.workouts), 1)
  const maxExpense = Math.max(...weeks.map((week) => week.expenseCents), 1)

  if (weeks.length === 0) return <p className="text-fg-muted text-sm">Sem semanas para mostrar.</p>

  return (
    <div className="space-y-4">
      <div className="flex items-end gap-1.5 overflow-x-auto pb-1">
        {weeks.map((week) => (
          <div key={week.start} className="flex min-w-8 flex-1 flex-col items-center gap-1">
            <div className="flex h-24 w-full items-end justify-center gap-0.5">
              <span
                title={`${week.workouts} treinos`}
                className="bg-series-workout w-1/2 rounded-t-sm"
                style={{ height: `${(week.workouts / maxWorkouts) * 100}%` }}
              />
              <span
                title={`R$ ${integer(week.expenseCents / 100)} em gastos`}
                className="bg-negative w-1/2 rounded-t-sm"
                style={{ height: `${(week.expenseCents / maxExpense) * 100}%` }}
              />
            </div>
            <span className="text-fg-subtle text-[9px] whitespace-nowrap">
              {shortDate(week.start)}
            </span>
          </div>
        ))}
      </div>
      <div className="text-fg-subtle flex items-center gap-4 text-[11px]">
        <span className="flex items-center gap-1.5">
          <span className="bg-series-workout size-2 rounded-sm" />
          Treinos
        </span>
        <span className="flex items-center gap-1.5">
          <span className="bg-negative size-2 rounded-sm" />
          Gasto da semana
        </span>
      </div>
    </div>
  )
}
