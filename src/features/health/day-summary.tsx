import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Progress, Stat } from '@/components/ui/misc'
import type { DietPlanRow } from '@/data/types'
import { integer } from '@/lib/format'
import type { MacroTotals } from '@/lib/health/nutrition'

/** O cartão lateral do diário: quanto ainda cabe hoje e como vão os macros. */
export function DaySummary({
  totals,
  targetKcal,
  plan,
  showTrainingNote,
}: {
  totals: MacroTotals
  targetKcal: number
  plan: DietPlanRow | null
  /** O aviso só faz sentido para quem treinou na semana. */
  showTrainingNote: boolean
}) {
  const remaining = targetKcal - totals.kcal

  return (
    <Card>
      <CardHeader
        title="Resumo do dia"
        description={plan ? 'Meta vinda do plano ativo' : 'Meta = seu gasto estimado'}
      />
      <CardContent className="space-y-4">
        <Stat
          label={remaining >= 0 ? 'Ainda pode comer' : 'Passou da meta'}
          value={integer(Math.abs(remaining))}
          unit="kcal"
          tone={remaining >= 0 ? undefined : 'negative'}
          hint={`${integer(totals.kcal)} de ${integer(targetKcal)} kcal`}
        />
        <Progress
          value={totals.kcal}
          max={targetKcal}
          tone={totals.kcal > targetKcal ? 'negative' : 'accent'}
        />

        <div className="space-y-3 pt-1">
          <MacroRow
            label="Proteína"
            value={totals.protein}
            target={plan?.protein_g ?? null}
            tone="accent"
          />
          <MacroRow
            label="Carboidrato"
            value={totals.carb}
            target={plan?.carb_g ?? null}
            tone="warning"
          />
          <MacroRow label="Gordura" value={totals.fat} target={plan?.fat_g ?? null} tone="positive" />
        </div>

        {showTrainingNote && (
          <p className="text-fg-subtle border-t pt-3 text-[11px] leading-relaxed">
            A meta já considera os treinos da semana — não desconte as calorias do treino de novo,
            isso conta duas vezes.
          </p>
        )}
      </CardContent>
    </Card>
  )
}

function MacroRow({
  label,
  value,
  target,
  tone,
}: {
  label: string
  value: number
  target: number | null
  tone: 'accent' | 'positive' | 'warning'
}) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-fg-muted">{label}</span>
        <span className="text-fg font-medium">
          {integer(value)}
          {target ? ` / ${integer(target)} g` : ' g'}
        </span>
      </div>
      {target ? <Progress value={value} max={target} tone={tone} /> : null}
    </div>
  )
}
