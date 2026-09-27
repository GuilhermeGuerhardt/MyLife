/**
 * A tarefa avulsa na agenda, com o prazo que ela tiver.
 */

import type { AgendaEvent } from './tipos'

// ---------------------------------------------------------------------------
// Provas e entregas
// ---------------------------------------------------------------------------

export interface TaskLike {
  id: string
  title: string
  done: boolean
  /** Só entra na agenda a tarefa que tem prazo. */
  date: string | null
}

/**
 * A tarefa com prazo, no dia dela.
 *
 * Sem prazo não entra: a agenda é uma linha do tempo, e "algum dia" não tem
 * onde ser desenhado. Essas ficam só na lista, que é o lugar delas.
 */
export function taskEvents(tasks: TaskLike[], from: string, to: string): AgendaEvent[] {
  return tasks
    .filter((task) => task.date !== null && task.date >= from && task.date <= to)
    .map((task) => ({
      id: `task:${task.id}`,
      date: task.date!,
      time: null,
      endTime: null,
      title: task.title,
      detail: null,
      source: 'task' as const,
      area: 'routine' as const,
      href: '/rotina/tarefas',
      done: task.done,
    }))
}
