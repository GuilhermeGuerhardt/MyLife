import {
  ArrowLeft,
  ChevronRight,
  ChevronsDownUp,
  ChevronsUpDown,
  ExternalLink,
  ListPlus,
  NotebookPen,
  Pencil,
  Trash2,
} from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Field, Input, Textarea } from '@/components/ui/field'
import { Badge, EmptyState, Progress, Stat } from '@/components/ui/misc'
import { Modal } from '@/components/ui/modal'
import { useCourseLessons, useInstitutions, useNotes, usePrograms } from '@/data/queries'
import { PROGRAM_STATUS_LABELS } from '@/data/types'
import { CertificateThumb } from '@/features/education/certificate'
import { ProgramForm } from '@/features/education/program-form'
import { ProgramSchedule } from '@/features/education/program-schedule'
import { ehImagem } from '@/lib/education/certificate'
import { currency, decimal, duration, longDate, percent, relativeDay } from '@/lib/format'
import { cn, today } from '@/lib/utils'

/**
 * Módulos recolhidos deste curso.
 *
 * A escolha fica no navegador, por curso: num curso de quarenta módulos, ter de
 * recolher tudo de novo a cada visita anularia o ganho de poder recolher.
 */
function useCollapsedModules(programId: string | undefined) {
  const chave = `life:curso:${programId}:modulos-recolhidos`

  const [recolhidos, setRecolhidos] = useState<Set<string>>(() => {
    try {
      const guardado = localStorage.getItem(chave)
      return new Set<string>(guardado ? (JSON.parse(guardado) as string[]) : [])
    } catch {
      return new Set<string>()
    }
  })

  const gravar = useCallback(
    (proximo: Set<string>) => {
      setRecolhidos(proximo)
      try {
        localStorage.setItem(chave, JSON.stringify([...proximo]))
      } catch {
        // Sem armazenamento a escolha vale só nesta sessão.
      }
    },
    [chave],
  )

  const alternar = useCallback(
    (nome: string) => {
      const proximo = new Set<string>(recolhidos)
      if (proximo.has(nome)) proximo.delete(nome)
      else proximo.add(nome)
      gravar(proximo)
    },
    [recolhidos, gravar],
  )

  return {
    recolhidos,
    alternar,
    recolherTudo: (nomes: string[]) => gravar(new Set<string>(nomes)),
    expandirTudo: () => gravar(new Set<string>()),
  }
}

