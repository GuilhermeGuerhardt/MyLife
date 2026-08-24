import {
  BookOpen,
  ExternalLink,
  GraduationCap,
  NotebookPen,
  Plus,
  Clock,
} from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { confirmar } from '@/lib/avisos'
import { Card, CardContent } from '@/components/ui/card'
import { Badge, EmptyState, Progress, SectionTitle, Stat } from '@/components/ui/misc'
import { useInstitutions, useNotes, usePrograms } from '@/data/queries'
import { DEGREE_LABELS, PROGRAM_STATUS_LABELS, type Track } from '@/data/types'
import { ProgramForm, type ProgramDraft } from '@/features/education/program-form'
import { useEducation } from '@/features/education/use-education'
import { decimal, integer, longDate, percent } from '@/lib/format'

export function AcademicPrograms() {
  return <ProgramsPage track="academic" />
}

export function CoursePrograms() {
  return <ProgramsPage track="course" />
}

function ProgramsPage({ track }: { track: Track }) {
  const academic = track === 'academic'
  const { summaries, institutions } = useEducation(track)
  const { create, remove } = usePrograms()
  const { create: createInstitution } = useInstitutions()
  const { data: notes } = useNotes()
  const [creating, setCreating] = useState(false)

  const base = academic ? '/faculdade' : '/cursos'
  const active = summaries.filter((s) => s.program.status === 'active')
  const totalNotes = notes.filter((n) => n.track === track).length

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-fg text-xl font-semibold">{academic ? 'Faculdade' : 'Cursos'}</h1>
          <p className="text-fg-muted mt-1 max-w-2xl text-sm">
            {academic
              ? 'Cadastre uma ou mais instituições. Cada curso tem grade curricular, notas, faltas e o cálculo do que ainda falta para formar.'
              : 'Cursos livres de qualquer plataforma, com progresso por aula e ritmo necessário para bater o prazo.'}
          </p>
        </div>
        <div className="flex gap-2">
          <Link to={`${base}/caderno`}>
            <Button variant="secondary">
              <NotebookPen />
              Caderno
              {totalNotes > 0 && <Badge>{totalNotes}</Badge>}
            </Button>
          </Link>
          <Button onClick={() => setCreating(true)}>
            <Plus />
            {academic ? 'Curso' : 'Novo curso'}
          </Button>
        </div>
      </div>

      {active.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardContent>
              <Stat
                label="Em andamento"
                value={active.length}
                hint={active.length === 1 ? 'curso ativo' : 'cursos ativos'}
              />
            </CardContent>
          </Card>
          <Card>
            <CardContent>
              <Stat
                label="Progresso médio"
                value={percent(
                  active.reduce((sum, s) => sum + s.percent, 0) / active.length,
                  0,
                )}
                hint={academic ? 'Por carga horária cumprida' : 'Por aulas concluídas'}
              />
            </CardContent>
          </Card>
          <Card>
            <CardContent>
              <Stat
                label={academic ? 'Horas cumpridas' : 'Aulas concluídas'}
                value={
                  academic
                    ? integer(active.reduce((sum, s) => sum + s.progress.hoursDone, 0))
                    : integer(active.reduce((sum, s) => sum + s.lessonsDone, 0))
                }
                unit={academic ? 'h' : undefined}
              />
            </CardContent>
          </Card>
        </div>
      )}

      <div>
        <SectionTitle>{academic ? 'Meus cursos' : 'Minha lista'}</SectionTitle>

        {summaries.length === 0 ? (
          <Card>
            <EmptyState
              icon={academic ? <GraduationCap className="size-6" /> : <BookOpen className="size-6" />}
              title={academic ? 'Nenhum curso cadastrado' : 'Nenhum curso na lista'}
              description={
                academic
                  ? 'Cadastre sua faculdade e depois monte a grade curricular. O progresso e o "o que falta" são calculados sozinhos.'
                  : 'Adicione um curso, cadastre as aulas e acompanhe o progresso.'
              }
              action={
                <Button size="sm" onClick={() => setCreating(true)}>
                  Cadastrar
                </Button>
              }
            />
          </Card>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {summaries.map((summary) => (
              <Card key={summary.program.id}>
                <CardContent className="space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link
                        to={`${base}/${summary.program.id}`}
                        className="text-fg hover:text-accent text-sm font-semibold transition-colors"
                      >
                        {summary.program.name}
                      </Link>
                      <p className="text-fg-subtle mt-0.5 text-xs">
                        {summary.institution?.name ?? 'Sem instituição'} ·{' '}
                        {DEGREE_LABELS[summary.program.degree]}
                        {academic && summary.program.current_term
                          ? ` · ${summary.program.current_term}º semestre`
                          : ''}
                      </p>
                    </div>
                    <Badge tone={summary.program.status === 'active' ? 'accent' : 'neutral'}>
                      {PROGRAM_STATUS_LABELS[summary.program.status]}
                    </Badge>
                  </div>

                  <div>
                    <div className="text-fg-muted mb-1.5 flex justify-between text-xs">
                      <span>
                        {academic
                          ? `${integer(summary.progress.hoursDone)} de ${integer(summary.progress.hoursTotal)} h`
                          : `${summary.lessonsDone} de ${summary.lessons.length} aulas`}
                      </span>
                      <span className="text-fg font-medium">{percent(summary.percent, 0)}</span>
                    </div>
                    <Progress value={summary.percent} />
                  </div>

                  <div className="text-fg-subtle flex flex-wrap gap-x-4 gap-y-1 text-[11px]">
                    {academic && (
                      <>
                        <span>{summary.progress.counts.done} concluídas</span>
                        <span>{summary.progress.counts.doing} cursando</span>
                        <span>{summary.progress.remaining.length} faltando</span>
                        {summary.index !== null && <span>CR {decimal(summary.index, 2)}</span>}
                      </>
                    )}
                    {!academic && summary.program.total_hours > 0 && (
                      <span className="flex items-center gap-1">
                        <Clock className="size-3" />
                        {integer(summary.program.total_hours)} h
                      </span>
                    )}
                    {summary.noteCount > 0 && (
                      <span>
                        {summary.noteCount} {summary.noteCount === 1 ? 'anotação' : 'anotações'}
                      </span>
                    )}
                    {summary.program.expected_end && (
                      <span>Previsto para {longDate(summary.program.expected_end)}</span>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <Link to={`${base}/${summary.program.id}`} className="flex-1">
                      <Button variant="secondary" size="sm" className="w-full">
                        {academic ? 'Abrir grade' : 'Abrir aulas'}
                      </Button>
                    </Link>
                    {summary.program.link && (
                      <a href={summary.program.link} target="_blank" rel="noreferrer">
                        <Button variant="ghost" size="icon" aria-label="Abrir link do curso">
                          <ExternalLink />
                        </Button>
                      </a>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        void confirmar(
                          `Remover "${summary.program.name}" e tudo dentro dele?`,
                          { confirmar: 'Remover', tom: 'error' },
                        ).then((ok) => {
                          if (ok) remove.mutate(summary.program.id)
                        })
                      }}
                    >
                      Remover
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {creating && (
        <ProgramForm
          track={track}
          institutions={institutions}
          onClose={() => setCreating(false)}
          onCreateInstitution={(name) =>
            createInstitution.mutateAsync({ name, track, link: null })
          }
          onSave={async (values: ProgramDraft) => {
            await create.mutateAsync(values)
            setCreating(false)
          }}
        />
      )}
    </div>
  )
}
