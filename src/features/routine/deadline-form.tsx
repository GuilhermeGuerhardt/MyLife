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

export function DeadlineForm({
  open,
  deadline,
  defaultDate,
  onClose,
  onSave,
  onDelete,
}: {
  open: boolean
  deadline: Deadline | null
  defaultDate?: string
  onClose: () => void
  onSave: (draft: DeadlineDraft) => void
  onDelete?: () => void
}) {
  const { data: programs } = usePrograms()
  const { data: subjects } = useSubjects()

  const [title, setTitle] = useState(deadline?.title ?? '')
  const [kind, setKind] = useState<Deadline['kind']>(deadline?.kind ?? 'prova')
  const [date, setDate] = useState(deadline?.date ?? defaultDate ?? today())
  const [programId, setProgramId] = useState(deadline?.program_id ?? '')
  const [subjectId, setSubjectId] = useState(deadline?.subject_id ?? '')
  const [notes, setNotes] = useState(deadline?.notes ?? '')

  const programSubjects = subjects.filter((s) => s.program_id === programId)

  const submit = () => {
    if (!title.trim()) return
    onSave({
      title: title.trim(),
      kind,
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
          <Button onClick={submit} disabled={!title.trim()}>
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

        <div className="grid gap-4 sm:grid-cols-2">
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
          <Field label="Data">
            <Input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Curso">
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
