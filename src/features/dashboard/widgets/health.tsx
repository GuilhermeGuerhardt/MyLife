/** Widgets de saúde: peso, calorias, treinos e o plano de emagrecimento. */

import { Activity, ArrowRight, Scale, Target, TrendingDown, Utensils } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Progress, Stat } from '@/components/ui/misc'
import { useActivityTypes } from '@/data/queries'
import { useHealthSummary } from '@/features/health/use-health-summary'
import { decimal, integer, longDate, signed } from '@/lib/format'

export function WeightWidget() {
  const summary = useHealthSummary()
  return (
    <Card className="accent-health h-full">
      <CardContent>
        <Stat
          icon={<Scale className="size-3.5" />}
          label="Peso"
          value={summary.currentWeight ? decimal(summary.currentWeight, 1) : '—'}
          unit={summary.currentWeight ? 'kg' : undefined}
          hint={
            summary.weightTrend.delta
              ? `${signed(summary.weightTrend.delta, 1)} kg em 30 dias`
              : 'média móvel de 7 dias'
          }
          tone={summary.weightTrend.delta < 0 ? 'positive' : undefined}
        />
      </CardContent>
    </Card>
  )
}

export function CaloriesWidget() {
  const summary = useHealthSummary()
  const target = summary.activePlan?.daily_calories ?? summary.tdee ?? null
  const remaining = target ? target - summary.intake.kcal : null

  return (
    <Card className="accent-health h-full">
      <CardContent>
        <Stat
          icon={<Utensils className="size-3.5" />}
          label="Calorias restantes"
          value={remaining !== null ? integer(Math.max(remaining, 0)) : '—'}
          unit={remaining !== null ? 'kcal' : undefined}
          tone={remaining !== null && remaining < 0 ? 'negative' : undefined}
          hint={
            target
              ? `${integer(summary.intake.kcal)} de ${integer(target)} kcal hoje`
              : 'Defina um plano ou registre o peso'
          }
        />
      </CardContent>
    </Card>
  )
}

export function WorkoutsWidget() {
  const summary = useHealthSummary()
  const { data: activities } = useActivityTypes()

  const enabled = activities.filter((a) => a.enabled && a.weekly_goal)
  const goal = enabled.reduce((sum, a) => sum + (a.weekly_goal ?? 0), 0)
  const done = enabled.reduce(
    (sum, a) => sum + summary.weekSessions.filter((s) => s.activity_type_id === a.id).length,
    0,
  )

  return (
    <Card className="accent-health h-full">
      <CardContent>
        <Stat
          icon={<Activity className="size-3.5" />}
          label="Treinos na semana"
          value={summary.weekSessions.length}
          hint={goal ? `Meta: ${goal} sessões` : 'Sem metas definidas'}
        />
        {goal > 0 && <Progress className="mt-3" value={done} max={goal} />}
      </CardContent>
    </Card>
  )
}

export function DietPlanWidget() {
  const summary = useHealthSummary()
  const plan = summary.activePlan
  const percent =
    plan && summary.currentWeight
      ? planPercent(plan.start_weight_kg, plan.target_weight_kg, summary.currentWeight)
      : 0

  return (
    <Card className="accent-health h-full">
      <CardHeader
        title="Plano de emagrecimento"
        description={plan ? `Meta: ${decimal(plan.target_weight_kg, 1)} kg` : 'Nenhum plano ativo'}
        action={
          <Link to="/saude/plano">
            <Button variant="ghost" size="sm">
              Abrir <ArrowRight />
            </Button>
          </Link>
        }
      />
      <CardContent>
        {plan && summary.currentWeight ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
              <Stat label="Alvo diário" value={integer(plan.daily_calories)} unit="kcal" />
              <Stat
                label="Ritmo"
                value={decimal(plan.weekly_loss_kg, 2)}
                unit="kg/sem"
                icon={<TrendingDown className="size-3.5" />}
              />
              <Stat
                label="Previsão"
                value={longDate(plan.estimated_date).replace(/ de \d{4}/, '')}
                icon={<Target className="size-3.5" />}
              />
            </div>
            <div>
              <div className="text-fg-muted mb-1.5 flex justify-between text-xs">
                <span>
                  {decimal(plan.start_weight_kg, 1)} kg → {decimal(plan.target_weight_kg, 1)} kg
                </span>
                <span className="text-fg font-medium">{integer(percent)}%</span>
              </div>
              <Progress value={percent} />
              <p className="text-fg-subtle mt-2 text-[11px]">
                Faltam {decimal(Math.max(summary.currentWeight - plan.target_weight_kg, 0), 1)} kg ·
                já foram {decimal(Math.max(plan.start_weight_kg - summary.currentWeight, 0), 1)} kg
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-start gap-3 py-2">
            <p className="text-fg-muted text-sm">
              Informe peso, altura e meta que o app calcula TMB, gasto diário, déficit seguro e
              macros — e recalibra sozinho conforme você avança.
            </p>
            <Link to="/saude/plano">
              <Button size="sm">Montar plano</Button>
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function planPercent(start: number, target: number, current: number): number {
  const total = start - target
  if (total <= 0) return 100
  return Math.min(Math.max(((start - current) / total) * 100, 0), 100)
}
