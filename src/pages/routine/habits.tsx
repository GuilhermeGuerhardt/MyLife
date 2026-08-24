import { Flame, Pencil, Plus, Sparkles, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge, EmptyState, Progress, Stat } from '@/components/ui/misc'
import { LIFE_AREA_LABELS, type Habit } from '@/data/types'
import { HabitForm, type HabitDraft } from '@/features/routine/habit-form'
import { Heatmap, HeatmapLegend } from '@/features/routine/heatmap'
import { useHabitBoard, type HabitBoardItem } from '@/features/routine/use-habit-board'
import { addDays, today, weekdayOf } from '@/lib/dates'
import { confirmar } from '@/lib/avisos'
import { integer } from '@/lib/format'
import { cn } from '@/lib/utils'

const WEEKDAY_INITIALS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']

export function HabitsPage() {
  const board = useHabitBoard()
  // `undefined` = fechado, `null` = criando, objeto = editando.
  const [editing, setEditing] = useState<Habit | null | undefined>(undefined)

  const save = async (draft: HabitDraft) => {
    if (editing) await board.update.mutateAsync({ id: editing.id, patch: draft })
    else await board.create.mutateAsync(draft)
    setEditing(undefined)
  }

  /**
   * Exclusão definitiva: o hábito e todos os dias marcados.
   *
   * A confirmação diz quantos dias vão embora — é o que separa apagar um hábito
   * criado ontem de apagar um com meio ano de sequência.
   */
  async function excluir(habit: Habit) {
    const dias = board.logCount(habit.id)
    const historico =
      dias > 0
        ? ` Isto apaga também ${dias} dia${dias === 1 ? '' : 's'} marcado${dias === 1 ? '' : 's'}.`
        : ''

    const ok = await confirmar(
      `Excluir "${habit.name}" de vez?${historico}

` +
        'Não tem desfazer. Para tirar da conta do dia sem perder o histórico, use Arquivar.',
      { confirmar: 'Excluir', tom: 'error' },
    )
    if (!ok) return

    await board.removeHabit(habit.id)
    setEditing(undefined)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-fg text-xl font-semibold">Hábitos</h1>
          <p className="text-fg-muted mt-1 max-w-2xl text-sm">
            O que se repete é o que muda o resultado. Marque o dia com um toque — o dia de hoje
            nunca quebra a sequência, e hábito semanal se mede por semana, não por uma terça-feira
            perdida.
          </p>
        </div>
        <Button onClick={() => setEditing(null)}>
          <Plus />
          Novo hábito
        </Button>
      </div>

      {board.items.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardContent>
              <Stat
                icon={<Sparkles className="size-3.5" />}
                label="Hoje"
                value={`${board.doneToday}/${board.items.length}`}
                hint={
                  board.doneToday === board.items.length
                    ? 'Dia completo'
                    : `Faltam ${board.items.length - board.doneToday}`
                }
                tone={board.doneToday === board.items.length ? 'positive' : undefined}
              />
              <Progress className="mt-3" value={board.todayPercent} />
            </CardContent>
          </Card>
          <Card>
            <CardContent>
              <Stat
                icon={<Flame className="size-3.5" />}
                label="Maior sequência ativa"
                value={board.bestStreak}
                hint="Entre todos os hábitos"
              />
            </CardContent>
          </Card>
          <Card>
            <CardContent>
              <Stat
                label="Hábitos ativos"
                value={board.items.length}
                hint={board.archived.length ? `${board.archived.length} arquivados` : 'Nenhum arquivado'}
              />
            </CardContent>
          </Card>
        </div>
      )}

      {board.items.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Sparkles className="size-6" />}
            title="Nenhum hábito ainda"
            description="Comece com dois ou três. Uma lista de dez hábitos novos é uma lista abandonada em duas semanas."
            action={<Button onClick={() => setEditing(null)}>Criar o primeiro</Button>}
          />
        </Card>
      ) : (
        <div className="space-y-4">
          {board.items.map((item) => (
            <HabitCard
              key={item.habit.id}
              item={item}
              isDone={board.isDone}
              onToggle={board.toggle}
              onEdit={() => setEditing(item.habit)}
            />
          ))}
          <HeatmapLegend />
        </div>
      )}

      {board.archived.length > 0 && (
        <Card>
          <CardHeader title="Arquivados" description="Fora da conta do dia, com o histórico intacto." />
          <CardContent className="flex flex-wrap gap-2">
            {board.archived.map((habit) => (
              <div
                key={habit.id}
                className="bg-surface-2 border-border-base flex items-center gap-1 rounded-lg border pr-1"
              >
                <button
                  type="button"
                  onClick={() => board.update.mutate({ id: habit.id, patch: { archived: false } })}
                  className="text-fg hover:text-accent px-3 py-1.5 text-xs font-medium transition-colors"
                >
                  {habit.icon} {habit.name} · reativar
                </button>
                <button
                  type="button"
                  onClick={() => void excluir(habit)}
                  aria-label={`Excluir ${habit.name} definitivamente`}
                  className="text-fg-subtle hover:text-negative p-1.5 transition-colors"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {editing !== undefined && (
        <HabitForm
          open
          // `key` força o formulário a remontar com os valores do hábito clicado.
          key={editing?.id ?? 'new'}
          habit={editing}
          position={board.items.length}
          onClose={() => setEditing(undefined)}
          onSave={save}
          onArchive={
            editing
              ? () => {
                  board.update.mutate({ id: editing.id, patch: { archived: true } })
                  setEditing(undefined)
                }
              : undefined
          }
          onDelete={editing ? () => void excluir(editing) : undefined}
        />
      )}
    </div>
  )
}

function HabitCard({
  item,
  isDone,
  onToggle,
  onEdit,
}: {
  item: HabitBoardItem
  isDone: (habitId: string, date: string) => boolean
  onToggle: (habitId: string, date: string) => void
  onEdit: () => void
}) {
  const { habit, status } = item
  const week = Array.from({ length: 7 }, (_, index) => addDays(today(), index - 6))

  return (
    <Card>
      <CardHeader
        title={
          <span className="flex items-center gap-2">
            <span className="text-base">{habit.icon}</span>
            {habit.name}
          </span>
        }
        description={
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span>{LIFE_AREA_LABELS[habit.area]}</span>
            <span aria-hidden>·</span>
            <span>
              {habit.cadence === 'daily'
                ? 'Todo dia'
                : `${habit.target_per_week}× por semana`}
            </span>
            {status.streak > 0 && (
              <Badge tone="accent">
                <Flame className="size-3" />
                {status.streak} {status.streakUnit}
                {status.streak > 1 ? 's' : ''}
              </Badge>
            )}
            {status.lost ? (
              <Badge tone="negative">Meta da semana não fecha mais</Badge>
            ) : status.atRisk ? (
              <Badge tone="warning">
                Faltam {status.missing} em {status.daysLeft} dia
                {status.daysLeft > 1 ? 's' : ''}
              </Badge>
            ) : null}
          </span>
        }
        action={
          <Button variant="ghost" size="icon" aria-label={`Editar ${habit.name}`} onClick={onEdit}>
            <Pencil />
          </Button>
        }
      />
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <div className="min-w-40 flex-1">
            <div className="text-fg-muted mb-1.5 flex justify-between text-xs">
              <span>
                {status.weekCount} de {status.weekTarget} nesta semana
              </span>
              <span className="text-fg font-medium">{integer(status.weekPercent)}%</span>
            </div>
            <Progress
              value={status.weekPercent}
              tone={status.weekPercent >= 100 ? 'positive' : status.lost ? 'negative' : 'accent'}
            />
          </div>

          <div className="flex gap-1">
            {week.map((date) => {
              const done = isDone(habit.id, date)
              const isToday = date === today()
              return (
                <button
                  key={date}
                  type="button"
                  aria-pressed={done}
                  aria-label={`${habit.name} em ${date}`}
                  onClick={() => onToggle(habit.id, date)}
                  className={cn(
                    'flex size-9 flex-col items-center justify-center rounded-lg border text-[10px] leading-tight font-medium transition-colors',
                    done
                      ? 'bg-accent text-accent-fg border-transparent'
                      : 'border-border-base text-fg-muted hover:border-border-strong',
                    isToday && !done && 'border-accent',
                  )}
                >
                  <span>{WEEKDAY_INITIALS[weekdayOf(date)]}</span>
                  <span className="text-[11px]">{Number(date.slice(8, 10))}</span>
                </button>
              )
            })}
          </div>
        </div>

        <div>
          <Heatmap weeks={item.weeks} onSelect={(date) => onToggle(habit.id, date)} />
          <p className="text-fg-subtle mt-1 text-[11px]">
            {status.total} registro{status.total === 1 ? '' : 's'} no total · recorde de{' '}
            {status.best} {status.streakUnit}
            {status.best === 1 ? '' : 's'} · clique numa célula para corrigir o passado
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
