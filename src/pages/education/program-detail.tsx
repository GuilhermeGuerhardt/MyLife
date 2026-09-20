import { ArrowLeft, Lock, NotebookPen, Pencil, Plus, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Select } from '@/components/ui/field'
import { Badge, EmptyState, Progress, SectionTitle, Segmented, Stat } from '@/components/ui/misc'
import { useInstitutions, useNotes, usePrograms, useSubjects } from '@/data/queries'
import { DEGREE_LABELS, type Subject } from '@/data/types'
import { CertificateThumb } from '@/features/education/certificate'
import { ProgramForm } from '@/features/education/program-form'
import { ProgramSchedule } from '@/features/education/program-schedule'
import { useRemoveProgram } from '@/features/education/use-remove-program'
import { ehImagem } from '@/lib/education/certificate'
import { SubjectForm } from '@/features/education/subject-form'
import { TermSubject } from '@/features/education/term-subject'
import { decimal, integer, percent } from '@/lib/format'
import {
  SUBJECT_STATUS_LABELS,
  academicIndex,
  availableNext,
  checkPrerequisites,
  estimateRemainingTerms,
  programProgress,
  type SubjectLike,
  type SubjectStatus,
} from '@/lib/education/academics'

type Tab = 'overview' | 'curriculum' | 'term'

