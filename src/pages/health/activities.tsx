import { Plus, Search, Timer } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Field, Input, Select, Textarea } from '@/components/ui/field'
import { Badge, EmptyState, Progress, SectionTitle, Toggle } from '@/components/ui/misc'
import { Modal } from '@/components/ui/modal'
import { useActivityTypes, useSessions } from '@/data/queries'
import type { ActivityType } from '@/data/types'
import { useHealthSummary } from '@/features/health/use-health-summary'
import { duration, integer, shortDate } from '@/lib/format'
import { sessionCalories } from '@/lib/health/formulas'
import { addDays, today } from '@/lib/utils'

export function ActivitiesPage() {
  const { data: activities, update, create: createActivity } = useActivityTypes()
  const { data: sessions, create: createSession, remove } = useSessions()
  const { currentWeight, weekSessions } = useHealthSummary()

  const [search, setSearch] = useState('')
  const [logging, setLogging] = useState<ActivityType | null>(null)
  const [creatingCustom, setCreatingCustom] = useState(false)

  const enabled = activities.filter((a) => a.enabled)
  const available = useMemo(() => {
    const term = search.toLowerCase()
    return activities
      .filter((a) => !a.enabled && a.name.toLowerCase().includes(term))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [activities, search])

  const weekStart = addDays(today(), -6)
  const countThisWeek = (activityId: string) =>
    weekSessions.filter((s) => s.activity_type_id === activityId).length

  const recent = [...sessions].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 15)
  const nameOf = (id: string) => activities.find((a) => a.id === id)?.name ?? 'Atividade'
  const iconOf = (id: string) => activities.find((a) => a.id === id)?.icon ?? '•'

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-fg text-xl font-semibold">Atividades</h1>
          <p className="text-fg-muted mt-1 text-sm">
            Escolha o que você pratica e registre as sessões. As calorias saem do valor MET de cada
            atividade multiplicado pelo seu peso.
          </p>
        </div>
        <Button variant="secondary" onClick={() => setCreatingCustom(true)}>
          <Plus />
          Personalizada
        </Button>
      </div>

      <div>
        <SectionTitle>Minhas atividades</SectionTitle>
        {enabled.length === 0 ? (
          <Card>
            <EmptyState
              title="Nenhuma atividade ativa"
              description="Ative abaixo o que você pratica. Só as ativas entram no registro rápido e nas metas semanais."
            />
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {enabled.map((activity) => {
              const done = countThisWeek(activity.id)
              const goal = activity.weekly_goal ?? 0
              return (
                <Card key={activity.id}>
                  <CardContent className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <span className="text-xl">{activity.icon}</span>
                        <div>
                          <p className="text-fg text-sm font-medium">{activity.name}</p>
                          <p className="text-fg-subtle text-[11px]">
                            {activity.met} MET
                            {currentWeight
                              ? ` · ~${integer(sessionCalories(activity.met, currentWeight, 60))} kcal/h`
                              : ''}
                          </p>
                        </div>
                      </div>
                      <Toggle
                        checked={activity.enabled}
                        label={`Desativar ${activity.name}`}
                        onChange={(checked) =>
                          update.mutate({ id: activity.id, patch: { enabled: checked } })
                        }
                      />
                    </div>

                    {goal > 0 && (
                      <div className="space-y-1.5">
                        <div className="text-fg-muted flex justify-between text-[11px]">
                          <span>Meta da semana</span>
                          <span className={done >= goal ? 'text-positive font-medium' : ''}>
                            {done}/{goal}
                          </span>
                        </div>
                        <Progress
                          value={done}
                          max={goal}
                          tone={done >= goal ? 'positive' : 'accent'}
                        />
                      </div>
                    )}

                    <div className="flex gap-2">
                      <Button size="sm" className="flex-1" onClick={() => setLogging(activity)}>
                        <Timer />
                        Registrar
                      </Button>
                      <Select
                        aria-label="Meta semanal"
                        className="w-24"
                        value={activity.weekly_goal ?? 0}
                        onChange={(e) =>
                          update.mutate({
                            id: activity.id,
                            patch: { weekly_goal: Number(e.target.value) || null },
                          })
                        }
                      >
                        <option value={0}>Sem meta</option>
                        {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                          <option key={n} value={n}>
                            {n}×/sem
                          </option>
                        ))}
                      </Select>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>

      <div>
        <SectionTitle>Catálogo</SectionTitle>
        <Card>
          <CardContent className="space-y-3">
            <Field>
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar atividade..."
                className="pl-9"
              />
              <Search className="text-fg-subtle pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
            </Field>

            <div className="flex flex-wrap gap-2">
              {available.map((activity) => (
                <button
                  key={activity.id}
                  type="button"
                  onClick={() => update.mutate({ id: activity.id, patch: { enabled: true } })}
                  className="border-border-base bg-surface-2 text-fg-muted hover:border-accent hover:text-fg flex items-center gap-2 rounded-lg border px-3 py-2 text-xs transition-colors"
                >
                  <span>{activity.icon}</span>
                  {activity.name}
                  <Plus className="size-3" />
                </button>
              ))}
              {available.length === 0 && (
                <p className="text-fg-subtle py-2 text-xs">Nada encontrado para "{search}".</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div>
        <SectionTitle>Sessões recentes</SectionTitle>
        <Card>
          {recent.length === 0 ? (
            <EmptyState
              title="Nenhum treino registrado"
              description='Use o registro rápido (Ctrl+K) e escreva algo como "corri 5km em 28min".'
            />
          ) : (
            <div className="divide-border-base divide-y">
              {recent.map((session) => (
                <div key={session.id} className="flex items-center gap-3 px-5 py-3">
                  <span className="text-lg">{iconOf(session.activity_type_id)}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-fg truncate text-sm font-medium">
                      {nameOf(session.activity_type_id)}
                    </p>
                    <p className="text-fg-subtle text-[11px]">
                      {shortDate(session.date)} · {duration(session.duration_min)}
                      {session.distance_km ? ` · ${session.distance_km} km` : ''}
                      {session.rpe ? ` · RPE ${session.rpe}` : ''}
                    </p>
                  </div>
                  <Badge tone={session.date >= weekStart ? 'accent' : 'neutral'}>
                    {integer(session.calories_estimated)} kcal
                  </Badge>
                  <Button variant="ghost" size="sm" onClick={() => remove.mutate(session.id)}>
                    Remover
                  </Button>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {logging && (
        <SessionModal
          activity={logging}
          weightKg={currentWeight ?? 75}
          onClose={() => setLogging(null)}
          onSave={async (values) => {
            await createSession.mutateAsync(values)
            setLogging(null)
          }}
        />
      )}

      <CustomActivityModal
        open={creatingCustom}
        onClose={() => setCreatingCustom(false)}
        onSave={async (values) => {
          await createActivity.mutateAsync(values)
          setCreatingCustom(false)
        }}
      />
    </div>
  )
}

function SessionModal({
  activity,
  weightKg,
  onClose,
  onSave,
}: {
  activity: ActivityType
  weightKg: number
  onClose: () => void
  onSave: (values: {
    activity_type_id: string
    date: string
    duration_min: number
    rpe: number | null
    calories_estimated: number
    distance_km: number | null
    notes: string | null
  }) => Promise<void>
}) {
  const [date, setDate] = useState(today())
  const [minutes, setMinutes] = useState('60')
  const [rpe, setRpe] = useState('')
  const [distance, setDistance] = useState('')
  const [notes, setNotes] = useState('')

  const calories = sessionCalories(activity.met, weightKg, Number(minutes) || 0)

  return (
    <Modal
      open
      onClose={onClose}
      title={`${activity.icon} ${activity.name}`}
      description={`Estimativa com ${activity.met} MET e ${weightKg.toFixed(1).replace('.', ',')} kg de peso.`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            disabled={!minutes}
            onClick={() =>
              void onSave({
                activity_type_id: activity.id,
                date,
                duration_min: Number(minutes),
                rpe: rpe ? Number(rpe) : null,
                calories_estimated: calories,
                distance_km: distance ? Number(distance.replace(',', '.')) : null,
                notes: notes || null,
              })
            }
          >
            Registrar · {integer(calories)} kcal
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Data">
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Duração" suffix="min">
          <Input
            inputMode="numeric"
            autoFocus
            value={minutes}
            onChange={(e) => setMinutes(e.target.value)}
          />
        </Field>
        {activity.tracks_distance && (
          <Field label="Distância" suffix="km">
            <Input
              inputMode="decimal"
              value={distance}
              onChange={(e) => setDistance(e.target.value)}
            />
          </Field>
        )}
        <Field label="Esforço percebido" hint="1 = muito leve, 10 = máximo">
          <Select value={rpe} onChange={(e) => setRpe(e.target.value)}>
            <option value="">Não informar</option>
            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                RPE {n}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Notas" className="sm:col-span-2">
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
      </div>
    </Modal>
  )
}

function CustomActivityModal({
  open,
  onClose,
  onSave,
}: {
  open: boolean
  onClose: () => void
  onSave: (values: Omit<ActivityType, 'id' | 'created_at' | 'updated_at' | 'user_id'>) => Promise<void>
}) {
  const [name, setName] = useState('')
  const [met, setMet] = useState('6')
  const [icon, setIcon] = useState('⭐')
  const [distance, setDistance] = useState(false)

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Atividade personalizada"
      description="O MET indica quantas vezes o gasto em repouso a atividade consome. Caminhada ≈ 4, corrida ≈ 10."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            disabled={!name}
            onClick={() =>
              void onSave({
                name,
                met: Number(met.replace(',', '.')) || 5,
                category: 'other',
                icon,
                tracks_distance: distance,
                is_custom: true,
                enabled: true,
                weekly_goal: null,
              })
            }
          >
            Criar
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nome" className="sm:col-span-2">
          <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Ícone">
          <Input value={icon} maxLength={2} onChange={(e) => setIcon(e.target.value)} />
        </Field>
        <Field label="MET">
          <Input inputMode="decimal" value={met} onChange={(e) => setMet(e.target.value)} />
        </Field>
        <label className="flex items-center gap-2.5 sm:col-span-2">
          <Toggle checked={distance} onChange={setDistance} label="Registrar distância" />
          <span className="text-fg-muted text-xs">Registrar distância nas sessões</span>
        </label>
      </div>
    </Modal>
  )
}
