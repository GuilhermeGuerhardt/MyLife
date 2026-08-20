import { CalendarDays, ChevronLeft, ChevronRight, Download, Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge, EmptyState } from '@/components/ui/misc'
import { useDeadlines } from '@/data/queries'
import type { Deadline } from '@/data/types'
import { DeadlineForm, type DeadlineDraft } from '@/features/routine/deadline-form'
import { useAgenda } from '@/features/routine/use-agenda'
import {
  groupByDay,
  monthRange,
  SOURCE_LABELS,
  type AgendaArea,
  type AgendaEvent,
} from '@/lib/calendar/agenda'
import { icsFilename, toIcs } from '@/lib/calendar/ics'
import { monthGrid, today } from '@/lib/dates'
import { CALENDARIO_ICS, salvarArquivo } from '@/lib/salvar-arquivo'
import { competenceLabel, addMonths } from '@/lib/finance/billing'
import { currency, longDate, relativeDay } from '@/lib/format'
import { cn } from '@/lib/utils'

const WEEKDAYS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']

/** A cor sai do próprio módulo: a classe redefine `--accent` no elemento. */
const AREA_ACCENT = {
  health: 'accent-health',
  education: 'accent-education',
  finance: 'accent-finance',
} as const

const AREAS: { key: AgendaArea; label: string }[] = [
  { key: 'education', label: 'Faculdade e cursos' },
  { key: 'health', label: 'Saúde' },
  { key: 'finance', label: 'Financeiro' },
]

