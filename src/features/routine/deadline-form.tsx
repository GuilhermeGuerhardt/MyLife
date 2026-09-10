import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Field, Input, Select, Textarea } from '@/components/ui/field'
import { Modal } from '@/components/ui/modal'
import { usePrograms, useSubjects } from '@/data/queries'
import type { Deadline } from '@/data/types'
import { today } from '@/lib/dates'

const KINDS: Array<{ value: Deadline['kind']; label: string }> = [
  { value: 'prova', label: 'Prova' },
  { value: 'trabalho', label: 'Trabalho' },
  { value: 'entrega', label: 'Entrega' },
  { value: 'aula', label: 'Aula ou evento' },
]

export type DeadlineDraft = Omit<Deadline, 'id' | 'user_id' | 'created_at' | 'updated_at'>

/**
 * Formulário do compromisso, usado na agenda e dentro do curso.
 *
 * `lockedProgramId` e `lockedSubjectId` chegam quando ele é aberto de dentro de
 * um curso ou de uma disciplina: ali o vínculo já está decidido, e oferecer os
 * seletores só criaria a chance de gravar no curso errado.
 */
export function DeadlineForm({
  open,
  deadline,
  defaultDate,
  lockedProgramId,
  lockedSubjectId,
  onClose,
  onSave,
  onDelete,
}: {
  open: boolean
  deadline: Deadline | null
  defaultDate?: string
  lockedProgramId?: string
  lockedSubjectId?: string
  onClose: () => void
  onSave: (draft: DeadlineDraft) => void
  onDelete?: () => void
}) {
  const { data: programs } = usePrograms()
  const { data: subjects } = useSubjects()

  const [title, setTitle] = useState(deadline?.title ?? '')
  const [kind, setKind] = useState<Deadline['kind']>(deadline?.kind ?? 'prova')
  const [start, setStart] = useState(deadline?.start_date ?? '')
  const [date, setDate] = useState(deadline?.date ?? defaultDate ?? today())
  const [programId, setProgramId] = useState(
    lockedProgramId ?? deadline?.program_id ?? '',
  )
  const [subjectId, setSubjectId] = useState(lockedSubjectId ?? deadline?.subject_id ?? '')
  const [notes, setNotes] = useState(deadline?.notes ?? '')

  const programSubjects = subjects.filter((s) => s.program_id === programId)
  const vinculoFixo = Boolean(lockedProgramId)
  const programa = programs.find((p) => p.id === programId)
  const materia = subjects.find((s) => s.id === subjectId)

  // Início depois da entrega é erro de digitação, não intenção.
  const intervaloInvalido = Boolean(start) && start > date

  const submit = () => {
    if (!title.trim() || intervaloInvalido) return
    onSave({
      title: title.trim(),
      kind,
      start_date: start || null,
      date,
      program_id: programId || null,
      subject_id: subjectId || null,
      notes: notes.trim() || null,
      done: deadline?.done ?? false,
    })
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={deadline ? 'Editar compromisso' : 'Novo compromisso'}
      description="Prova, entrega ou qualquer data que não pode passar batida."
      footer={
        <>
          {onDelete && (
            <Button variant="ghost" className="mr-auto" onClick={onDelete}>
              Excluir
            </Button>
          )}
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={!title.trim() || intervaloInvalido}>
            Salvar
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Título">
          <Input
            value={title}
            autoFocus
            placeholder="P1 de Cálculo II"
            onChange={(event) => setTitle(event.target.value)}
            onKeyDown={(event) => event.key === 'Enter' && submit()}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Tipo">
            <Select
              value={kind}
              onChange={(event) => setKind(event.target.value as Deadline['kind'])}
            >
              {KINDS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Início" hint="Opcional">
            <Input
              type="date"
              value={start}
              max={date}
              onChange={(event) => setStart(event.target.value)}
            />
          </Field>
          <Field
            label={start ? 'Entrega' : 'Data'}
            error={intervaloInvalido ? 'Antes do início' : undefined}
          >
            <Input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          </Field>
        </div>

        {vinculoFixo ? (
          <p className="text-fg-subtle text-xs">
            Vinculado a {materia ? `${materia.name} · ` : ''}
            {programa?.name ?? 'este curso'}. Aparece no calendário e na tela do curso — marcar
            concluído num lugar vale nos dois.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Curso" hint="Vincular faz o compromisso contar no progresso do curso.">
              <Select
                value={programId}
                onChange={(event) => {
                  setProgramId(event.target.value)
                  setSubjectId('')
                }}
              >
                <option value="">Nenhum</option>
                {programs.map((program) => (
                  <option key={program.id} value={program.id}>
                    {program.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Disciplina">
              <Select
                value={subjectId}
                disabled={programSubjects.length === 0}
                onChange={(event) => setSubjectId(event.target.value)}
              >
                <option value="">Nenhuma</option>
                {programSubjects.map((subject) => (
                  <option key={subject.id} value={subject.id}>
                    {subject.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        )}

        <Field label="Observações">
          <Textarea
            value={notes}
            placeholder="Conteúdo da prova, formato da entrega, link do portal…"
            onChange={(event) => setNotes(event.target.value)}
          />
        </Field>
      </div>
    </Modal>
  )
}
