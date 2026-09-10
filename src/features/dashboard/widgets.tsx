/**
 * Catálogo de widgets do dashboard.
 *
 * Cada widget é uma peça independente: sabe buscar o próprio dado e desenhar o
 * próprio cartão. O dashboard só decide quais aparecem e em que ordem — é o
 * que permite ligar, desligar e reordenar sem uma linha de condicional na tela.
 *
 * As consultas repetidas entre widgets não custam nada: o TanStack Query
 * deduplica por chave, então dez widgets pedindo `transactions` fazem uma
 * leitura só.
 */

import {
  Activity,
  ArrowRight,
  Flame,
  Lightbulb,
  PlayCircle,
  Scale,
  Target,
  TrendingDown,
  Utensils,
  Wallet,
} from 'lucide-react'
import type { ComponentType } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge, Progress, Stat } from '@/components/ui/misc'
import { useActivityTypes } from '@/data/queries'
import { useEducation } from '@/features/education/use-education'
import { useFinance } from '@/features/finance/use-finance'
import { useHealthSummary } from '@/features/health/use-health-summary'
import { useAgenda } from '@/features/routine/use-agenda'
import { useHabitBoard } from '@/features/routine/use-habit-board'
import { useInsights } from '@/features/routine/use-insights'
import { AREA_ACCENT, SOURCE_LABELS } from '@/lib/calendar/agenda'
import { addDays, today } from '@/lib/dates'
import { currency, decimal, integer, longDate, relativeDay, signed } from '@/lib/format'
import { cn } from '@/lib/utils'

export interface WidgetDef {
  id: string
  title: string
  /** Explicação curta, mostrada na tela de personalização. */
  description: string
  /** Colunas ocupadas na grade de 4. */
  span: 1 | 2
  accent: string
  defaultVisible: boolean
  Component: ComponentType
}

// ---------------------------------------------------------------------------
// Saúde
// ---------------------------------------------------------------------------

