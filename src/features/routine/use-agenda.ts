import { useMemo } from 'react'
import {
  useAccounts,
  useActivityTypes,
  useAssessments,
  useDeadlines,
  useRecurring,
  useSessions,
  useSubjects,
  useTransactions,
} from '@/data/queries'
import {
  assessmentEvents,
  billEvents,
  classEvents,
  deadlineEvents,
  groupByDay,
  invoiceEvents,
  recurringEvents,
  sortAgenda,
  workoutEvents,
  type AgendaEvent,
} from '@/lib/calendar/agenda'

/**
 * Monta a agenda do intervalo pedido juntando as cinco origens.
 *
 * O intervalo é parâmetro em vez de fixo no mês: o dashboard pede sete dias, a
 * tela do mês pede seis semanas, e nenhum dos dois precisa carregar o resto.
 */
export function useAgenda(from: string, to: string) {
  const { data: subjects } = useSubjects()
  const { data: deadlines } = useDeadlines()
  const { data: assessments } = useAssessments()
  const { data: sessions } = useSessions()
  const { data: activities } = useActivityTypes()
  const { data: transactions } = useTransactions()
  const { data: accounts } = useAccounts()
  const { data: recurring } = useRecurring()

  return useMemo(() => {
    const subjectById = new Map(subjects.map((s) => [s.id, s]))
    const activityName = (id: string) =>
      activities.find((a) => a.id === id)?.name ?? 'Treino'

    const events = sortAgenda([
      ...classEvents(subjects, from, to),
      ...deadlineEvents(
        deadlines.filter((d) => d.date >= from && d.date <= to),
        (id) => (id ? (subjectById.get(id)?.name ?? null) : null),
      ),
      ...assessmentEvents(
        assessments.filter((a) => a.date !== null && a.date >= from && a.date <= to),
        (id) => {
          const found = subjectById.get(id)
          return found ? { name: found.name, program_id: found.program_id } : null
        },
      ),
      ...workoutEvents(
        sessions.filter((s) => s.date >= from && s.date <= to),
        activityName,
      ),
      ...billEvents(transactions, accounts, from, to),
      ...invoiceEvents(accounts, transactions, from, to),
      ...recurringEvents(recurring, from, to),
    ])

    return { events, byDay: groupByDay(events) }
  }, [subjects, deadlines, assessments, sessions, activities, transactions, accounts, recurring, from, to])
}

export type { AgendaEvent }
