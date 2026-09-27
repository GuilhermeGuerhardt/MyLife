/**
 * O que se pergunta depois de juntar tudo: ordenar, agrupar por dia, listar o
 * que vem a seguir e dizer qual intervalo a tela do mês precisa carregar.
 */

import { addDays, weekdayOf } from '@/lib/dates'
import type { AgendaEvent } from './tipos'

// ---------------------------------------------------------------------------
// Junção
// ---------------------------------------------------------------------------

export function sortAgenda(events: AgendaEvent[]): AgendaEvent[] {
  return [...events].sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date)
    // Compromisso do dia inteiro vem antes dos que têm hora marcada.
    if (a.time === null && b.time !== null) return -1
    if (a.time !== null && b.time === null) return 1
    if (a.time && b.time && a.time !== b.time) return a.time.localeCompare(b.time)
    return a.title.localeCompare(b.title, 'pt-BR')
  })
}

export function groupByDay(events: AgendaEvent[]): Map<string, AgendaEvent[]> {
  const map = new Map<string, AgendaEvent[]>()
  for (const event of sortAgenda(events)) {
    const list = map.get(event.date)
    if (list) list.push(event)
    else map.set(event.date, [event])
  }
  return map
}

/** Os próximos compromissos a partir de uma data, ignorando o que já passou. */
export function upcoming(events: AgendaEvent[], from: string, limit = 5): AgendaEvent[] {
  return sortAgenda(events)
    .filter((event) => event.date >= from && !event.done && event.source !== 'workout')
    .slice(0, limit)
}

/** Intervalo que a tela do mês precisa carregar (as 6 semanas visíveis). */
export function monthRange(competence: string): { from: string; to: string } {
  const [year, month] = competence.split('-').map(Number) as [number, number]
  const first = `${competence}-01`
  const last = `${competence}-${String(new Date(year, month, 0).getDate()).padStart(2, '0')}`
  return { from: addDays(first, -weekdayOf(first)), to: addDays(last, 6 - weekdayOf(last)) }
}
