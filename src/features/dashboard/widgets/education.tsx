/** Widgets de estudo: faculdade e cursos em andamento. */

import { ArrowRight, PlayCircle } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Progress } from '@/components/ui/misc'
import { useEducation } from '@/features/education/use-education'
import { integer } from '@/lib/format'

export function StudiesWidget() {
  const academic = useEducation('academic')
  const courses = useEducation('course')

  const studying = [...academic.summaries, ...courses.summaries]
    .filter((item) => item.program.status === 'active')
    .slice(0, 4)

  return (
    <Card className="accent-education h-full">
      <CardHeader
        title="Estudos"
        description={studying.length ? `${studying.length} em andamento` : 'Nada em andamento'}
        action={
          <Link to="/faculdade">
            <Button variant="ghost" size="sm">
              <ArrowRight />
            </Button>
          </Link>
        }
      />
      <CardContent className="space-y-4">
        {studying.length === 0 ? (
          <div className="space-y-3">
            <p className="text-fg-muted text-sm">
              Cadastre sua faculdade ou um curso para acompanhar progresso, notas e faltas.
            </p>
            <div className="flex gap-2">
              <Link to="/faculdade">
                <Button size="sm" variant="secondary">
                  Faculdade
                </Button>
              </Link>
              <Link to="/cursos">
                <Button size="sm" variant="secondary">
                  Cursos
                </Button>
              </Link>
            </div>
          </div>
        ) : (
          studying.map((item) => (
            <Link
              key={item.program.id}
              to={`${item.program.track === 'academic' ? '/faculdade' : '/cursos'}/${item.program.id}`}
              className="block space-y-1.5"
            >
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-fg truncate text-sm font-medium">{item.program.name}</span>
                <span className="text-fg-muted shrink-0 text-xs">{integer(item.percent)}%</span>
              </div>
              <Progress value={item.percent} />
              <p className="text-fg-subtle text-[11px]">
                {item.program.track === 'academic'
                  ? `${integer(item.progress.hoursDone)} de ${integer(item.progress.hoursTotal)} h · faltam ${item.progress.remaining.length} disciplinas`
                  : `${item.lessonsDone} de ${item.lessons.length} aulas concluídas`}
              </p>
            </Link>
          ))
        )}
      </CardContent>
    </Card>
  )
}

export function NextLessonWidget() {
  const courses = useEducation('course')
  const next = nextLesson(courses.summaries)

  if (!next) {
    return (
      <Card className="accent-courses h-full">
        <CardHeader title="Próxima aula" description="Nenhum curso em andamento" />
        <CardContent>
          <p className="text-fg-muted text-sm">
            Cadastre as aulas de um curso e o app aponta sempre a próxima.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="accent-courses h-full">
      <CardHeader title="Próxima aula" description={next.programName} />
      <CardContent className="space-y-3">
        <div className="flex items-start gap-2.5">
          <PlayCircle className="text-accent mt-0.5 size-4 shrink-0" />
          <div className="min-w-0">
            <p className="text-fg truncate text-sm font-medium">{next.lesson.title}</p>
            <p className="text-fg-subtle text-[11px]">
              {next.lesson.module} · {next.lesson.duration_min} min
            </p>
          </div>
        </div>
        <Progress value={next.percent} />
        <Link to={`/cursos/${next.programId}`}>
          <Button size="sm" variant="secondary">
            Continuar
          </Button>
        </Link>
      </CardContent>
    </Card>
  )
}

type CourseSummary = ReturnType<typeof useEducation>['summaries'][number]

interface NextLesson {
  programId: string
  programName: string
  percent: number
  lesson: CourseSummary['lessons'][number]
}

/**
 * A primeira aula não concluída do curso mais avançado em andamento — quem
 * está no meio de um curso volta para ele, não para o primeiro da lista
 * alfabética.
 */
function nextLesson(summaries: CourseSummary[]): NextLesson | null {
  const candidates = summaries
    .filter((item) => item.program.status === 'active' && item.lessons.length > 0)
    .sort((a, b) => b.percent - a.percent)

  for (const item of candidates) {
    const lesson = [...item.lessons].sort((a, b) => a.position - b.position).find((l) => !l.done)
    if (lesson) {
      return {
        programId: item.program.id,
        programName: item.program.name,
        percent: item.percent,
        lesson,
      }
    }
  }

  return null
}