export function CourseDetail() {
  const { programId } = useParams<{ programId: string }>()
  const { data: programs, update: updateProgram } = usePrograms()
  const { data: allLessons, create, update, remove } = useCourseLessons()
  const { data: institutions, create: createInstitution } = useInstitutions()
  const { data: notes } = useNotes()

  const [editing, setEditing] = useState(false)
  const [adding, setAdding] = useState(false)
  const { recolhidos, alternar, recolherTudo, expandirTudo } = useCollapsedModules(programId)

  const program = programs.find((p) => p.id === programId)
  const lessons = useMemo(
    () =>
      allLessons
        .filter((l) => l.program_id === programId)
        .sort((a, b) => a.position - b.position),
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
  const pct = lessons.length ? (done.length / lessons.length) * 100 : 0
  const minutesLeft = lessons.filter((l) => !l.done).reduce((sum, l) => sum + l.duration_min, 0)
  const institution = institutions.find((i) => i.id === program.institution_id)
  const programNotes = notes.filter((n) => n.program_id === program.id)
  const nextLesson = lessons.find((l) => !l.done)
  const pace = requiredPace(lessons.length - done.length, program.expected_end)

  const modules = groupByModule(lessons)
  const tudoRecolhido = modules.length > 0 && modules.every(([nome]) => recolhidos.has(nome))

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
          <h1 className="text-fg text-xl font-semibold">{program.name}</h1>
          <p className="text-fg-muted mt-1 text-sm">
            {[institution?.name, program.instructor, PROGRAM_STATUS_LABELS[program.status]]
              .filter(Boolean)
              .join(' · ')}
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
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent>
            <Stat
              label="Progresso"
              value={percent(pct, 0)}
              hint={`${done.length} de ${lessons.length} aulas`}
            />
            <Progress className="mt-3" value={pct} />
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <Stat
              label="Tempo restante"
              value={minutesLeft ? duration(minutesLeft) : '—'}
              hint={minutesLeft ? 'Somando as aulas que faltam' : 'Nada pendente'}
            />
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <Stat
              label="Ritmo necessário"
              value={pace ? decimal(pace.perDay, 1) : '—'}
              unit={pace ? 'aulas/dia' : undefined}
              hint={
                pace
                  ? `Para terminar até ${longDate(program.expected_end!)} (${relativeDay(program.expected_end!)})`
                  : 'Defina um prazo no curso'
              }
              tone={pace && pace.perDay > 4 ? 'negative' : undefined}
            />
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <Stat
              label="Custo"
              value={program.cost ? currency(program.cost) : '—'}
              hint={program.cost ? 'Vai virar despesa no financeiro' : 'Sem custo informado'}
            />
          </CardContent>
        </Card>
      </div>

      {nextLesson && (
        <Card className="bg-accent-soft border-transparent">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
            <div>
              <p className="text-accent text-[11px] font-medium tracking-wide uppercase">
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

      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-fg text-base font-semibold">Aulas</h2>
        <div className="flex gap-2">
          {modules.length > 1 && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => (tudoRecolhido ? expandirTudo() : recolherTudo(modules.map(([nome]) => nome)))}
            >
              {tudoRecolhido ? <ChevronsUpDown /> : <ChevronsDownUp />}
              {tudoRecolhido ? 'Expandir tudo' : 'Recolher tudo'}
            </Button>
          )}
          <Button size="sm" onClick={() => setAdding(true)}>
            <ListPlus />
            Adicionar aulas
          </Button>
        </div>
      </div>

      {lessons.length === 0 ? (
        <Card>
          <EmptyState
            title="Nenhuma aula cadastrada"
            description="Cole a lista de aulas do curso de uma vez — uma por linha — e o progresso passa a ser calculado sozinho."
            action={
              <Button size="sm" onClick={() => setAdding(true)}>
                Adicionar aulas
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {modules.map(([moduleName, items]) => {
            const moduleDone = items.filter((l) => l.done).length
            const aberto = !recolhidos.has(moduleName)
            const minutos = items.filter((l) => !l.done).reduce((s, l) => s + l.duration_min, 0)

            return (
              <Card key={moduleName}>
                {/* O cabeçalho inteiro é o gatilho: em curso com trinta módulos,
                    mirar numa setinha de 14 px é trabalho desnecessário. */}
                <button
                  type="button"
                  onClick={() => alternar(moduleName)}
                  aria-expanded={aberto}
                  className="hover:bg-surface-2 flex w-full items-center gap-3 rounded-[var(--radius-card)] px-5 py-4 text-left transition-colors"
                >
                  <ChevronRight
                    className={cn(
                      'text-fg-subtle size-4 shrink-0 transition-transform',
                      aberto && 'rotate-90',
                    )}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="text-fg block truncate text-sm font-semibold">
                      {moduleName || 'Sem módulo'}
                    </span>
                    <span className="text-fg-muted mt-0.5 block text-xs">
                      {moduleDone} de {items.length} aulas
                      {minutos > 0 && ` · faltam ${duration(minutos)}`}
                    </span>
                  </span>
                  <Progress
                    value={(moduleDone / items.length) * 100}
                    tone={moduleDone === items.length ? 'positive' : 'accent'}
                    className="hidden w-24 shrink-0 sm:block"
                  />
                  <Badge tone={moduleDone === items.length ? 'positive' : 'neutral'}>
                    {percent((moduleDone / items.length) * 100, 0)}
                  </Badge>
                </button>

                {aberto && (
                  <CardContent className="border-border-base border-t pt-3">
                    <div className="divide-border-base divide-y">
                      {items.map((lesson) => (
                        <div key={lesson.id} className="flex items-center gap-3 py-2">
                          <input
                            type="checkbox"
                            checked={lesson.done}
                            onChange={(e) =>
                              update.mutate({ id: lesson.id, patch: { done: e.target.checked } })
                            }
                            className="accent-accent size-4 shrink-0 cursor-pointer"
                            aria-label={`Concluir ${lesson.title}`}
                          />
                          <span
                            className={
                              lesson.done
                                ? 'text-fg-subtle flex-1 truncate text-sm line-through'
                                : 'text-fg flex-1 truncate text-sm'
                            }
                          >
                            {lesson.title}
                          </span>
                          {lesson.duration_min > 0 && (
                            <span className="text-fg-subtle text-[11px]">
                              {duration(lesson.duration_min)}
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => remove.mutate(lesson.id)}
                            className="text-fg-subtle hover:text-negative transition-colors"
                            aria-label={`Remover ${lesson.title}`}
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                )}
              </Card>
            )
          })}
        </div>
      )}

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
        <BulkLessonForm
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

/**
 * Adiciona várias aulas de uma vez: copiar o índice do curso e colar aqui é
 * infinitamente mais rápido que cadastrar aula por aula em formulário.
 */
function BulkLessonForm({
  startPosition,
  onClose,
  onSave,
}: {
  startPosition: number
  onClose: () => void
  onSave: (moduleName: string, titles: string[], duration: number) => Promise<void>
}) {
  const [moduleName, setModuleName] = useState('')
  const [text, setText] = useState('')
  const [minutes, setMinutes] = useState('10')

  const titles = text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  return (
    <Modal
      open
      onClose={onClose}
      title="Adicionar aulas"
      description="Uma aula por linha. Numeração no começo da linha é removida automaticamente."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            disabled={titles.length === 0}
            onClick={() =>
              void onSave(
                moduleName.trim() || 'Geral',
                titles.map(stripNumbering),
                Number(minutes) || 0,
              )
            }
          >
            Adicionar {titles.length > 0 ? `${titles.length} aula${titles.length > 1 ? 's' : ''}` : ''}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Módulo" hint="Agrupa as aulas na listagem.">
            <Input
              autoFocus
              value={moduleName}
              placeholder="Fundamentos"
              onChange={(e) => setModuleName(e.target.value)}
            />
          </Field>
          <Field label="Duração de cada aula" suffix="min">
            <Input
              inputMode="numeric"
              value={minutes}
              onChange={(e) => setMinutes(e.target.value)}
            />
          </Field>
        </div>

        <Field label="Aulas">
          <Textarea
            className="min-h-48 font-mono text-xs"
            value={text}
            placeholder={'1. Introdução\n2. Instalando o ambiente\n3. Primeiro projeto'}
            onChange={(e) => setText(e.target.value)}
          />
        </Field>

        {titles.length > 0 && (
          <p className="text-fg-subtle text-xs">
            {titles.length} aula{titles.length > 1 ? 's' : ''} a partir da posição{' '}
            {startPosition + 1}.
          </p>
        )}
      </div>
    </Modal>
  )
}

function stripNumbering(line: string): string {
  return line.replace(/^\s*\d+[.)\-–]\s*/, '').trim() || line
}

function groupByModule(
  lessons: Array<{ module: string; position: number; id: string; title: string; done: boolean; duration_min: number }>,
) {
  const map = new Map<string, typeof lessons>()
  for (const lesson of lessons) {
    const list = map.get(lesson.module) ?? []
    list.push(lesson)
    map.set(lesson.module, list)
  }
  return [...map.entries()]
}

/** Aulas por dia necessárias para terminar até o prazo. */
function requiredPace(remaining: number, deadline: string | null): { perDay: number } | null {
  if (!deadline || remaining <= 0) return null
  const days = Math.ceil(
    (new Date(`${deadline}T12:00:00`).getTime() - new Date(`${today()}T12:00:00`).getTime()) /
      86_400_000,
  )
  if (days <= 0) return { perDay: remaining }
  return { perDay: Math.ceil((remaining / days) * 10) / 10 }
}
