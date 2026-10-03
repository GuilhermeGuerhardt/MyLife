import { Pencil, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Select } from '@/components/ui/field'
import { EmptyState, SectionTitle } from '@/components/ui/misc'
import type { Subject } from '@/data/types'
import { SUBJECT_STATUS_LABELS, type SubjectStatus } from '@/lib/education/academics'
import { decimal } from '@/lib/format'

/**
 * A grade inteira, agrupada por período.
 *
 * A situação de cada disciplina muda ali mesmo, num seletor: é a edição mais
 * frequente da tela — "passei" —, e mandar abrir o formulário inteiro para isso
 * cobraria quatro cliques por nota saindo.
 */
export function GradeCurricular({
  subjects,
  onNova,
  onEditar,
  onRemover,
  onTrocarSituacao,
}: {
  subjects: Subject[]
  /** O período sugerido no formulário, quando se adiciona dentro de um grupo. */
  onNova: (periodo?: number) => void
  onEditar: (subject: Subject) => void
  onRemover: (id: string) => void
  onTrocarSituacao: (id: string, status: SubjectStatus) => void
}) {
  const porPeriodo = agruparPorPeriodo(subjects)

  return (
    <div className="space-y-5">
      <SectionTitle
        action={
          <Button size="sm" onClick={() => onNova()}>
            <Plus />
            Disciplina
          </Button>
        }
      >
        Grade curricular
      </SectionTitle>

      {subjects.length === 0 ? (
        <Card>
          <EmptyState
            title="Grade vazia"
            description="Cadastre as disciplinas com carga horária e período. O progresso, o CR e o que falta passam a ser calculados sozinhos."
            action={
              <Button size="sm" onClick={() => onNova()}>
                Adicionar disciplina
              </Button>
            }
          />
        </Card>
      ) : (
        porPeriodo.map(([periodo, items]) => (
          <div key={periodo}>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-fg-muted text-xs font-semibold tracking-wide uppercase">
                {periodo === 0 ? 'Sem período' : `${periodo}º período`}
              </h3>
              <button
                type="button"
                onClick={() => onNova(periodo || 1)}
                className="text-fg-subtle hover:text-fg text-xs transition-colors"
              >
                + adicionar aqui
              </button>
            </div>
            <Card>
              <div className="divide-border-base divide-y">
                {items.map((subject) => (
                  <div key={subject.id} className="flex items-center gap-3 px-4 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="text-fg truncate text-sm">{subject.name}</p>
                      <p className="text-fg-subtle text-xs">
                        {[
                          subject.code,
                          `${subject.hours} h`,
                          subject.credits ? `${subject.credits} créditos` : null,
                          subject.grade !== null ? `nota ${decimal(subject.grade, 1)}` : null,
                          subject.term_label,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                    </div>

                    <Select
                      className="h-8 w-32 text-xs"
                      aria-label={`Situação de ${subject.name}`}
                      value={subject.status}
                      onChange={(e) => onTrocarSituacao(subject.id, e.target.value as SubjectStatus)}
                    >
                      {(Object.keys(SUBJECT_STATUS_LABELS) as SubjectStatus[]).map((status) => (
                        <option key={status} value={status}>
                          {SUBJECT_STATUS_LABELS[status]}
                        </option>
                      ))}
                    </Select>

                    <button
                      type="button"
                      onClick={() => onEditar(subject)}
                      className="text-fg-subtle hover:text-fg transition-colors"
                      aria-label={`Editar ${subject.name}`}
                    >
                      <Pencil className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onRemover(subject.id)}
                      className="text-fg-subtle hover:text-negative transition-colors"
                      aria-label={`Remover ${subject.name}`}
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        ))
      )}
    </div>
  )
}

/** Agrupa por período, com "sem período" (0) no fim. */
function agruparPorPeriodo(subjects: Subject[]): Array<[number, Subject[]]> {
  const map = new Map<number, Subject[]>()
  for (const subject of subjects) {
    const key = subject.period ?? 0
    const list = map.get(key) ?? []
    list.push(subject)
    map.set(key, list)
  }
  return [...map.entries()]
    .map(
      ([period, items]) =>
        [period, items.sort((a, b) => a.name.localeCompare(b.name))] as [number, Subject[]],
    )
    .sort((a, b) => (a[0] === 0 ? 1 : b[0] === 0 ? -1 : a[0] - b[0]))
}
