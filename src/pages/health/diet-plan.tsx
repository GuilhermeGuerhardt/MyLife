import { AlertTriangle, Info, Lightbulb, Target, TrendingDown } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Field, Input } from '@/components/ui/field'
import { Badge, EmptyState, Progress, SectionTitle, Stat } from '@/components/ui/misc'
import { useDailyMetrics, useDietPlans } from '@/data/queries'
import { useHealthSummary } from '@/features/health/use-health-summary'
import { WeightChart, type WeightPoint } from '@/features/health/weight-chart'
import { decimal, integer, kcal, longDate } from '@/lib/format'
import { buildDietPlan, projectWeightCurve, recalibrate } from '@/lib/health/diet-plan'
import { buildSuggestions } from '@/lib/health/suggestions'
import { addDays, today } from '@/lib/utils'

export function DietPlanPage() {
  const summary = useHealthSummary()
  const { data: plans, create, update } = useDietPlans()
  const { data: metrics } = useDailyMetrics()

  const [targetWeight, setTargetWeight] = useState('')
  const [targetDate, setTargetDate] = useState('')

  const weight = summary.currentWeight

  const plan = useMemo(() => {
    if (!weight || !summary.hasProfile) return null
    const target = targetWeight
      ? Number(targetWeight.replace(',', '.'))
      : Number((weight * 0.9).toFixed(1))
    return buildDietPlan({
      weightKg: weight,
      heightCm: summary.heightCm,
      ageYears: summary.age,
      sex: summary.sex,
      activityLevel: summary.profile?.activity_level ?? 'moderate',
      targetWeightKg: target,
      targetDate: targetDate || undefined,
      measuredTdee: summary.weekSessions.length > 0 ? (summary.tdee ?? undefined) : undefined,
    })
  }, [weight, targetWeight, targetDate, summary])

  const active = summary.activePlan

  // Curva projetada sobreposta às pesagens reais.
  const chartData = useMemo<WeightPoint[]>(() => {
    if (!active || !summary.weightSeries.length) return summary.weightSeries
    const curve = projectWeightCurve(
      { weeklyLossKg: active.weekly_loss_kg, estimatedWeeks: 52 },
      active.start_weight_kg,
      active.target_weight_kg,
      new Date(`${active.start_date}T12:00:00`),
    )
    const byDate = new Map(curve.map((p) => [p.date, p.projectedKg]))
    const last = summary.weightSeries[summary.weightSeries.length - 1]!

    const merged: WeightPoint[] = summary.weightSeries.map((point) => ({
      ...point,
      projected: nearestProjection(byDate, point.date),
    }))

    // Estende a projeção 8 semanas além do último registro, para dar horizonte.
    for (let week = 1; week <= 8; week++) {
      const date = addDays(last.date, week * 7)
      const projected = nearestProjection(byDate, date)
      if (projected === undefined) break
      merged.push({ date, value: NaN, average: NaN, projected })
    }
    return merged
  }, [active, summary.weightSeries])

  const recalibration = useMemo(() => {
    if (!active) return null
    const start = active.start_date
    return recalibrate(
      { weeklyLossKg: active.weekly_loss_kg, dailyCalories: active.daily_calories },
      summary.weightSeries.filter((p) => p.date >= start).map((p) => ({ date: p.date, value: p.value })),
      { sex: summary.sex },
    )
  }, [active, summary.weightSeries, summary.sex])

  const suggestions = useMemo(() => {
    if (!plan || !weight) return []
    const week = metrics.filter((m) => m.date >= addDays(today(), -6))
    const sleepValues = week.map((m) => m.sleep_hours).filter((v): v is number => v != null)
    return buildSuggestions({
      plan,
      weightKg: weight,
      weeklySessions: summary.weekSessions.length,
      weeklyMinutes: summary.weekMinutes,
      avgSleepHours: sleepValues.length
        ? sleepValues.reduce((a, b) => a + b, 0) / sleepValues.length
        : null,
      proteinToday: summary.intake.protein,
      waterTodayMl: metrics.find((m) => m.date === today())?.water_ml ?? null,
    })
  }, [plan, weight, metrics, summary])

  if (!weight || !summary.hasProfile) {
    return (
      <div className="space-y-6">
        <h1 className="text-fg text-xl font-semibold">Plano de emagrecimento</h1>
        <Card>
          <EmptyState
            icon={<Target className="size-6" />}
            title="Faltam dados para montar o plano"
            description="O cálculo precisa da sua altura e data de nascimento (no perfil) e de pelo menos uma pesagem."
            action={
              <div className="flex gap-2">
                <Link to="/perfil">
                  <Button size="sm" variant="secondary">
                    Perfil
                  </Button>
                </Link>
                <Link to="/saude">
                  <Button size="sm">Registrar pesagem</Button>
                </Link>
              </div>
            }
          />
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-fg text-xl font-semibold">Plano de emagrecimento</h1>
        <p className="text-fg-muted mt-1 text-sm">
          Mifflin-St Jeor para a TMB, gasto ajustado pelos seus treinos e déficit dentro de limites
          seguros.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
        <Card className="h-fit">
          <CardHeader title="Sua meta" description={`Peso atual: ${decimal(weight, 1)} kg (média 7 dias)`} />
          <CardContent className="space-y-4">
            <Field
              label="Peso desejado"
              suffix="kg"
              hint={`Faixa saudável para ${summary.heightCm} cm: ${decimal(summary.healthyRange.min, 1)}–${decimal(summary.healthyRange.max, 1)} kg`}
            >
              <Input
                inputMode="decimal"
                value={targetWeight}
                placeholder={String((weight * 0.9).toFixed(1)).replace('.', ',')}
                onChange={(e) => setTargetWeight(e.target.value)}
              />
            </Field>

            <Field
              label="Prazo (opcional)"
              hint="Se o prazo exigir um ritmo insalubre, o plano trava no limite seguro e avisa."
            >
              <Input
                type="date"
                value={targetDate}
                min={today()}
                onChange={(e) => setTargetDate(e.target.value)}
              />
            </Field>

            {plan && (
              <Button
                className="w-full"
                onClick={async () => {
                  if (active) await update.mutateAsync({ id: active.id, patch: { status: 'archived' } })
                  await create.mutateAsync({
                    start_date: today(),
                    start_weight_kg: weight,
                    target_weight_kg: targetWeight
                      ? Number(targetWeight.replace(',', '.'))
                      : Number((weight * 0.9).toFixed(1)),
                    target_date: targetDate || null,
                    bmr: plan.bmr,
                    tdee: plan.tdee,
                    daily_calories: plan.dailyCalories,
                    daily_deficit: plan.dailyDeficit,
                    weekly_loss_kg: plan.weeklyLossKg,
                    protein_g: plan.macros.proteinG,
                    fat_g: plan.macros.fatG,
                    carb_g: plan.macros.carbG,
                    estimated_date: plan.estimatedDate,
                    status: 'active',
                  })
                }}
              >
                {active ? 'Substituir plano ativo' : 'Ativar este plano'}
              </Button>
            )}

            {plans.length > 0 && (
              <p className="text-fg-subtle text-[11px]">
                {plans.filter((p) => p.status === 'archived').length} plano(s) arquivado(s).
              </p>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          {plan && (
            <>
              {plan.warnings.length > 0 && (
                <div className="space-y-2">
                  {plan.warnings.map((warning) => (
                    <div
                      key={warning.code}
                      className="border-warning/40 bg-warning/5 flex gap-2.5 rounded-[var(--radius-card)] border px-4 py-3"
                    >
                      <AlertTriangle className="text-warning mt-0.5 size-4 shrink-0" />
                      <p className="text-fg text-xs leading-relaxed">{warning.message}</p>
                    </div>
                  ))}
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <Card>
                  <CardContent>
                    <Stat
                      label="Calorias por dia"
                      value={integer(plan.dailyCalories)}
                      unit="kcal"
                      hint={`Gasto estimado: ${kcal(plan.tdee)}`}
                    />
                  </CardContent>
                </Card>
                <Card>
                  <CardContent>
                    <Stat
                      label="Déficit"
                      value={integer(plan.dailyDeficit)}
                      unit="kcal"
                      hint={`${decimal(plan.deficitPercent, 1)}% do gasto`}
                    />
                  </CardContent>
                </Card>
                <Card>
                  <CardContent>
                    <Stat
                      icon={<TrendingDown className="size-3.5" />}
                      label="Ritmo"
                      value={decimal(plan.weeklyLossKg, 2)}
                      unit="kg/sem"
                      hint={`${decimal(plan.weeklyLossPercent, 2)}% do peso — limite seguro: 1%`}
                    />
                  </CardContent>
                </Card>
                <Card>
                  <CardContent>
                    <Stat
                      icon={<Target className="size-3.5" />}
                      label="Previsão"
                      value={plan.estimatedWeeks ? `${plan.estimatedWeeks} sem` : '—'}
                      hint={
                        plan.estimatedWeeks
                          ? `${longDate(plan.estimatedDate)} · ${decimal(plan.totalToLoseKg, 1)} kg a perder`
                          : 'Manutenção'
                      }
                    />
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader
                  title="Distribuição dos macronutrientes"
                  description="Proteína e gordura por kg de peso; carboidrato preenche o restante."
                />
                <CardContent className="space-y-4">
                  <MacroBar
                    label="Proteína"
                    grams={plan.macros.proteinG}
                    kcalValue={plan.macros.proteinKcal}
                    total={plan.dailyCalories}
                    tone="accent"
                    note="1,8 g/kg — preserva massa magra"
                  />
                  <MacroBar
                    label="Carboidrato"
                    grams={plan.macros.carbG}
                    kcalValue={plan.macros.carbKcal}
                    total={plan.dailyCalories}
                    tone="warning"
                    note="Energia para treinar"
                  />
                  <MacroBar
                    label="Gordura"
                    grams={plan.macros.fatG}
                    kcalValue={plan.macros.fatKcal}
                    total={plan.dailyCalories}
                    tone="positive"
                    note="0,9 g/kg — mínimo hormonal"
                  />
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>

      {active && (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader
              title="Real x projetado"
              description="Linha cheia = sua média móvel. Tracejado = a curva que o plano previu."
            />
            <CardContent>
              <WeightChart data={chartData} targetKg={active.target_weight_kg} height={280} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader title="Recalibração" description="Revisada a cada 2 semanas" />
            <CardContent className="space-y-4">
              {recalibration && (
                <>
                  <Badge
                    tone={
                      recalibration.status === 'on_track'
                        ? 'positive'
                        : recalibration.status === 'insufficient_data'
                          ? 'neutral'
                          : 'warning'
                    }
                  >
                    {
                      {
                        on_track: 'No ritmo',
                        too_slow: 'Abaixo do previsto',
                        too_fast: 'Rápido demais',
                        insufficient_data: 'Dados insuficientes',
                      }[recalibration.status]
                    }
                  </Badge>
                  <p className="text-fg-muted text-xs leading-relaxed">{recalibration.message}</p>

                  {recalibration.calorieAdjustment !== 0 && (
                    <Button
                      size="sm"
                      className="w-full"
                      onClick={() =>
                        update.mutate({
                          id: active.id,
                          patch: { daily_calories: recalibration.suggestedDailyCalories },
                        })
                      }
                    >
                      Aplicar {integer(recalibration.suggestedDailyCalories)} kcal
                    </Button>
                  )}

                  <div className="border-border-base space-y-1.5 border-t pt-3 text-xs">
                    <Row label="Alvo atual" value={kcal(active.daily_calories)} />
                    <Row label="Ritmo projetado" value={`${decimal(active.weekly_loss_kg, 2)} kg/sem`} />
                    <Row
                      label="Ritmo real"
                      value={`${decimal(recalibration.actualWeeklyLossKg, 2)} kg/sem`}
                    />
                    <Row label="Meta" value={`${decimal(active.target_weight_kg, 1)} kg`} />
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      <div>
        <SectionTitle>Sugestões</SectionTitle>
        <div className="grid gap-3 md:grid-cols-2">
          {suggestions.map((suggestion) => (
            <Card key={suggestion.id}>
              <CardContent className="flex gap-3 py-4">
                <Lightbulb
                  className={
                    suggestion.tone === 'warning'
                      ? 'text-warning mt-0.5 size-4 shrink-0'
                      : suggestion.tone === 'positive'
                        ? 'text-positive mt-0.5 size-4 shrink-0'
                        : 'text-accent mt-0.5 size-4 shrink-0'
                  }
                />
                <div>
                  <p className="text-fg text-sm font-medium">{suggestion.title}</p>
                  <p className="text-fg-muted mt-1 text-xs leading-relaxed">{suggestion.detail}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <div className="text-fg-subtle flex gap-2 rounded-[var(--radius-card)] border px-4 py-3 text-xs leading-relaxed">
        <Info className="mt-0.5 size-3.5 shrink-0" />
        <p>
          Os números vêm de equações populacionais (Mifflin-St Jeor e fatores de atividade) e são
          estimativas com margem de erro individual. Isto não é orientação nutricional ou médica —
          para condições de saúde, uso de medicação ou metas agressivas, procure um profissional.
        </p>
      </div>
    </div>
  )
}

function nearestProjection(byDate: Map<string, number>, date: string): number | undefined {
  if (byDate.has(date)) return byDate.get(date)
  // A curva é semanal; procura o ponto mais próximo dentro de 3 dias.
  for (let offset = 1; offset <= 3; offset++) {
    const before = byDate.get(addDays(date, -offset))
    if (before !== undefined) return before
    const after = byDate.get(addDays(date, offset))
    if (after !== undefined) return after
  }
  return undefined
}

function MacroBar({
  label,
  grams,
  kcalValue,
  total,
  tone,
  note,
}: {
  label: string
  grams: number
  kcalValue: number
  total: number
  tone: 'accent' | 'positive' | 'warning'
  note: string
}) {
  const share = total > 0 ? (kcalValue / total) * 100 : 0
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-fg text-sm font-medium">{label}</span>
        <span className="text-fg-muted text-xs">
          {integer(grams)} g · {integer(kcalValue)} kcal · {decimal(share, 0)}%
        </span>
      </div>
      <Progress value={share} tone={tone} />
      <p className="text-fg-subtle text-[11px]">{note}</p>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-fg-muted">{label}</span>
      <span className="text-fg font-medium">{value}</span>
    </div>
  )
}
