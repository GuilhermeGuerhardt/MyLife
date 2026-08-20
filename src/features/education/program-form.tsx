import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Field, Input, Select } from '@/components/ui/field'
import { Modal } from '@/components/ui/modal'
import type { BaseRow, Degree, Institution, Program, ProgramStatus, Track } from '@/data/types'
import { DEGREE_LABELS, PROGRAM_STATUS_LABELS } from '@/data/types'

export type ProgramDraft = Omit<Program, keyof BaseRow>

/**
 * Formulário de curso, compartilhado pelos dois módulos. Os campos que só fazem
 * sentido em um deles aparecem conforme o track — faculdade pede carga horária
 * e horas complementares; curso livre pede plataforma, link e custo.
 */
export function ProgramForm({
  track,
  institutions,
  initial,
  onClose,
  onSave,
  onCreateInstitution,
}: {
  track: Track
  institutions: Institution[]
  initial?: Program
  onClose: () => void
  onSave: (values: ProgramDraft) => Promise<void>
  onCreateInstitution: (name: string) => Promise<Institution>
}) {
  const academic = track === 'academic'
  const [form, setForm] = useState<ProgramDraft>(() => ({
    institution_id: initial?.institution_id ?? null,
    track,
    name: initial?.name ?? '',
    degree: initial?.degree ?? (academic ? 'graduacao' : 'livre'),
    status: initial?.status ?? 'active',
    total_hours: initial?.total_hours ?? 0,
    complementary_hours_required: initial?.complementary_hours_required ?? 0,
    complementary_hours_done: initial?.complementary_hours_done ?? 0,
    start_date: initial?.start_date ?? null,
    expected_end: initial?.expected_end ?? null,
    current_term: initial?.current_term ?? (academic ? 1 : null),
    passing_grade: initial?.passing_grade ?? 6,
    link: initial?.link ?? null,
    instructor: initial?.instructor ?? null,
    cost: initial?.cost ?? null,
    rating: initial?.rating ?? null,
    certificate_url: initial?.certificate_url ?? null,
    notes: initial?.notes ?? null,
  }))
  const [newInstitution, setNewInstitution] = useState('')

  const set = <K extends keyof ProgramDraft>(key: K, value: ProgramDraft[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  async function handleSave() {
    let institutionId = form.institution_id
    if (!institutionId && newInstitution.trim()) {
      const created = await onCreateInstitution(newInstitution.trim())
      institutionId = created.id
    }
    await onSave({ ...form, institution_id: institutionId })
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={initial ? 'Editar' : academic ? 'Novo curso' : 'Novo curso livre'}
      description={
        academic
          ? 'Você pode cadastrar mais de uma faculdade — cada curso tem sua própria grade e progresso.'
          : 'Udemy, Alura, YouTube ou qualquer trilha própria.'
      }
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button disabled={!form.name.trim()} onClick={() => void handleSave()}>
            Salvar
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={academic ? 'Nome do curso' : 'Nome'} className="sm:col-span-2">
          <Input
            autoFocus
            value={form.name}
            placeholder={academic ? 'Engenharia de Software' : 'Node.js do zero ao avançado'}
            onChange={(e) => set('name', e.target.value)}
          />
        </Field>

        <Field label={academic ? 'Instituição' : 'Plataforma'}>
          <Select
            value={form.institution_id ?? ''}
            onChange={(e) => set('institution_id', e.target.value || null)}
          >
            <option value="">Nova...</option>
            {institutions.map((institution) => (
              <option key={institution.id} value={institution.id}>
                {institution.name}
              </option>
            ))}
          </Select>
        </Field>

        {!form.institution_id && (
          <Field label={academic ? 'Nome da instituição' : 'Nome da plataforma'}>
            <Input
              value={newInstitution}
              placeholder={academic ? 'UFRJ, PUC, Estácio...' : 'Udemy, Alura...'}
              onChange={(e) => setNewInstitution(e.target.value)}
            />
          </Field>
        )}

        <Field label="Tipo">
          <Select value={form.degree} onChange={(e) => set('degree', e.target.value as Degree)}>
            {(Object.keys(DEGREE_LABELS) as Degree[]).map((degree) => (
              <option key={degree} value={degree}>
                {DEGREE_LABELS[degree]}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Situação">
          <Select
            value={form.status}
            onChange={(e) => set('status', e.target.value as ProgramStatus)}
          >
            {(Object.keys(PROGRAM_STATUS_LABELS) as ProgramStatus[]).map((status) => (
              <option key={status} value={status}>
                {PROGRAM_STATUS_LABELS[status]}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Início">
          <Input
            type="date"
            value={form.start_date ?? ''}
            onChange={(e) => set('start_date', e.target.value || null)}
          />
        </Field>

        <Field label={academic ? 'Previsão de conclusão' : 'Prazo'}>
          <Input
            type="date"
            value={form.expected_end ?? ''}
            onChange={(e) => set('expected_end', e.target.value || null)}
          />
        </Field>

        {academic ? (
          <>
            <Field label="Carga horária total" suffix="h" hint="Conforme o projeto pedagógico.">
              <Input
                inputMode="numeric"
                value={form.total_hours || ''}
                onChange={(e) => set('total_hours', Number(e.target.value) || 0)}
              />
            </Field>

            <Field label="Semestre atual">
              <Input
                inputMode="numeric"
                value={form.current_term ?? ''}
                onChange={(e) => set('current_term', Number(e.target.value) || null)}
              />
            </Field>

            <Field label="Horas complementares exigidas" suffix="h">
              <Input
                inputMode="numeric"
                value={form.complementary_hours_required || ''}
                onChange={(e) => set('complementary_hours_required', Number(e.target.value) || 0)}
              />
            </Field>

            <Field label="Horas complementares cumpridas" suffix="h">
              <Input
                inputMode="numeric"
                value={form.complementary_hours_done || ''}
                onChange={(e) => set('complementary_hours_done', Number(e.target.value) || 0)}
              />
            </Field>

            <Field
              label="Nota de aprovação"
              hint="Varia por instituição — usada no simulador de nota."
            >
              <Input
                inputMode="decimal"
                value={form.passing_grade}
                onChange={(e) =>
                  set('passing_grade', Number(e.target.value.replace(',', '.')) || 6)
                }
              />
            </Field>
          </>
        ) : (
          <>
            <Field label="Instrutor">
              <Input
                value={form.instructor ?? ''}
                onChange={(e) => set('instructor', e.target.value || null)}
              />
            </Field>

            <Field label="Carga horária" suffix="h">
              <Input
                inputMode="numeric"
                value={form.total_hours || ''}
                onChange={(e) => set('total_hours', Number(e.target.value) || 0)}
              />
            </Field>

            <Field label="Custo" suffix="R$" hint="Entra como despesa quando o financeiro chegar.">
              <Input
                inputMode="decimal"
                value={form.cost ?? ''}
                onChange={(e) => set('cost', Number(e.target.value.replace(',', '.')) || null)}
              />
            </Field>

            <Field label="Link" className="sm:col-span-2">
              <Input
                type="url"
                value={form.link ?? ''}
                placeholder="https://..."
                onChange={(e) => set('link', e.target.value || null)}
              />
            </Field>
          </>
        )}
      </div>
    </Modal>
  )
}
