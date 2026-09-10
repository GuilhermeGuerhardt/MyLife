import { CalendarClock, CalendarPlus, ExternalLink, Pencil } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge, EmptyState, Progress } from '@/components/ui/misc'
import { useDeadlines, useSubjects } from '@/data/queries'
import type { Deadline } from '@/data/types'
import { DeadlineForm, type DeadlineDraft } from '@/features/routine/deadline-form'
import { shortDate, longDate, relativeDay } from '@/lib/format'
import { cn, today } from '@/lib/utils'

const KIND_LABELS: Record<Deadline['kind'], string> = {
  prova: 'Prova',
  trabalho: 'Trabalho',
  entrega: 'Entrega',
  aula: 'Aula',
}

/**
 * Compromissos de um curso: os do próprio curso e os de qualquer disciplina
 * dele.
 *
 * Não é uma cópia do que está na agenda — é o mesmo registro visto de outro
 * ângulo. Por isso a caixa de seleção daqui e a da agenda concordam sempre, e
 * o que nasce numa disciplina sobe para o curso sem ninguém precisar repetir o
 * cadastro.
 */
export function useProgramDeadlines(programId: string): {
  deadlines: Deadline[]
  done: number
  percent: number
} {
  const { data: allDeadlines } = useDeadlines()
  const { data: allSubjects } = useSubjects()

  return useMemo(() => {
    const subjectIds = new Set(
      allSubjects.filter((s) => s.program_id === programId).map((s) => s.id),
    )
    const deadlines = allDeadlines
      .filter(
        (d) => d.program_id === programId || (d.subject_id && subjectIds.has(d.subject_id)),
      )
      .sort((a, b) => a.date.localeCompare(b.date))

    const done = deadlines.filter((d) => d.done).length
    return {
      deadlines,
      done,
      percent: deadlines.length ? (done / deadlines.length) * 100 : 0,
    }
  }, [allDeadlines, allSubjects, programId])
}

export function ProgramSchedule({
  programId,
  description,
}: {
  programId: string
  description?: string
}) {
  const { deadlines, done, percent } = useProgramDeadlines(programId)
  const { data: subjects } = useSubjects()
  const { create, update, remove } = useDeadlines()
  const [editing, setEditing] = useState<Deadline | null | undefined>(undefined)

  const subjectName = (id: string | null) =>
    id ? (subjects.find((s) => s.id === id)?.name ?? null) : null

  const save = async (draft: DeadlineDraft) => {
    if (editing) await update.mutateAsync({ id: editing.id, patch: draft })
    else await create.mutateAsync(draft)
    setEditing(undefined)
  }

  return (
    <Card>
      <CardHeader
        title="Compromissos"
        description={
          description ??
          'Provas, entregas e aulas marcadas. São os mesmos itens da agenda — concluir aqui ou lá dá no mesmo.'
        }
        action={
          <Button size="sm" variant="secondary" onClick={() => setEditing(null)}>
            <CalendarPlus />
            Marcar
          </Button>
        }
      />
      <CardContent className="space-y-3 pt-3">
        {deadlines.length === 0 ? (
          <EmptyState
            icon={<CalendarClock className="size-5" />}
            title="Nada marcado"
            description="O que você marcar aqui aparece na agenda, e o que marcar na agenda para este curso aparece aqui."
            action={
              <Button size="sm" variant="secondary" onClick={() => setEditing(null)}>
                Marcar compromisso
              </Button>
            }
          />
        ) : (
          <>
            <div>
              <div className="text-fg-muted mb-1.5 flex justify-between text-xs">
                <span>
                  {done} de {deadlines.length} concluídos
                </span>
                <span className="text-fg font-medium">{Math.round(percent)}%</span>
              </div>
              <Progress value={percent} tone={percent === 100 ? 'positive' : 'accent'} />
            </div>

            <div className="divide-border-base divide-y">
              {deadlines.map((deadline) => (
                <DeadlineRow
                  key={deadline.id}
                  deadline={deadline}
                  subject={subjectName(deadline.subject_id)}
                  onToggle={() =>
                    update.mutate({ id: deadline.id, patch: { done: !deadline.done } })
                  }
                  onEdit={() => setEditing(deadline)}
                />
              ))}
            </div>

            <Link
              to="/rotina/agenda"
              className="text-fg-subtle hover:text-fg inline-flex items-center gap-1.5 text-[11px] transition-colors"
            >
              Ver no calendário
              <ExternalLink className="size-3" />
            </Link>
          </>
        )}
      </CardContent>

      {editing !== undefined && (
        <DeadlineForm
          open
          key={editing?.id ?? 'novo'}
          deadline={editing}
          defaultDate={today()}
          lockedProgramId={editing ? undefined : programId}
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

    </Card>
  )
}

function DeadlineRow({
  deadline,
  subject,
  onToggle,
  onEdit,
}: {
  deadline: Deadline
  subject: string | null
  onToggle: () => void
  onEdit: () => void
}) {
  const atrasado = !deadline.done && deadline.date < today()
  const periodo =
    deadline.start_date && deadline.start_date !== deadline.date
      ? `${shortDate(deadline.start_date)} → ${shortDate(deadline.date)}`
      : longDate(deadline.date)

  return (
    <div className="flex items-center gap-3 py-2">
      <input
        type="checkbox"
        checked={deadline.done}
        onChange={onToggle}
        aria-label={`Concluir ${deadline.title}`}
        className="accent-accent size-4 shrink-0 cursor-pointer"
      />
      <button type="button" onClick={onEdit} className="min-w-0 flex-1 text-left">
        <p
          className={cn(
            'text-fg truncate text-sm',
            deadline.done && 'text-fg-subtle line-through',
          )}
        >
          {deadline.title}
        </p>
        <p className={cn('truncate text-[11px]', atrasado ? 'text-negative' : 'text-fg-subtle')}>
          {[periodo, subject, deadline.done ? null : relativeDay(deadline.date)]
            .filter(Boolean)
            .join(' · ')}
        </p>
      </button>
      <Badge tone={deadline.done ? 'positive' : atrasado ? 'negative' : 'neutral'}>
        {KIND_LABELS[deadline.kind]}
      </Badge>
      <button
        type="button"
        onClick={onEdit}
        className="text-fg-subtle hover:text-fg transition-colors"
        aria-label={`Editar ${deadline.title}`}
      >
        <Pencil className="size-3.5" />
      </button>
    </div>
  )
}
