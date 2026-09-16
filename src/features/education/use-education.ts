import { useMemo } from 'react'
import {
  useCourseLessons,
  useDeadlines,
  useInstitutions,
  useNotes,
  usePrograms,
  useSubjects,
} from '@/data/queries'
import type { Program, ProgramTrack } from '@/data/types'
import { academicIndex, programProgress, type SubjectLike } from '@/lib/education/academics'

/**
 * Junta programas, disciplinas e aulas num resumo por curso — evita recalcular
 * progresso em cada card e mantém a regra num lugar só.
 */
export function useEducation(track: ProgramTrack) {
  const { data: programs, ...programOps } = usePrograms()
  const { data: subjects } = useSubjects()
  const { data: lessons } = useCourseLessons()
  const { data: institutions } = useInstitutions()
  const { data: notes } = useNotes()
  const { data: deadlines } = useDeadlines()

  return useMemo(() => {
    const inTrack = programs.filter((p) => p.track === track)

    const summaries = inTrack.map((program) => {
      const programSubjects = subjects.filter((s) => s.program_id === program.id)
      const programLessons = lessons.filter((l) => l.program_id === program.id)

      // Compromisso vinculado a uma disciplina também é do curso: quem marcou
      // a prova dentro da matéria não deveria precisar marcá-la de novo aqui.
      const subjectIds = new Set(programSubjects.map((s) => s.id))
      const tasks = deadlines.filter(
        (d) => d.program_id === program.id || (d.subject_id && subjectIds.has(d.subject_id)),
      )
      const tasksDone = tasks.filter((d) => d.done).length

      const progress = programProgress(programSubjects as SubjectLike[], program)
      const lessonsDone = programLessons.filter((l) => l.done).length

      // Curso livre mede progresso por aulas concluídas; faculdade, por carga horária.
      const percent =
        track === 'course' && programLessons.length > 0
          ? Math.round((lessonsDone / programLessons.length) * 1000) / 10
          : progress.percent

      return {
        program,
        institution: institutions.find((i) => i.id === program.institution_id) ?? null,
        subjects: programSubjects,
        lessons: programLessons,
        lessonsDone,
        progress,
        percent,
        tasks,
        tasksDone,
        tasksPercent: tasks.length ? (tasksDone / tasks.length) * 100 : 0,
        index: academicIndex(programSubjects as SubjectLike[]),
        noteCount: notes.filter((n) => n.program_id === program.id).length,
      }
    })

    return {
      programs: inTrack,
      institutions: institutions.filter((i) => i.track === track),
      summaries: summaries.sort((a, b) => statusRank(a.program) - statusRank(b.program)),
      ...programOps,
    }
  }, [programs, subjects, lessons, institutions, notes, deadlines, track, programOps])
}

/** Em andamento primeiro, abandonado por último. */
function statusRank(program: Program): number {
  const order = { active: 0, planned: 1, paused: 2, done: 3, dropped: 4 }
  return order[program.status] ?? 9
}
