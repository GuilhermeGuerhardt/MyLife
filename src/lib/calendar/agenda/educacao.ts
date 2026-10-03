/**
 * Faculdade e cursos na agenda: aula, prova, entrega e as datas do curso.
 */

import { eachDay, weekdayOf } from '@/lib/dates'
import type { AgendaEvent, AgendaSource } from './tipos'

// ---------------------------------------------------------------------------
// Aulas — a grade semanal projetada sobre o intervalo
// ---------------------------------------------------------------------------

export interface SubjectLike {
  id: string
  program_id: string
  name: string
  status: string
  weekday: number | null
  start_time: string | null
  end_time: string | null
  room: string | null
}

/**
 * Só disciplinas em curso geram aula: uma matéria concluída no semestre
 * passado ainda tem dia e horário cadastrados, e projetá-la encheria a agenda
 * de aulas que não existem mais.
 */
export function classEvents(subjects: SubjectLike[], from: string, to: string): AgendaEvent[] {
  const active = subjects.filter((s) => s.status === 'doing' && s.weekday !== null)
  if (active.length === 0) return []

  const events: AgendaEvent[] = []
  for (const date of eachDay(from, to)) {
    const weekday = weekdayOf(date)
    for (const subject of active) {
      if (subject.weekday !== weekday) continue
      events.push({
        id: `class:${subject.id}:${date}`,
        date,
        time: subject.start_time,
        endTime: subject.end_time,
        title: subject.name,
        detail: subject.room ? `Sala ${subject.room}` : null,
        source: 'class',
        area: 'education',
        href: `/faculdade/${subject.program_id}`,
        done: false,
      })
    }
  }
  return events
}

export interface DeadlineLike {
  id: string
  title: string
  kind: 'prova' | 'trabalho' | 'entrega' | 'aula'
  start_date?: string | null
  date: string
  done: boolean
  program_id: string | null
  subject_id: string | null
  notes: string | null
}

/**
 * Provas, entregas e tudo que foi marcado à mão.
 *
 * Compromisso com data de início vira dois marcos no calendário — o dia em que
 * começa e o dia em que vence. Pintar todos os dias entre os dois encheria a
 * grade do mês: um trabalho de três semanas apagaria o resto da vida da pessoa
 * embaixo dele. As duas pontas são o que se precisa enxergar.
 *
 * `programHref` recebe o id do curso e devolve a rota certa: faculdade e curso
 * livre moram em telas diferentes.
 */
export function deadlineEvents(
  deadlines: DeadlineLike[],
  subjectName: (id: string | null) => string | null,
  programHref?: (id: string) => string | null,
): AgendaEvent[] {
  const events: AgendaEvent[] = []

  for (const deadline of deadlines) {
    const href = deadline.program_id
      ? (programHref?.(deadline.program_id) ?? `/faculdade/${deadline.program_id}`)
      : null
    const source: AgendaSource =
      deadline.kind === 'prova' ? 'exam' : deadline.kind === 'aula' ? 'class' : 'assignment'
    const detail = subjectName(deadline.subject_id) ?? deadline.notes

    const temInicio = Boolean(deadline.start_date && deadline.start_date !== deadline.date)

    if (temInicio) {
      events.push({
        id: `deadline-start:${deadline.id}`,
        date: deadline.start_date!,
        time: null,
        endTime: null,
        title: deadline.title,
        detail: detail ? `Início · ${detail}` : 'Início',
        source,
        area: 'education',
        href,
        done: deadline.done,
      })
    }

    events.push({
      id: `deadline:${deadline.id}`,
      date: deadline.date,
      time: null,
      endTime: null,
      title: deadline.title,
      detail: temInicio ? (detail ? `Entrega · ${detail}` : 'Entrega') : detail,
      source,
      area: 'education',
      href,
      done: deadline.done,
    })
  }

  return events
}

export interface AssessmentLike {
  id: string
  subject_id: string
  name: string
  date: string | null
  grade: number | null
}

/**
 * Avaliação com data vira compromisso — e some da agenda quando a nota chega:
 * prova feita não é mais prazo, é histórico.
 */
export function assessmentEvents(
  assessments: AssessmentLike[],
  subject: (id: string) => { name: string; program_id: string } | null,
  programHref?: (id: string) => string | null,
): AgendaEvent[] {
  return assessments
    .filter((item) => item.date !== null && item.grade === null)
    .map((item) => {
      const info = subject(item.subject_id)
      return {
        id: `assessment:${item.id}`,
        date: item.date!,
        time: null,
        endTime: null,
        title: info ? `${item.name} · ${info.name}` : item.name,
        detail: 'Avaliação sem nota lançada',
        source: 'exam' as const,
        area: 'education' as const,
        href: info
          ? (programHref?.(info.program_id) ?? `/faculdade/${info.program_id}`)
          : null,
        done: false,
      }
    })
}

// ---------------------------------------------------------------------------
// Faculdade e cursos: início e término
// ---------------------------------------------------------------------------

export interface ProgramLike {
  id: string
  name: string
  track: 'academic' | 'course'
  status: string
  start_date: string | null
  expected_end: string | null
}

/**
 * Marcos de cada curso e graduação.
 *
 * Abandonado fica de fora: a data de término prevista de algo que a pessoa
 * largou não é um compromisso, é lembrança ruim. Concluído continua aparecendo,
 * já riscado — some do "próximos" e permanece no histórico do mês.
 */
export function programEvents(programs: ProgramLike[], from: string, to: string): AgendaEvent[] {
  const events: AgendaEvent[] = []

  for (const program of programs) {
    if (program.status === 'dropped') continue
    const href = program.track === 'academic' ? `/faculdade/${program.id}` : `/cursos/${program.id}`

    if (program.start_date && program.start_date >= from && program.start_date <= to) {
      events.push({
        id: `program-start:${program.id}`,
        date: program.start_date,
        time: null,
        endTime: null,
        title: program.name,
        detail: 'Início',
        source: 'term',
        area: 'education',
        href,
        done: program.status !== 'planned',
      })
    }

    if (program.expected_end && program.expected_end >= from && program.expected_end <= to) {
      events.push({
        id: `program-end:${program.id}`,
        date: program.expected_end,
        time: null,
        endTime: null,
        title: program.name,
        detail: program.status === 'done' ? 'Concluído' : 'Término previsto',
        source: 'term',
        area: 'education',
        href,
        done: program.status === 'done',
      })
    }
  }

  return events
}