function WeightWidget() {
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

function CaloriesWidget() {
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

function WorkoutsWidget() {
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

function DietPlanWidget() {
  const summary = useHealthSummary()
  const plan = summary.activePlan

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
                <span className="text-fg font-medium">
                  {integer(planPercent(plan.start_weight_kg, plan.target_weight_kg, summary.currentWeight))}%
                </span>
              </div>
              <Progress
                value={planPercent(plan.start_weight_kg, plan.target_weight_kg, summary.currentWeight)}
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
  )
}

function planPercent(start: number, target: number, current: number): number {
  const total = start - target
  if (total <= 0) return 100
  return Math.min(Math.max(((start - current) / total) * 100, 0), 100)
}

// ---------------------------------------------------------------------------
// Rotina
// ---------------------------------------------------------------------------

function HabitsWidget() {
  const board = useHabitBoard(7)
  const day = today()

  return (
    <Card className="accent-routine h-full">
      <CardHeader
        title="Hábitos de hoje"
        description={
          board.items.length
            ? `${board.doneToday} de ${board.items.length} cumpridos`
            : 'Nenhum hábito cadastrado'
        }
        action={
          <Link to="/rotina">
            <Button variant="ghost" size="sm">
              <ArrowRight />
            </Button>
          </Link>
        }
      />
      <CardContent className="space-y-2">
        {board.items.length === 0 ? (
          <div className="flex flex-col items-start gap-3">
            <p className="text-fg-muted text-sm">
              Dois ou três hábitos bem escolhidos mudam mais que uma lista de dez.
            </p>
            <Link to="/rotina">
              <Button size="sm">Criar hábito</Button>
            </Link>
          </div>
        ) : (
          board.items.slice(0, 6).map((item) => (
            <button
              key={item.habit.id}
              type="button"
              onClick={() => void board.toggle(item.habit.id, day)}
              aria-pressed={item.status.doneToday}
              className="hover:bg-surface-2 -mx-2 flex w-[calc(100%+1rem)] items-center gap-2.5 rounded-lg px-2 py-1.5 text-left"
            >
              <span
                className={cn(
                  'flex size-5 shrink-0 items-center justify-center rounded-md border text-[10px]',
                  item.status.doneToday
                    ? 'bg-accent text-accent-fg border-transparent'
                    : 'border-border-strong',
                )}
              >
                {item.status.doneToday ? '✓' : ''}
              </span>
              <span className="text-sm">{item.habit.icon}</span>
              <span
                className={cn(
                  'text-fg min-w-0 flex-1 truncate text-sm',
                  item.status.doneToday && 'opacity-60',
                )}
              >
                {item.habit.name}
              </span>
              {item.status.streak > 0 && (
                <span className="text-fg-subtle shrink-0 text-[11px]">
                  {item.status.streak} {item.status.streakUnit}
                  {item.status.streak > 1 ? 's' : ''}
                </span>
              )}
            </button>
          ))
        )}
      </CardContent>
    </Card>
  )
}

function StreakWidget() {
  const summary = useHealthSummary()
  const streak = computeStreak(summary.sessions.map((s) => s.date))

  return (
    <Card className="accent-routine h-full">
      <CardContent>
        <Stat
          icon={<Flame className="size-3.5" />}
          label="Sequência de treino"
          value={streak}
          unit={streak === 1 ? 'dia' : 'dias'}
          hint={streak > 0 ? 'Dias seguidos com treino' : 'Registre um treino para começar'}
        />
      </CardContent>
    </Card>
  )
}

function AgendaWidget() {
  const from = today()
  const { events } = useAgenda(from, addDays(from, 14))
  const next = events.filter((event) => !event.done && event.source !== 'workout').slice(0, 5)

  return (
    <Card className="accent-routine h-full">
      <CardHeader
        title="Próximos compromissos"
        description="Duas semanas à frente"
        action={
          <Link to="/rotina/agenda">
            <Button variant="ghost" size="sm">
              <ArrowRight />
            </Button>
          </Link>
        }
      />
      <CardContent className="space-y-1">
        {next.length === 0 ? (
          <p className="text-fg-muted text-sm">
            Nada marcado. Provas, entregas e vencimentos aparecem aqui automaticamente.
          </p>
        ) : (
          next.map((event) => {
            const hoje = event.date === from

            return (
              /*
                A classe da área redefine `--accent` na linha inteira, então o
                ponto e a etiqueta saem na mesma cor que aquele compromisso tem
                no calendário. É o que permite reconhecer "isto é da faculdade"
                sem ler o rótulo — e é a mesma legenda das duas telas.
              */
              <div
                key={event.id}
                className={cn(
                  'flex items-center gap-2.5 rounded-lg px-2 py-1.5 -mx-2',
                  AREA_ACCENT[event.area],
                  // Um fundo tênue separa o que é para hoje do resto da lista.
                  hoje && 'bg-accent-soft/50',
                )}
              >
                <span className="bg-accent size-1.5 shrink-0 rounded-full" />
                <span
                  className={cn(
                    'w-16 shrink-0 text-[11px]',
                    hoje ? 'text-accent font-semibold' : 'text-fg-subtle',
                  )}
                >
                  {relativeDay(event.date)}
                </span>
                <span className="text-fg min-w-0 flex-1 truncate text-sm">{event.title}</span>
                {/*
                  Tendo valor, ele vale mais que a origem: cinco linhas marcadas
                  "Conta" não informam nada, e o que se quer saber de relance é
                  quanto vai sair. Sem valor — prova, entrega, meta já atingida —
                  o rótulo continua sendo a única pista do que é aquilo.
                */}
                {event.amountCents ? (
                  <span className="text-fg shrink-0 text-xs font-medium tabular-nums">
                    {currency(event.amountCents / 100)}
                  </span>
                ) : (
                  <Badge tone="accent">{SOURCE_LABELS[event.source]}</Badge>
                )}
              </div>
            )
          })
        )}
      </CardContent>
    </Card>
  )
}

function InsightWidget() {
  const { insights } = useInsights()
  const top = insights[0] ?? null

  return (
    <Card className="accent-routine h-full">
      <CardHeader
        title="Padrão da vez"
        description={top ? `Evidência ${top.strength}, ${top.sample} semanas` : 'Sem amostra ainda'}
        action={
          <Link to="/rotina/insights">
            <Button variant="ghost" size="sm">
              <ArrowRight />
            </Button>
          </Link>
        }
      />
      <CardContent>
        {top ? (
          <div className="flex gap-3">
            <Lightbulb className="text-accent mt-0.5 size-4 shrink-0" />
            <p className="text-fg text-sm leading-relaxed">{top.text}</p>
          </div>
        ) : (
          <p className="text-fg-muted text-sm">
            Os cruzamentos entre saúde, estudo e dinheiro precisam de algumas semanas de histórico
            antes de dizer qualquer coisa.
          </p>
        )}
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Estudos
// ---------------------------------------------------------------------------

function StudiesWidget() {
  const academic = useEducation('academic')
  const courses = useEducation('course')

  const studying = [...academic.summaries, ...courses.summaries]
    .filter((item) => item.program.status === 'active')
    .slice(0, 4)

  return (
    <Card className="accent-education h-full">
      <CardHeader
        title="Estudos"
        description={studying.length ? `${studying.length} em andamento` : 'Nada em andamento'}
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
            <Link
              key={item.program.id}
              to={`${item.program.track === 'academic' ? '/faculdade' : '/cursos'}/${item.program.id}`}
              className="block space-y-1.5"
            >
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-fg truncate text-sm font-medium">{item.program.name}</span>
                <span className="text-fg-muted shrink-0 text-xs">{integer(item.percent)}%</span>
              </div>
              <Progress value={item.percent} />
              <p className="text-fg-subtle text-[11px]">
                {item.program.track === 'academic'
                  ? `${integer(item.progress.hoursDone)} de ${integer(item.progress.hoursTotal)} h · faltam ${item.progress.remaining.length} disciplinas`
                  : `${item.lessonsDone} de ${item.lessons.length} aulas concluídas`}
              </p>
            </Link>
          ))
        )}
      </CardContent>
    </Card>
  )
}

