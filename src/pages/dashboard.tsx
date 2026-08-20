import {
  Activity,
  ArrowRight,
  Command,
  Flame,
  Scale,
  Target,
  TrendingDown,
  Utensils,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge, Progress, Stat } from '@/components/ui/misc'
import { useActivityTypes, useProfile } from '@/data/queries'
import { useEducation } from '@/features/education/use-education'
import { useHealthSummary } from '@/features/health/use-health-summary'
import { decimal, integer, longDate, signed } from '@/lib/format'
import { addDays, today } from '@/lib/utils'

export function Dashboard({ onOpenPalette }: { onOpenPalette: () => void }) {
  const summary = useHealthSummary()
  const { profile } = useProfile()
  const { data: activities } = useActivityTypes()

  const plan = summary.activePlan
  const targetKcal = plan?.daily_calories ?? summary.tdee ?? null
  const remaining = targetKcal ? targetKcal - summary.intake.kcal : null

  const enabled = activities.filter((a) => a.enabled && a.weekly_goal)
  const weekDone = enabled.reduce(
    (sum, a) => sum + summary.weekSessions.filter((s) => s.activity_type_id === a.id).length,
    0,
  )
  const weekGoal = enabled.reduce((sum, a) => sum + (a.weekly_goal ?? 0), 0)

  const streak = computeStreak(summary.sessions.map((s) => s.date))
  const greeting = getGreeting()

  // Faculdade e cursos livres lado a lado, só o que está em andamento.
  const academic = useEducation('academic')
  const courses = useEducation('course')
  const studying = [...academic.summaries, ...courses.summaries]
    .filter((item) => item.program.status === 'active')
    .slice(0, 4)
    .map((item) => ({
      id: item.program.id,
      name: item.program.name,
      percent: item.percent,
      href: `${item.program.track === 'academic' ? '/faculdade' : '/cursos'}/${item.program.id}`,
      detail:
        item.program.track === 'academic'
          ? `${integer(item.progress.hoursDone)} de ${integer(item.progress.hoursTotal)} h · faltam ${item.progress.remaining.length} disciplinas`
          : `${item.lessonsDone} de ${item.lessons.length} aulas concluídas`,
    }))

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-fg text-xl font-semibold">
            {greeting}
            {profile?.name ? `, ${profile.name.split(' ')[0]}` : ''}
          </h1>
          <p className="text-fg-muted mt-1 text-sm first-letter:uppercase">{longDate(today())}</p>
        </div>
        <Button variant="secondary" onClick={onOpenPalette}>
          <Command />
          Registrar rápido
        </Button>
      </div>

      {/* Bento: os números do dia primeiro, contexto depois. */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="accent-health">
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

        <Card className="accent-health">
          <CardContent>
            <Stat
              icon={<Utensils className="size-3.5" />}
              label="Calorias restantes"
              value={remaining !== null ? integer(Math.max(remaining, 0)) : '—'}
              unit={remaining !== null ? 'kcal' : undefined}
              tone={remaining !== null && remaining < 0 ? 'negative' : undefined}
              hint={
                targetKcal
                  ? `${integer(summary.intake.kcal)} de ${integer(targetKcal)} kcal hoje`
                  : 'Defina um plano ou registre o peso'
              }
            />
          </CardContent>
        </Card>

        <Card className="accent-health">
          <CardContent>
            <Stat
              icon={<Activity className="size-3.5" />}
              label="Treinos na semana"
              value={summary.weekSessions.length}
              hint={weekGoal ? `Meta: ${weekGoal} sessões` : 'Sem metas definidas'}
            />
            {weekGoal > 0 && <Progress className="mt-3" value={weekDone} max={weekGoal} />}
          </CardContent>
        </Card>

        <Card className="accent-health">
          <CardContent>
            <Stat
              icon={<Flame className="size-3.5" />}
              label="Sequência"
              value={streak}
              unit={streak === 1 ? 'dia' : 'dias'}
              hint={streak > 0 ? 'Dias seguidos com treino' : 'Registre um treino para começar'}
            />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="accent-health lg:col-span-2">
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
                    <span className="text-fg font-medium">
                      {integer(progressPct(plan.start_weight_kg, plan.target_weight_kg, summary.currentWeight))}
                      %
                    </span>
                  </div>
                  <Progress
                    value={progressPct(plan.start_weight_kg, plan.target_weight_kg, summary.currentWeight)}
                  />
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

        <Card>
          <CardHeader
            title="Estudos"
            description={
              studying.length
                ? `${studying.length} em andamento`
                : 'Nada em andamento'
            }
            action={
              <Link to="/faculdade">
                <Button variant="ghost" size="sm">
                  <ArrowRight />
                </Button>
              </Link>
            }
          />
          <CardContent className="space-y-4">
            {studying.length === 0 ? (
              <div className="space-y-3">
                <p className="text-fg-muted text-sm">
                  Cadastre sua faculdade ou um curso para acompanhar progresso, notas e faltas.
                </p>
                <div className="flex gap-2">
                  <Link to="/faculdade">
                    <Button size="sm" variant="secondary">
                      Faculdade
                    </Button>
                  </Link>
                  <Link to="/cursos">
                    <Button size="sm" variant="secondary">
                      Cursos
                    </Button>
                  </Link>
                </div>
              </div>
            ) : (
              studying.map((item) => (
                <Link key={item.id} to={item.href} className="block space-y-1.5">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-fg truncate text-sm font-medium">{item.name}</span>
                    <span className="text-fg-muted shrink-0 text-xs">
                      {integer(item.percent)}%
                    </span>
                  </div>
                  <Progress value={item.percent} />
                  <p className="text-fg-subtle text-[11px]">{item.detail}</p>
                </Link>
              ))
            )}

            <div className="border-border-base border-t pt-3">
              <ModuleRow
                to="/financeiro"
                label="Financeiro"
                detail="Gastos, orçamento, fatura de cartão e metas"
                phase="Fase 2"
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function ModuleRow({
  to,
  label,
  detail,
  phase,
}: {
  to: string
  label: string
  detail: string
  phase: string
}) {
  return (
    <Link
      to={to}
      className="hover:bg-surface-2 -mx-2 flex items-start gap-3 rounded-lg px-2 py-2 transition-colors"
    >
      <div className="min-w-0 flex-1">
        <p className="text-fg text-sm font-medium">{label}</p>
        <p className="text-fg-subtle text-[11px]">{detail}</p>
      </div>
      <Badge>{phase}</Badge>
    </Link>
  )
}

function progressPct(start: number, target: number, current: number): number {
  const total = start - target
  if (total <= 0) return 100
  return Math.min(Math.max(((start - current) / total) * 100, 0), 100)
}

/** Dias consecutivos, contando a partir de hoje ou de ontem. */
function computeStreak(dates: string[]): number {
  const unique = new Set(dates)
  let cursor = unique.has(today()) ? today() : addDays(today(), -1)
  if (!unique.has(cursor)) return 0
  let streak = 0
  while (unique.has(cursor)) {
    streak++
    cursor = addDays(cursor, -1)
  }
  return streak
}

function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 6) return 'Boa madrugada'
  if (hour < 12) return 'Bom dia'
  if (hour < 18) return 'Boa tarde'
  return 'Boa noite'
}
