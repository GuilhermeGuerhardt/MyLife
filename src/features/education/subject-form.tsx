import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Field, Input, Select } from '@/components/ui/field'
import { Modal } from '@/components/ui/modal'
import type { BaseRow, Subject } from '@/data/types'
import { SUBJECT_STATUS_LABELS, type SubjectStatus } from '@/lib/education/academics'

export type SubjectDraft = Omit<Subject, keyof BaseRow>

export const WEEKDAYS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']

export function SubjectForm({
  programId,
  siblings,
  initial,
  defaultPeriod,
  onClose,
  onSave,
}: {
  programId: string
  /** Outras disciplinas do curso — candidatas a pré-requisito. */
  siblings: Subject[]
  initial?: Subject
  defaultPeriod?: number
  onClose: () => void
  onSave: (values: SubjectDraft) => Promise<void>
}) {
  const [form, setForm] = useState<SubjectDraft>(() => ({
    program_id: programId,
    name: initial?.name ?? '',
    code: initial?.code ?? null,
    hours: initial?.hours ?? 60,
    credits: initial?.credits ?? 4,
    period: initial?.period ?? defaultPeriod ?? 1,
    status: initial?.status ?? 'pending',
    term_label: initial?.term_label ?? null,
    grade: initial?.grade ?? null,
    absences: initial?.absences ?? 0,
    total_classes: initial?.total_classes ?? null,
    prerequisites: initial?.prerequisites ?? [],
    weekday: initial?.weekday ?? null,
    start_time: initial?.start_time ?? null,
    end_time: initial?.end_time ?? null,
    room: initial?.room ?? null,
  }))

  const set = <K extends keyof SubjectDraft>(key: K, value: SubjectDraft[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  const togglePrerequisite = (id: string) =>
    set(
      'prerequisites',
      form.prerequisites.includes(id)
        ? form.prerequisites.filter((p) => p !== id)
        : [...form.prerequisites, id],
    )

  const candidates = siblings.filter((s) => s.id !== initial?.id)

  return (
    <Modal
      open
      onClose={onClose}
      title={initial ? 'Editar disciplina' : 'Nova disciplina'}
      description="Carga horária e créditos alimentam o progresso do curso e o cálculo do CR."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button disabled={!form.name.trim()} onClick={() => void onSave(form)}>
            Salvar
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nome" className="sm:col-span-2">
          <Input
            autoFocus
            value={form.name}
            placeholder="Cálculo II"
            onChange={(e) => set('name', e.target.value)}
          />
        </Field>

        <Field label="Código">
          <Input
            value={form.code ?? ''}
            placeholder="MAT102"
            onChange={(e) => set('code', e.target.value || null)}
          />
        </Field>

        <Field label="Período na grade">
          <Input
            inputMode="numeric"
            value={form.period ?? ''}
            onChange={(e) => set('period', Number(e.target.value) || null)}
          />
        </Field>

        <Field label="Carga horária" suffix="h">
          <Input
            inputMode="numeric"
            value={form.hours || ''}
            onChange={(e) => set('hours', Number(e.target.value) || 0)}
          />
        </Field>

        <Field label="Créditos">
          <Input
            inputMode="numeric"
            value={form.credits || ''}
            onChange={(e) => set('credits', Number(e.target.value) || 0)}
          />
        </Field>

        <Field label="Situação">
          <Select
            value={form.status}
            onChange={(e) => set('status', e.target.value as SubjectStatus)}
          >
            {(Object.keys(SUBJECT_STATUS_LABELS) as SubjectStatus[]).map((status) => (
              <option key={status} value={status}>
                {SUBJECT_STATUS_LABELS[status]}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Semestre cursado" hint="Ex.: 2026.1">
          <Input
            value={form.term_label ?? ''}
            placeholder="2026.1"
            onChange={(e) => set('term_label', e.target.value || null)}
          />
        </Field>

        {(form.status === 'done' || form.status === 'failed') && (
          <Field label="Nota final">
            <Input
              inputMode="decimal"
              value={form.grade ?? ''}
              onChange={(e) => set('grade', Number(e.target.value.replace(',', '.')) || null)}
            />
          </Field>
        )}

        {form.status === 'doing' && (
          <>
            <Field label="Total de aulas no semestre" hint="Base do limite de 25% de faltas.">
              <Input
                inputMode="numeric"
                value={form.total_classes ?? ''}
                onChange={(e) => set('total_classes', Number(e.target.value) || null)}
              />
            </Field>

            <Field label="Dia da semana">
              <Select
                value={form.weekday ?? ''}
                onChange={(e) =>
                  set('weekday', e.target.value === '' ? null : Number(e.target.value))
                }
              >
                <option value="">Não informar</option>
                {WEEKDAYS.map((day, index) => (
                  <option key={day} value={index}>
                    {day}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Início">
              <Input
                type="time"
                value={form.start_time ?? ''}
                onChange={(e) => set('start_time', e.target.value || null)}
              />
            </Field>

            <Field label="Fim">
              <Input
                type="time"
                value={form.end_time ?? ''}
                onChange={(e) => set('end_time', e.target.value || null)}
              />
            </Field>

            <Field label="Sala">
              <Input
                value={form.room ?? ''}
                onChange={(e) => set('room', e.target.value || null)}
              />
            </Field>
          </>
        )}

        {candidates.length > 0 && (
          <div className="sm:col-span-2">
            <p className="text-fg-muted mb-2 text-xs font-medium">
              Pré-requisitos
              <span className="text-fg-subtle font-normal">
                {' '}
                — a disciplina fica bloqueada até que estejam concluídos
              </span>
            </p>
            <div className="flex max-h-40 flex-wrap gap-1.5 overflow-y-auto">
              {candidates.map((candidate) => {
                const selected = form.prerequisites.includes(candidate.id)
                return (
                  <button
                    key={candidate.id}
                    type="button"
                    onClick={() => togglePrerequisite(candidate.id)}
                    className={
                      selected
                        ? 'bg-accent-soft text-accent rounded-md border border-transparent px-2 py-1 text-xs font-medium'
                        : 'border-border-base bg-surface-2 text-fg-muted hover:text-fg rounded-md border px-2 py-1 text-xs'
                    }
                  >
                    {candidate.name}
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}