function NextLessonWidget() {
  const courses = useEducation('course')

  // A próxima aula é a primeira não concluída do curso mais avançado em
  // andamento — quem está no meio de um curso volta para ele, não para o
  // primeiro da lista alfabética.
  const candidates = courses.summaries
    .filter((item) => item.program.status === 'active' && item.lessons.length > 0)
    .sort((a, b) => b.percent - a.percent)

  for (const item of candidates) {
    const next = [...item.lessons].sort((a, b) => a.position - b.position).find((l) => !l.done)
    if (!next) continue

    return (
      <Card className="accent-courses h-full">
        <CardHeader title="Próxima aula" description={item.program.name} />
        <CardContent className="space-y-3">
          <div className="flex items-start gap-2.5">
            <PlayCircle className="text-accent mt-0.5 size-4 shrink-0" />
            <div className="min-w-0">
              <p className="text-fg truncate text-sm font-medium">{next.title}</p>
              <p className="text-fg-subtle text-[11px]">
                {next.module} · {next.duration_min} min
              </p>
            </div>
          </div>
          <Progress value={item.percent} />
          <Link to={`/cursos/${item.program.id}`}>
            <Button size="sm" variant="secondary">
              Continuar
            </Button>
          </Link>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="accent-courses h-full">
      <CardHeader title="Próxima aula" description="Nenhum curso em andamento" />
      <CardContent>
        <p className="text-fg-muted text-sm">
          Cadastre as aulas de um curso e o app aponta sempre a próxima.
        </p>
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Financeiro
// ---------------------------------------------------------------------------

function FinanceWidget() {
  const finance = useFinance()
  const overBudget = finance.budgets.filter((item) => item.progress.status !== 'ok')

  return (
    <Card className="accent-finance h-full">
      <CardHeader
        title="Mês no financeiro"
        description={`Saldo de ${currency(finance.totalBalance / 100)}`}
        action={
          <Link to="/financeiro">
            <Button variant="ghost" size="sm">
              <ArrowRight />
            </Button>
          </Link>
        }
      />
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
          <Stat
            label="Entrou"
            value={currency(finance.flow.income / 100)}
            tone={finance.flow.income > 0 ? 'positive' : undefined}
          />
          <Stat
            label="Saiu"
            value={currency(finance.flow.expense / 100)}
            tone={finance.flow.expense > 0 ? 'negative' : undefined}
            icon={<Wallet className="size-3.5" />}
          />
          <Stat label="Sobrou" value={`${decimal(finance.flow.savingsRate, 1)}%`} />
        </div>

        {overBudget.length > 0 && (
          <div className="space-y-2 border-t pt-3">
            {overBudget.slice(0, 3).map((item) => (
              <div key={item.budget.id}>
                <div className="text-fg-muted mb-1 flex justify-between text-[11px]">
                  <span>{item.category?.name ?? 'Sem categoria'}</span>
                  <span>{integer(item.progress.percent)}%</span>
                </div>
                <Progress
                  value={item.progress.percent}
                  tone={item.progress.status === 'exceeded' ? 'negative' : 'warning'}
                />
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Catálogo
// ---------------------------------------------------------------------------

export const WIDGETS: WidgetDef[] = [
  {
    id: 'weight',
    title: 'Peso',
    description: 'Média móvel de 7 dias e a tendência do mês.',
    span: 1,
    accent: 'accent-health',
    defaultVisible: true,
    Component: WeightWidget,
  },
  {
    id: 'calories',
    title: 'Calorias restantes',
    description: 'Quanto ainda cabe hoje, pelo alvo do plano.',
    span: 1,
    accent: 'accent-health',
    defaultVisible: true,
    Component: CaloriesWidget,
  },
  {
    id: 'workouts',
    title: 'Treinos da semana',
    description: 'Sessões registradas contra a meta semanal.',
    span: 1,
    accent: 'accent-health',
    defaultVisible: true,
    Component: WorkoutsWidget,
  },
  {
    id: 'streak',
    title: 'Sequência de treino',
    description: 'Dias seguidos com pelo menos uma sessão.',
    span: 1,
    accent: 'accent-routine',
    defaultVisible: true,
    Component: StreakWidget,
  },
  {
    id: 'habits',
    title: 'Hábitos de hoje',
    description: 'Checklist do dia, marcável direto daqui.',
    span: 2,
    accent: 'accent-routine',
    defaultVisible: true,
    Component: HabitsWidget,
  },
  {
    id: 'agenda',
    title: 'Próximos compromissos',
    description: 'Provas, entregas e vencimentos das próximas duas semanas.',
    span: 2,
    accent: 'accent-routine',
    defaultVisible: true,
    Component: AgendaWidget,
  },
  {
    id: 'diet-plan',
    title: 'Plano de emagrecimento',
    description: 'Alvo diário, ritmo e progresso até a meta.',
    span: 2,
    accent: 'accent-health',
    defaultVisible: true,
    Component: DietPlanWidget,
  },
  {
    id: 'studies',
    title: 'Estudos',
    description: 'Faculdade e cursos em andamento, com progresso.',
    span: 2,
    accent: 'accent-education',
    defaultVisible: true,
    Component: StudiesWidget,
  },
  {
    id: 'finance',
    title: 'Mês no financeiro',
    description: 'Entrou, saiu, taxa de poupança e orçamentos estourando.',
    span: 2,
    accent: 'accent-finance',
    defaultVisible: true,
    Component: FinanceWidget,
  },
  {
    id: 'next-lesson',
    title: 'Próxima aula',
    description: 'De onde continuar no curso em andamento.',
    span: 1,
    accent: 'accent-courses',
    defaultVisible: false,
    Component: NextLessonWidget,
  },
  {
    id: 'insight',
    title: 'Padrão da vez',
    description: 'O cruzamento mais forte entre os módulos.',
    span: 2,
    accent: 'accent-routine',
    defaultVisible: false,
    Component: InsightWidget,
  },
]

/** Dias consecutivos com registro, contando de hoje ou de ontem. */
function computeStreak(dates: string[]): number {
  const unique = new Set(dates)
  let cursor = unique.has(today()) ? today() : addDays(today(), -1)
  let streak = 0
  while (unique.has(cursor)) {
    streak++
    cursor = addDays(cursor, -1)
  }
  return streak
}