export function AgendaPage() {
  const [competence, setCompetence] = useState(() => today().slice(0, 7))
  const [selected, setSelected] = useState(() => today())
  const [editing, setEditing] = useState<Deadline | null | undefined>(undefined)

  // A legenda é o filtro: com tudo junto num mês cheio, olhar só o financeiro
  // é o gesto mais comum, e não valia uma barra de controles separada.
  const [areas, setAreas] = useState<AgendaArea[]>(() => AREAS.map((area) => area.key))

  const range = monthRange(competence)
  const { events } = useAgenda(range.from, range.to)
  const { data: deadlines, create, update, remove } = useDeadlines()

  const byDay = useMemo(
    () => groupByDay(events.filter((event) => areas.includes(event.area))),
    [events, areas],
  )

  const toggleArea = (area: AgendaArea) =>
    setAreas((current) =>
      current.includes(area) ? current.filter((item) => item !== area) : [...current, area],
    )

  const grid = monthGrid(competence)
  const selectedEvents = byDay.get(selected) ?? []

  const save = async (draft: DeadlineDraft) => {
    if (editing) await update.mutateAsync({ id: editing.id, patch: draft })
    else await create.mutateAsync(draft)
    setEditing(undefined)
  }

  const exportIcs = () => {
    const events = [...byDay.values()].flat()
    void salvarArquivo(
      icsFilename(competence),
      toIcs(events, `Life · ${competenceLabel(competence)}`),
      CALENDARIO_ICS,
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-fg text-xl font-semibold">Agenda</h1>
          <p className="text-fg-muted mt-1 max-w-2xl text-sm">
            Aulas, provas, treinos, vencimentos, metas e prazos de curso no mesmo mês. É na
            sobreposição que os conflitos aparecem — a prova na véspera da fatura, o treino no dia
            da entrega.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={exportIcs}>
            <Download />
            Exportar .ics
          </Button>
          <Button onClick={() => setEditing(null)}>
            <Plus />
            Compromisso
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <Card>
          <CardHeader
            title={competenceLabel(competence)}
            description={`${[...byDay.values()].flat().length} compromissos no período`}
            action={
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Mês anterior"
                  onClick={() => setCompetence(addMonths(competence, -1))}
                >
                  <ChevronLeft />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setCompetence(today().slice(0, 7))
                    setSelected(today())
                  }}
                >
                  Hoje
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Próximo mês"
                  onClick={() => setCompetence(addMonths(competence, 1))}
                >
                  <ChevronRight />
                </Button>
              </div>
            }
          />
          <CardContent>
            <div className="grid grid-cols-7 gap-1">
              {WEEKDAYS.map((day) => (
                <div key={day} className="text-fg-subtle pb-1 text-center text-[10px] font-medium">
                  {day}
                </div>
              ))}
              {grid.map((date) => (
                <DayCell
                  key={date}
                  date={date}
                  competence={competence}
                  events={byDay.get(date) ?? []}
                  selected={date === selected}
                  onSelect={() => setSelected(date)}
                />
              ))}
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px]">
              {AREAS.map((area) => (
                <Legend
                  key={area.key}
                  area={area.key}
                  label={area.label}
                  active={areas.includes(area.key)}
                  onToggle={() => toggleArea(area.key)}
                />
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="h-fit">
          <CardHeader
            title={longDate(selected)}
            description={`${relativeDay(selected)} · ${selectedEvents.length} compromisso${selectedEvents.length === 1 ? '' : 's'}`}
          />
          <CardContent className="space-y-2">
            {selectedEvents.length === 0 ? (
              <EmptyState
                icon={<CalendarDays className="size-5" />}
                title="Dia livre"
                description="Nada marcado para esta data."
                action={
                  <Button size="sm" variant="secondary" onClick={() => setEditing(null)}>
                    Marcar algo
                  </Button>
                }
              />
            ) : (
              selectedEvents.map((event) => (
                <EventRow
                  key={event.id}
                  event={event}
                  // Só compromisso criado à mão é editável: aula, treino e
                  // fatura são reflexos de registros que vivem em outra tela.
                  deadline={deadlines.find((d) => `deadline:${d.id}` === event.id) ?? null}
                  onEdit={setEditing}
                  onToggleDone={(deadline) =>
                    update.mutate({ id: deadline.id, patch: { done: !deadline.done } })
                  }
                />
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {editing !== undefined && (
        <DeadlineForm
          open
          key={editing?.id ?? 'new'}
          deadline={editing}
          defaultDate={selected}
          onClose={() => setEditing(undefined)}
          onSave={save}
          onDelete={
            editing
              ? () => {
                  remove.mutate(editing.id)
                  setEditing(undefined)
                }
              : undefined
          }
        />
      )}
    </div>
  )
}

function DayCell({
  date,
  competence,
  events,
  selected,
  onSelect,
}: {
  date: string
  competence: string
  events: AgendaEvent[]
  selected: boolean
  onSelect: () => void
}) {
  const outside = !date.startsWith(competence)
  const isToday = date === today()

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-label={longDate(date)}
      aria-current={isToday ? 'date' : undefined}
      className={cn(
        'flex min-h-14 flex-col items-center gap-1 rounded-lg border p-1.5 text-center transition-colors',
        selected ? 'border-accent bg-accent-soft' : 'hover:bg-surface-2 border-transparent',
        outside && 'opacity-35',
      )}
    >
      <span
        className={cn(
          'text-[11px] font-medium',
          isToday ? 'bg-accent text-accent-fg -mt-0.5 rounded-full px-1.5 py-0.5' : 'text-fg',
        )}
      >
        {Number(date.slice(8, 10))}
      </span>
      <span className="flex flex-wrap justify-center gap-0.5">
        {events.slice(0, 4).map((event) => (
          <span
            key={event.id}
            className={cn('bg-accent size-1.5 rounded-full', AREA_ACCENT[event.area])}
          />
        ))}
        {events.length > 4 && <span className="text-fg-subtle text-[9px]">+{events.length - 4}</span>}
      </span>
    </button>
  )
}

function EventRow({
  event,
  deadline,
  onEdit,
  onToggleDone,
}: {
  event: AgendaEvent
  deadline: Deadline | null
  onEdit: (deadline: Deadline) => void
  onToggleDone: (deadline: Deadline) => void
}) {
  const body = (
    <div className="flex items-start gap-2.5">
      <span className={cn('bg-accent mt-1.5 size-1.5 shrink-0 rounded-full', AREA_ACCENT[event.area])} />
      <div className="min-w-0 flex-1">
        <p className={cn('text-fg truncate text-sm font-medium', event.done && 'line-through opacity-60')}>
          {event.title}
        </p>
        <p className="text-fg-subtle truncate text-[11px]">
          {event.time ? `${event.time}${event.endTime ? `–${event.endTime}` : ''} · ` : ''}
          {event.detail ?? SOURCE_LABELS[event.source]}
          {event.amountCents ? ` · ${currency(event.amountCents / 100)}` : ''}
        </p>
      </div>
      <Badge>{SOURCE_LABELS[event.source]}</Badge>
    </div>
  )

  if (deadline) {
    return (
      <div className="hover:bg-surface-2 -mx-2 flex items-start gap-2 rounded-lg px-2 py-1.5">
        <input
          type="checkbox"
          checked={deadline.done}
          onChange={() => onToggleDone(deadline)}
          aria-label={`Concluir ${event.title}`}
          className="mt-1.5"
        />
        <button type="button" onClick={() => onEdit(deadline)} className="min-w-0 flex-1 text-left">
          {body}
        </button>
      </div>
    )
  }

  if (event.href) {
    return (
      <Link to={event.href} className="hover:bg-surface-2 -mx-2 block rounded-lg px-2 py-1.5">
        {body}
      </Link>
    )
  }

  return <div className="-mx-2 px-2 py-1.5">{body}</div>
}

function Legend({
  area,
  label,
  active,
  onToggle,
}: {
  area: keyof typeof AREA_ACCENT
  label: string
  active: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={active}
      className={cn(
        'flex items-center gap-1.5 rounded-full px-1.5 py-0.5 transition-colors',
        'hover:bg-surface-2',
        active ? 'text-fg-subtle' : 'text-fg-subtle/50',
      )}
    >
      <span
        className={cn(
          'size-1.5 rounded-full',
          AREA_ACCENT[area],
          active ? 'bg-accent' : 'ring-fg-subtle/40 bg-transparent ring-1',
        )}
      />
      {label}
    </button>
  )
}