export function ProgramDetail() {
  const { programId } = useParams<{ programId: string }>()
  const { data: programs, update: updateProgram } = usePrograms()
  const { data: allSubjects, create, update, remove } = useSubjects()
  const { data: institutions, create: createInstitution } = useInstitutions()
  const { data: notes } = useNotes()
  const navigate = useNavigate()
  const removerPrograma = useRemoveProgram()

  const [tab, setTab] = useState<Tab>('overview')
  const [editing, setEditing] = useState(false)
  const [subjectForm, setSubjectForm] = useState<{ subject?: Subject; period?: number } | null>(null)

  const program = programs.find((p) => p.id === programId)
  const subjects = useMemo(
    () => allSubjects.filter((s) => s.program_id === programId),
    [allSubjects, programId],
  )

  const progress = useMemo(
    () =>
      program
        ? programProgress(subjects as SubjectLike[], program)
        : null,
    [subjects, program],
  )

  if (!program || !progress) {
    return (
      <Card>
        <EmptyState
          title="Curso não encontrado"
          description="Ele pode ter sido removido."
          action={
            <Link to="/faculdade">
              <Button size="sm">Voltar</Button>
            </Link>
          }
        />
      </Card>
    )
  }

  const institution = institutions.find((i) => i.id === program.institution_id)
  const doing = subjects.filter((s) => s.status === 'doing')
  const next = availableNext(subjects as SubjectLike[])
  const index = academicIndex(subjects as SubjectLike[])
  const programNotes = notes.filter((n) => n.program_id === program.id)

  // Ritmo médio: carga cumprida dividida pelos semestres já cursados.
  const termsDone = Math.max((program.current_term ?? 1) - 1, 1)
  const hoursPerTerm = progress.hoursDone > 0 ? progress.hoursDone / termsDone : 0
  const remainingTerms = estimateRemainingTerms(progress.hoursRemaining, hoursPerTerm)

  const byPeriod = groupByPeriod(subjects)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <Link
            to="/faculdade"
            className="text-fg-subtle hover:text-fg mb-2 inline-flex items-center gap-1.5 text-xs transition-colors"
          >
            <ArrowLeft className="size-3.5" />
            Faculdade
          </Link>
          <h1 className="text-fg text-xl font-semibold">{program.name}</h1>
          <p className="text-fg-muted mt-1 text-sm">
            {institution?.name ?? 'Sem instituição'} · {DEGREE_LABELS[program.degree]}
            {program.current_term ? ` · ${program.current_term}º semestre` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {ehImagem(program.certificate_url) && (
            <CertificateThumb
              imagem={program.certificate_url}
              pdf={program.certificate_pdf}
              title={program.name}
              className="size-11"
            />
          )}
          <Link to="/faculdade/caderno">
            <Button variant="secondary">
              <NotebookPen />
              Caderno
              {programNotes.length > 0 && <Badge>{programNotes.length}</Badge>}
            </Button>
          </Link>
          <Button variant="ghost" size="icon" onClick={() => setEditing(true)} aria-label="Editar curso">
            <Pencil />
          </Button>
          {/* Também aqui, e não só na lista: quem decide largar um curso
              costuma estar olhando para ele, não para a lista de todos. */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              void removerPrograma(program).then((removeu) => {
                if (removeu) navigate('/faculdade')
              })
            }}
            aria-label="Remover curso"
          >
            <Trash2 />
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent>
            <Stat
              label="Progresso"
              value={percent(progress.percent, 1)}
              hint={`${integer(progress.hoursDone)} de ${integer(progress.hoursTotal)} h`}
            />
            <Progress className="mt-3" value={progress.percent} />
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <Stat
              label="Falta cursar"
              value={progress.remaining.length}
              unit={progress.remaining.length === 1 ? 'disciplina' : 'disciplinas'}
              hint={`${integer(progress.hoursRemaining)} h restantes`}
            />
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <Stat
              label="Coeficiente de rendimento"
              value={index !== null ? decimal(index, 2) : '—'}
              hint={index !== null ? 'Ponderado por créditos' : 'Sem notas lançadas'}
            />
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <Stat
              label="Previsão"
              value={remainingTerms ? `${remainingTerms}` : '—'}
              unit={remainingTerms ? (remainingTerms === 1 ? 'semestre' : 'semestres') : undefined}
              hint={
                remainingTerms
                  ? `No ritmo de ${integer(hoursPerTerm)} h por semestre`
                  : 'Conclua disciplinas para estimar'
              }
            />
          </CardContent>
        </Card>
      </div>

      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { value: 'overview', label: 'Visão geral' },
          { value: 'curriculum', label: `Grade (${subjects.length})` },
          { value: 'term', label: `Semestre atual (${doing.length})` },
        ]}
      />

      {tab === 'overview' && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader
              title="O que falta"
              description="Pendentes e reprovadas, na ordem do período"
            />
            <CardContent className="pt-2">
              {progress.remaining.length === 0 ? (
                <p className="text-positive text-sm">
                  Nenhuma disciplina pendente — grade concluída.
                </p>
              ) : (
                <div className="divide-border-base -my-2 divide-y">
                  {progress.remaining
                    .slice()
                    .sort((a, b) => (a.period ?? 99) - (b.period ?? 99))
                    .map((subject) => {
                      const check = checkPrerequisites(subject, subjects as SubjectLike[])
                      return (
                        <div key={subject.id} className="flex items-center gap-3 py-2">
                          <div className="min-w-0 flex-1">
                            <p className="text-fg truncate text-sm">{subject.name}</p>
                            <p className="text-fg-subtle text-[11px]">
                              {subject.period ? `${subject.period}º período · ` : ''}
                              {subject.hours} h
                              {!check.unlocked &&
                                ` · falta ${check.missing.map((m) => m.name).join(', ')}`}
                            </p>
                          </div>
                          {check.unlocked ? (
                            <Badge tone="accent">Liberada</Badge>
                          ) : (
                            <Badge>
                              <Lock className="size-3" />
                              Bloqueada
                            </Badge>
                          )}
                        </div>
                      )
                    })}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="space-y-4">
            <ProgramSchedule
              programId={program.id}
              description="Provas, entregas e eventos deste curso e das suas disciplinas — os mesmos itens da agenda."
            />

            <Card>
              <CardHeader
                title="Pode cursar agora"
                description="Pré-requisitos já cumpridos"
              />
              <CardContent className="pt-2">
                {next.length === 0 ? (
                  <p className="text-fg-muted text-sm">
                    Nada liberado — conclua os pré-requisitos pendentes.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {next.slice(0, 12).map((subject) => (
                      <span
                        key={subject.id}
                        className="bg-surface-2 border-border-base text-fg-muted rounded-md border px-2 py-1 text-xs"
                      >
                        {subject.name}
                      </span>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {program.complementary_hours_required > 0 && (
              <Card>
                <CardHeader title="Horas complementares" />
                <CardContent className="space-y-2 pt-2">
                  <div className="text-fg-muted flex justify-between text-xs">
                    <span>
                      {integer(program.complementary_hours_done)} de{' '}
                      {integer(program.complementary_hours_required)} h
                    </span>
                    <span className="text-fg font-medium">
                      {percent(progress.complementaryPercent, 0)}
                    </span>
                  </div>
                  <Progress value={progress.complementaryPercent} />
                  <div className="flex gap-2 pt-1">
                    {[10, 20, 50].map((amount) => (
                      <Button
                        key={amount}
                        variant="secondary"
                        size="sm"
                        onClick={() =>
                          updateProgram.mutate({
                            id: program.id,
                            patch: {
                              complementary_hours_done:
                                program.complementary_hours_done + amount,
                            },
                          })
                        }
                      >
                        +{amount} h
                      </Button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {progress.hoursMismatch !== 0 && (
              <Card
                className={
                  progress.hoursMismatch > 0 ? 'border-warning/40 bg-warning/5' : undefined
                }
              >
                <CardContent className="py-4">
                  <p className="text-fg-muted text-xs leading-relaxed">
                    {progress.hoursMismatch < 0 ? (
                      <>
                        A grade cadastrada soma {integer(progress.gradeHours)} h das{' '}
                        {integer(program.total_hours)} h do curso — faltam{' '}
                        {integer(Math.abs(progress.hoursMismatch))} h de disciplinas para
                        cadastrar. O progresso já considera a carga total declarada, então não
                        fica inflado.
                      </>
                    ) : (
                      <>
                        A grade cadastrada soma {integer(progress.gradeHours)} h, acima das{' '}
                        {integer(program.total_hours)} h declaradas no curso. O progresso está
                        usando a soma da grade — vale conferir a carga total no cadastro.
                      </>
                    )}
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}

      {tab === 'curriculum' && (
        <div className="space-y-5">
          <SectionTitle
            action={
              <Button size="sm" onClick={() => setSubjectForm({})}>
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
                  <Button size="sm" onClick={() => setSubjectForm({})}>
                    Adicionar disciplina
                  </Button>
                }
              />
            </Card>
          ) : (
            byPeriod.map(([period, items]) => (
              <div key={period}>
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-fg-muted text-xs font-semibold tracking-wide uppercase">
                    {period === 0 ? 'Sem período' : `${period}º período`}
                  </h3>
                  <button
                    type="button"
                    onClick={() => setSubjectForm({ period: period || 1 })}
                    className="text-fg-subtle hover:text-fg text-[11px] transition-colors"
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
                          <p className="text-fg-subtle text-[11px]">
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
                          onChange={(e) =>
                            update.mutate({
                              id: subject.id,
                              patch: { status: e.target.value as SubjectStatus },
                            })
                          }
                        >
                          {(Object.keys(SUBJECT_STATUS_LABELS) as SubjectStatus[]).map((status) => (
                            <option key={status} value={status}>
                              {SUBJECT_STATUS_LABELS[status]}
                            </option>
                          ))}
                        </Select>

                        <button
                          type="button"
                          onClick={() => setSubjectForm({ subject })}
                          className="text-fg-subtle hover:text-fg transition-colors"
                          aria-label={`Editar ${subject.name}`}
                        >
                          <Pencil className="size-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => remove.mutate(subject.id)}
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
      )}

      {tab === 'term' && (
        <div className="space-y-4">
          {doing.length === 0 ? (
            <Card>
              <EmptyState
                title="Nenhuma disciplina em curso"
                description='Marque como "Cursando" na grade as disciplinas deste semestre para acompanhar faltas e notas.'
                action={
                  <Button size="sm" onClick={() => setTab('curriculum')}>
                    Abrir grade
                  </Button>
                }
              />
            </Card>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {doing.map((subject) => (
                <TermSubject
                  key={subject.id}
                  subject={subject}
                  passingGrade={program.passing_grade}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {editing && (
        <ProgramForm
          track="academic"
          institutions={institutions.filter((i) => i.track === 'academic')}
          initial={program}
          onClose={() => setEditing(false)}
          onCreateInstitution={(name) =>
            createInstitution.mutateAsync({ name, track: 'academic', link: null })
          }
          onSave={async (values) => {
            await updateProgram.mutateAsync({ id: program.id, patch: values })
            setEditing(false)
          }}
        />
      )}

      {subjectForm && (
        <SubjectForm
          programId={program.id}
          siblings={subjects}
          initial={subjectForm.subject}
          defaultPeriod={subjectForm.period}
          onClose={() => setSubjectForm(null)}
          onSave={async (values) => {
            if (subjectForm.subject) {
              await update.mutateAsync({ id: subjectForm.subject.id, patch: values })
            } else {
              await create.mutateAsync(values)
            }
            setSubjectForm(null)
          }}
        />
      )}
    </div>
  )
}

/** Agrupa por período, com "sem período" (0) no fim. */
function groupByPeriod(subjects: Subject[]): Array<[number, Subject[]]> {
  const map = new Map<number, Subject[]>()
  for (const subject of subjects) {
    const key = subject.period ?? 0
    const list = map.get(key) ?? []
    list.push(subject)
    map.set(key, list)
  }
  return [...map.entries()]
    .map(([period, items]) => [period, items.sort((a, b) => a.name.localeCompare(b.name))] as [number, Subject[]])
    .sort((a, b) => (a[0] === 0 ? 1 : b[0] === 0 ? -1 : a[0] - b[0]))
}
