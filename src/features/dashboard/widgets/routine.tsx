/** Widgets de rotina: hábitos, sequência, agenda e insights. */

import { ArrowRight, Flame, Lightbulb } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge, Stat } from '@/components/ui/misc'
import { useHealthSummary } from '@/features/health/use-health-summary'
import { useAgenda } from '@/features/routine/use-agenda'
import { useHabitBoard } from '@/features/routine/use-habit-board'
import { useInsights } from '@/features/routine/use-insights'
import { AREA_ACCENT, SOURCE_LABELS } from '@/lib/calendar/agenda'
import { addDays, today } from '@/lib/dates'
import { currency, relativeDay } from '@/lib/format'
import { dailyStreak } from '@/lib/habits/habits'
import { cn } from '@/lib/utils'

export function HabitsWidget() {
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

export function StreakWidget() {
  const summary = useHealthSummary()
  const streak = dailyStreak(
    summary.sessions.map((s) => s.date),
    today(),
  )

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

export function AgendaWidget() {
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

export function InsightWidget() {
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
