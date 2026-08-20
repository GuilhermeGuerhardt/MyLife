import { Activity, Flame, Plus, Ruler, Scale, TrendingDown, TrendingUp } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Field, Input, Textarea } from '@/components/ui/field'
import { Modal } from '@/components/ui/modal'
import { Badge, EmptyState, SectionTitle, Stat } from '@/components/ui/misc'
import { useMeasurements } from '@/data/queries'
import { useHealthSummary } from '@/features/health/use-health-summary'
import { WeightChart } from '@/features/health/weight-chart'
import { decimal, duration, integer, kcal, longDate, shortDate, signed } from '@/lib/format'
import { BMI_LABELS, waistToHipRatio } from '@/lib/health/formulas'
import { today } from '@/lib/utils'

export function HealthOverview() {
  const summary = useHealthSummary()
  const { data: measurements, create, remove } = useMeasurements()
  const [open, setOpen] = useState(false)

  const sorted = [...measurements].sort((a, b) => b.date.localeCompare(a.date))
  const last = sorted[0]
  const goingDown = summary.weightTrend.delta < 0

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-fg text-xl font-semibold">Saúde</h1>
          <p className="text-fg-muted mt-1 text-sm">
            Peso, composição corporal e gasto energético.
          </p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus />
          Pesagem
        </Button>
      </div>

      {!summary.hasProfile && (
        <Card className="border-warning/40 bg-warning/5">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
            <p className="text-fg text-sm">
              Preencha altura e data de nascimento no perfil para liberar TMB, TDEE e o plano.
            </p>
            <Link to="/perfil">
              <Button size="sm" variant="secondary">
                Completar perfil
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent>
            <Stat
              icon={<Scale className="size-3.5" />}
              label="Peso (média 7 dias)"
              value={summary.currentWeight ? decimal(summary.currentWeight, 1) : '—'}
              unit={summary.currentWeight ? 'kg' : undefined}
              hint={
                summary.rawWeight
                  ? `Última pesagem: ${decimal(summary.rawWeight, 1)} kg`
                  : 'Nenhuma pesagem registrada'
              }
            />
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Stat
              icon={
                goingDown ? <TrendingDown className="size-3.5" /> : <TrendingUp className="size-3.5" />
              }
              label="Tendência (30 dias)"
              value={summary.weightTrend.delta ? signed(summary.weightTrend.delta, 1) : '—'}
              unit={summary.weightTrend.delta ? 'kg' : undefined}
              tone={
                summary.weightTrend.delta === 0 ? undefined : goingDown ? 'positive' : 'negative'
              }
              hint="Sobre a média móvel, não sobre a pesagem do dia"
            />
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Stat
              icon={<Ruler className="size-3.5" />}
              label="IMC"
              value={summary.bmi ? decimal(summary.bmi, 1) : '—'}
              hint={
                summary.bmiBand
                  ? `${BMI_LABELS[summary.bmiBand]} · saudável: ${decimal(summary.healthyRange.min, 1)}–${decimal(summary.healthyRange.max, 1)} kg`
                  : undefined
              }
            />
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Stat
              icon={<Flame className="size-3.5" />}
              label="Gasto diário (TDEE)"
              value={summary.tdee ? integer(summary.tdee) : '—'}
              unit={summary.tdee ? 'kcal' : undefined}
              hint={
                summary.bmr
                  ? `TMB ${integer(summary.bmr)} kcal${summary.weekSessions.length ? ' · ajustado pelos treinos da semana' : ''}`
                  : 'Precisa de peso e perfil'
              }
            />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Evolução do peso"
            description="Linha = média móvel de 7 dias. Pontos = pesagens registradas."
          />
          <CardContent>
            {summary.weightSeries.length > 1 ? (
              <WeightChart
                data={summary.weightSeries}
                targetKg={summary.activePlan?.target_weight_kg ?? null}
              />
            ) : (
              <EmptyState
                icon={<Scale className="size-6" />}
                title="Sem histórico ainda"
                description="Registre pelo menos duas pesagens para o gráfico aparecer. O ideal é pesar sempre no mesmo horário, de manhã e em jejum."
                action={
                  <Button size="sm" onClick={() => setOpen(true)}>
                    Registrar pesagem
                  </Button>
                }
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader title="Semana" description="Últimos 7 dias" />
          <CardContent className="space-y-5">
            <Stat
              icon={<Activity className="size-3.5" />}
              label="Treinos"
              value={summary.weekSessions.length}
              hint={summary.weekMinutes ? duration(summary.weekMinutes) + ' no total' : 'Nada ainda'}
            />
            <Stat
              icon={<Flame className="size-3.5" />}
              label="Queimadas em treino"
              value={integer(summary.weekCalories)}
              unit="kcal"
              hint={`Média de ${kcal(Math.round(summary.weekCalories / 7))} por dia`}
            />
            <Link to="/saude/atividades">
              <Button variant="secondary" size="sm" className="w-full">
                Ver atividades
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      <div>
        <SectionTitle
          action={
            last?.waist_cm && last.hip_cm ? (
              <Badge tone={waistToHipRatio(last.waist_cm, last.hip_cm) > 0.9 ? 'warning' : 'positive'}>
                RCQ {decimal(waistToHipRatio(last.waist_cm, last.hip_cm), 2)}
              </Badge>
            ) : undefined
          }
        >
          Histórico de medidas
        </SectionTitle>

        <Card>
          {sorted.length === 0 ? (
            <EmptyState
              title="Nenhuma medida registrada"
              description="Além do peso, medir a cintura toda semana mostra progresso mesmo quando a balança trava."
            />
          ) : (
            <div className="divide-border-base divide-y">
              {sorted.slice(0, 12).map((m) => (
                <div key={m.id} className="flex items-center gap-4 px-5 py-3">
                  <div className="w-24 shrink-0">
                    <p className="text-fg text-sm font-medium">{shortDate(m.date)}</p>
                    <p className="text-fg-subtle text-[11px]">{longDate(m.date).split(' de ')[1]}</p>
                  </div>
                  <div className="flex flex-1 flex-wrap gap-x-5 gap-y-1 text-xs">
                    <span className="text-fg font-medium">{decimal(m.weight_kg, 1)} kg</span>
                    {m.body_fat_pct != null && (
                      <span className="text-fg-muted">{decimal(m.body_fat_pct, 1)}% gordura</span>
                    )}
                    {m.waist_cm != null && (
                      <span className="text-fg-muted">cintura {decimal(m.waist_cm, 0)} cm</span>
                    )}
                    {m.hip_cm != null && (
                      <span className="text-fg-muted">quadril {decimal(m.hip_cm, 0)} cm</span>
                    )}
                    {m.notes && <span className="text-fg-subtle italic">{m.notes}</span>}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => remove.mutate(m.id)}
                    aria-label="Remover medida"
                  >
                    Remover
                  </Button>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <MeasurementModal
        open={open}
        onClose={() => setOpen(false)}
        defaultWeight={summary.rawWeight}
        onSave={async (values) => {
          await create.mutateAsync(values)
          setOpen(false)
        }}
      />
    </div>
  )
}

function MeasurementModal({
  open,
  onClose,
  defaultWeight,
  onSave,
}: {
  open: boolean
  onClose: () => void
  defaultWeight: number | null
  onSave: (values: {
    date: string
    weight_kg: number
    body_fat_pct: number | null
    waist_cm: number | null
    hip_cm: number | null
    arm_cm: number | null
    thigh_cm: number | null
    chest_cm: number | null
    notes: string | null
  }) => Promise<void>
}) {
  const [date, setDate] = useState(today())
  const [weight, setWeight] = useState(defaultWeight ? String(defaultWeight) : '')
  const [fat, setFat] = useState('')
  const [waist, setWaist] = useState('')
  const [hip, setHip] = useState('')
  const [arm, setArm] = useState('')
  const [thigh, setThigh] = useState('')
  const [chest, setChest] = useState('')
  const [notes, setNotes] = useState('')

  const parse = (value: string) => (value ? Number(value.replace(',', '.')) : null)

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Nova pesagem"
      description="Só o peso é obrigatório. As circunferências são opcionais e valem a pena uma vez por semana."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            disabled={!weight}
            onClick={() =>
              void onSave({
                date,
                weight_kg: Number(weight.replace(',', '.')),
                body_fat_pct: parse(fat),
                waist_cm: parse(waist),
                hip_cm: parse(hip),
                arm_cm: parse(arm),
                thigh_cm: parse(thigh),
                chest_cm: parse(chest),
                notes: notes || null,
              })
            }
          >
            Salvar
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Data">
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Peso" suffix="kg">
          <Input
            inputMode="decimal"
            autoFocus
            value={weight}
            placeholder="84,2"
            onChange={(e) => setWeight(e.target.value)}
          />
        </Field>
        <Field label="Gordura corporal" suffix="%">
          <Input inputMode="decimal" value={fat} onChange={(e) => setFat(e.target.value)} />
        </Field>
        <Field label="Cintura" suffix="cm">
          <Input inputMode="decimal" value={waist} onChange={(e) => setWaist(e.target.value)} />
        </Field>
        <Field label="Quadril" suffix="cm">
          <Input inputMode="decimal" value={hip} onChange={(e) => setHip(e.target.value)} />
        </Field>
        <Field label="Peitoral" suffix="cm">
          <Input inputMode="decimal" value={chest} onChange={(e) => setChest(e.target.value)} />
        </Field>
        <Field label="Braço" suffix="cm">
          <Input inputMode="decimal" value={arm} onChange={(e) => setArm(e.target.value)} />
        </Field>
        <Field label="Coxa" suffix="cm">
          <Input inputMode="decimal" value={thigh} onChange={(e) => setThigh(e.target.value)} />
        </Field>
        <Field label="Observações" className="sm:col-span-2">
          <Textarea
            value={notes}
            placeholder="Dormi mal, comi fora, treino pesado ontem..."
            onChange={(e) => setNotes(e.target.value)}
          />
        </Field>
      </div>
    </Modal>
  )
}
