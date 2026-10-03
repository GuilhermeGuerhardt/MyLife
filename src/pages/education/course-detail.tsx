/**
 * O curso livre, por dentro: aulas, progresso e o ritmo que o prazo exige.
 *
 * Esta tela compõe. Os números, a lista de aulas e o formulário de colar o
 * índice do curso moram em `features/education/course`.
 */

import { ArrowLeft, ExternalLink, NotebookPen, Pencil, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge, EmptyState } from '@/components/ui/misc'
import { PageHeader } from '@/components/ui/page-header'
import { useCourseLessons, useInstitutions, useNotes, usePrograms } from '@/data/queries'
import { PROGRAM_STATUS_LABELS } from '@/data/types'
import { CertificateThumb } from '@/features/education/certificate'
import { AdicionarAulas } from '@/features/education/course/adicionar-aulas'
import { ListaDeAulas } from '@/features/education/course/lista-de-aulas'
import { NumerosDoCursoLivre } from '@/features/education/course/numeros-do-curso-livre'
import { ProgramForm } from '@/features/education/program-form'
import { ProgramSchedule } from '@/features/education/program-schedule'
import { useRemoveProgram } from '@/features/education/use-remove-program'
import { ehImagem } from '@/lib/education/certificate'
import { duration } from '@/lib/format'

export function CourseDetail() {
  const { programId } = useParams<{ programId: string }>()
  const { data: programs, update: updateProgram } = usePrograms()
  const { data: allLessons, create, update, remove } = useCourseLessons()
  const { data: institutions, create: createInstitution } = useInstitutions()
  const { data: notes } = useNotes()
  const navigate = useNavigate()
  const removerPrograma = useRemoveProgram()

  const [editing, setEditing] = useState(false)
  const [adding, setAdding] = useState(false)

  const program = programs.find((p) => p.id === programId)
  const lessons = useMemo(
    () => allLessons.filter((l) => l.program_id === programId).sort((a, b) => a.position - b.position),
    [allLessons, programId],
  )

  if (!program) {
    return (
      <Card>
        <EmptyState
          title="Curso não encontrado"
          action={
            <Link to="/cursos">
              <Button size="sm">Voltar</Button>
            </Link>
          }
        />
      </Card>
    )
  }

  const done = lessons.filter((l) => l.done)
  const minutesLeft = lessons.filter((l) => !l.done).reduce((sum, l) => sum + l.duration_min, 0)
  const institution = institutions.find((i) => i.id === program.institution_id)
  const programNotes = notes.filter((n) => n.program_id === program.id)
  const nextLesson = lessons.find((l) => !l.done)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <Link
            to="/cursos"
            className="text-fg-subtle hover:text-fg mb-2 inline-flex items-center gap-1.5 text-xs transition-colors"
          >
            <ArrowLeft className="size-3.5" />
            Cursos
          </Link>
          <PageHeader
            title={program.name}
            description={[
              institution?.name,
              program.instructor,
              PROGRAM_STATUS_LABELS[program.status],
            ]
              .filter(Boolean)
              .join(' · ')}
          />
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
          <Link to="/cursos/caderno">
            <Button variant="secondary">
              <NotebookPen />
              Caderno
              {programNotes.length > 0 && <Badge>{programNotes.length}</Badge>}
            </Button>
          </Link>
          {program.link && (
            <a href={program.link} target="_blank" rel="noreferrer">
              <Button variant="ghost" size="icon" aria-label="Abrir curso">
                <ExternalLink />
              </Button>
            </a>
          )}
          <Button variant="ghost" size="icon" onClick={() => setEditing(true)} aria-label="Editar">
            <Pencil />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              void removerPrograma(program).then((removeu) => {
                if (removeu) navigate('/cursos')
              })
            }}
            aria-label="Remover curso"
          >
            <Trash2 />
          </Button>
        </div>
      </div>

      <NumerosDoCursoLivre
        concluidas={done.length}
        total={lessons.length}
        minutosRestantes={minutesLeft}
        prazo={program.expected_end}
        custo={program.cost}
      />

      {nextLesson && (
        <Card className="bg-accent-soft border-transparent">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
            <div>
              <p className="text-accent text-xs font-medium tracking-wide uppercase">
                Próxima aula
              </p>
              <p className="text-fg mt-0.5 text-sm font-medium">{nextLesson.title}</p>
              <p className="text-fg-muted text-xs">
                {nextLesson.module} · {duration(nextLesson.duration_min)}
              </p>
            </div>
            <Button onClick={() => update.mutate({ id: nextLesson.id, patch: { done: true } })}>
              Marcar como concluída
            </Button>
          </CardContent>
        </Card>
      )}

      <ProgramSchedule programId={program.id} />

      <ListaDeAulas
        lessons={lessons}
        programId={programId}
        onAdicionar={() => setAdding(true)}
        onMarcar={(id, feita) => update.mutate({ id, patch: { done: feita } })}
        onRemover={(id) => remove.mutate(id)}
      />

      {editing && (
        <ProgramForm
          track="course"
          institutions={institutions.filter((i) => i.track === 'course')}
          initial={program}
          onClose={() => setEditing(false)}
          onCreateInstitution={(name) =>
            createInstitution.mutateAsync({ name, track: 'course', link: null })
          }
          onSave={async (values) => {
            await updateProgram.mutateAsync({ id: program.id, patch: values })
            setEditing(false)
          }}
        />
      )}

      {adding && (
        <AdicionarAulas
          startPosition={lessons.length}
          onClose={() => setAdding(false)}
          onSave={async (moduleName, titles, defaultDuration) => {
            for (const [index, title] of titles.entries()) {
              await create.mutateAsync({
                program_id: program.id,
                module: moduleName,
                title,
                duration_min: defaultDuration,
                done: false,
                position: lessons.length + index,
              })
            }
            setAdding(false)
          }}
        />
      )}
    </div>
  )
}
