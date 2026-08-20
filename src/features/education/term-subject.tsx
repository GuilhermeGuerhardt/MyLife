import { AlertTriangle, Check, Minus, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/field'
import { Badge, Progress } from '@/components/ui/misc'
import { useAssessments, useSubjects } from '@/data/queries'
import type { Assessment, Subject } from '@/data/types'
import { attendance, gradeSummary, neededGrade } from '@/lib/education/academics'
import { decimal } from '@/lib/format'
import { WEEKDAYS } from './subject-form'

/**
 * Cartão da disciplina em curso: faltas, avaliações e o simulador de nota.
 * É a tela que responde as duas perguntas do meio do semestre — "quantas aulas
 * ainda posso perder?" e "quanto preciso na prova que falta?".
 */
export function TermSubject({
  subject,
  passingGrade,
}: {
  subject: Subject
  passingGrade: number
}) {
  const { update: updateSubject } = useSubjects()
  const { data: allAssessments, create, update, remove } = useAssessments()
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState({ name: '', weight: '', grade: '' })

  const assessments = allAssessments
    .filter((a) => a.subject_id === subject.id)
    .sort((a, b) => (a.created_at ?? '').localeCompare(b.created_at ?? ''))

  const freq = attendance(subject.total_classes ?? 0, subject.absences)
  const summary = gradeSummary(assessments)
  const simulation = neededGrade(assessments, passingGrade)

  const setAbsences = (value: number) =>
    updateSubject.mutate({ id: subject.id, patch: { absences: Math.max(value, 0) } })

  async function addAssessment() {
    if (!draft.name.trim()) return
    await create.mutateAsync({
      subject_id: subject.id,
      name: draft.name.trim(),
      weight: Number(draft.weight.replace(',', '.')) || 1,
      grade: draft.grade ? Number(draft.grade.replace(',', '.')) : null,
      date: null,
    })
    setDraft({ name: '', weight: '', grade: '' })
    setAdding(false)
  }

  return (
    <Card>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-fg text-sm font-semibold">{subject.name}</p>
            <p className="text-fg-subtle text-[11px]">
              {[
                subject.code,
                subject.weekday !== null ? WEEKDAYS[subject.weekday] : null,
                subject.start_time && subject.end_time
                  ? `${subject.start_time}–${subject.end_time}`
                  : null,
                subject.room,
                `${subject.hours} h`,
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
          </div>
          {summary.partialAverage !== null && (
            <Badge tone={summary.partialAverage >= passingGrade ? 'positive' : 'warning'}>
              Média parcial {decimal(summary.partialAverage, 2)}
            </Badge>
          )}
        </div>

        {/* Faltas */}
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <span className="text-fg-muted text-xs font-medium">Faltas</span>
            {subject.total_classes ? (
              <span
                className={
                  freq.status === 'failed'
                    ? 'text-negative text-xs font-medium'
                    : freq.status === 'warning'
                      ? 'text-warning text-xs font-medium'
                      : 'text-fg-muted text-xs'
                }
              >
                {freq.status === 'failed'
                  ? `Passou do limite de ${freq.maxAbsences}`
                  : `Pode faltar mais ${freq.remaining} de ${freq.maxAbsences}`}
              </span>
            ) : (
              <span className="text-fg-subtle text-xs">Informe o total de aulas</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="icon"
              onClick={() => setAbsences(subject.absences - 1)}
              disabled={subject.absences === 0}
              aria-label="Remover uma falta"
            >
              <Minus />
            </Button>
            <span className="text-fg w-10 text-center text-lg font-semibold">
              {subject.absences}
            </span>
            <Button
              variant="secondary"
              size="icon"
              onClick={() => setAbsences(subject.absences + 1)}
              aria-label="Adicionar uma falta"
            >
              <Plus />
            </Button>
            {subject.total_classes ? (
              <Progress
                className="ml-2"
                value={subject.absences}
                max={freq.maxAbsences || 1}
                tone={
                  freq.status === 'failed'
                    ? 'negative'
                    : freq.status === 'warning'
                      ? 'warning'
                      : 'accent'
                }
              />
            ) : null}
          </div>

          {freq.status === 'failed' && (
            <p className="text-negative flex items-center gap-1.5 text-[11px]">
              <AlertTriangle className="size-3" />
              Frequência abaixo de 75% — reprovação por falta.
            </p>
          )}
        </div>

        {/* Avaliações */}
        <div className="space-y-2 border-t pt-3">
          <div className="flex items-center justify-between">
            <span className="text-fg-muted text-xs font-medium">Avaliações</span>
            <Button variant="ghost" size="sm" onClick={() => setAdding(true)}>
              <Plus />
              Adicionar
            </Button>
          </div>

          {assessments.length === 0 && !adding && (
            <p className="text-fg-subtle text-[11px]">
              Cadastre as provas e trabalhos com seus pesos para simular a nota que falta.
            </p>
          )}

          {assessments.map((assessment) => (
            <AssessmentRow
              key={assessment.id}
              assessment={assessment}
              onChange={(patch) => update.mutate({ id: assessment.id, patch })}
              onRemove={() => remove.mutate(assessment.id)}
            />
          ))}

          {adding && (
            <div className="flex items-center gap-2">
              <Input
                autoFocus
                className="flex-1"
                placeholder="P1, Trabalho..."
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                onKeyDown={(e) => e.key === 'Enter' && void addAssessment()}
              />
              <Input
                className="w-20"
                inputMode="decimal"
                placeholder="peso"
                value={draft.weight}
                onChange={(e) => setDraft({ ...draft, weight: e.target.value })}
              />
              <Input
                className="w-20"
                inputMode="decimal"
                placeholder="nota"
                value={draft.grade}
                onChange={(e) => setDraft({ ...draft, grade: e.target.value })}
              />
              <Button size="icon" onClick={() => void addAssessment()} aria-label="Salvar avaliação">
                <Check />
              </Button>
            </div>
          )}
        </div>

        {/* Simulador */}
        {simulation.status !== 'no_assessments' && (
          <div
            className={
              simulation.status === 'impossible'
                ? 'border-negative/40 bg-negative/5 rounded-lg border px-3 py-2.5'
                : simulation.status === 'already_passed' || simulation.status === 'nothing_left'
                  ? 'border-positive/40 bg-positive/5 rounded-lg border px-3 py-2.5'
                  : 'bg-accent-soft rounded-lg px-3 py-2.5'
            }
          >
            <p
              className={
                simulation.status === 'impossible'
                  ? 'text-negative text-xs leading-relaxed'
                  : simulation.status === 'already_passed' || simulation.status === 'nothing_left'
                    ? 'text-positive text-xs leading-relaxed'
                    : 'text-accent text-xs leading-relaxed'
              }
            >
              {simulation.message}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function AssessmentRow({
  assessment,
  onChange,
  onRemove,
}: {
  assessment: Assessment
  onChange: (patch: Partial<Assessment>) => void
  onRemove: () => void
}) {
  const [grade, setGrade] = useState(assessment.grade === null ? '' : String(assessment.grade))

  return (
    <div className="flex items-center gap-2">
      <span className="text-fg flex-1 truncate text-xs">{assessment.name}</span>
      <span className="text-fg-subtle w-16 text-right text-[11px]">
        peso {decimal(assessment.weight, 0)}
      </span>
      <Input
        className="h-8 w-20 text-center"
        inputMode="decimal"
        placeholder="—"
        value={grade}
        onChange={(e) => setGrade(e.target.value)}
        onBlur={() =>
          onChange({ grade: grade === '' ? null : Number(grade.replace(',', '.')) })
        }
      />
      <button
        type="button"
        onClick={onRemove}
        className="text-fg-subtle hover:text-negative transition-colors"
        aria-label={`Remover ${assessment.name}`}
      >
        <Trash2 className="size-3.5" />
      </button>
    </div>
  )
}
