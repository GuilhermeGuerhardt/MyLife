import { useMemo } from 'react'
import {
  useAccounts,
  useActivityTypes,
  useAssessments,
  useDeadlines,
  useDietPlans,
  useGoals,
  usePrograms,
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
  dietPlanEvents,
  goalEvents,
  groupByDay,
  invoiceEvents,
  programEvents,
  recurringEvents,
  sortAgenda,
  workoutEvents,
  type AgendaEvent,
} from '@/lib/calendar/agenda'

/**
 * Monta a agenda do intervalo pedido juntando todas as origens do app.
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
  const { data: goals } = useGoals()
  const { data: programs } = usePrograms()
  const { data: dietPlans } = useDietPlans()

  return useMemo(() => {
    const subjectById = new Map(subjects.map((s) => [s.id, s]))
    const activityName = (id: string) =>
      activities.find((a) => a.id === id)?.name ?? 'Treino'

    // Faculdade e curso livre têm telas diferentes: o link do evento precisa
    // saber de qual trilha o curso é para não jogar todo mundo em /faculdade.
    const programHref = (id: string) => {
      const program = programs.find((p) => p.id === id)
      if (!program) return null
      return program.track === 'course' ? `/cursos/${id}` : `/faculdade/${id}`
    }

    const events = sortAgenda([
      ...classEvents(subjects, from, to),
      ...deadlineEvents(
        // Uma das duas pontas dentro do intervalo basta: um trabalho que começa
        // neste mês e vence no próximo tem de aparecer nos dois.
        deadlines.filter((d) => {
          const inicio = d.start_date ?? d.date
          return (inicio >= from && inicio <= to) || (d.date >= from && d.date <= to)
        }),
        (id) => (id ? (subjectById.get(id)?.name ?? null) : null),
        programHref,
        // O marco da outra ponta pode cair fora da janela pedida; ele volta
        // quando o mês dele for aberto.
      ).filter((event) => event.date >= from && event.date <= to),
      ...assessmentEvents(
        assessments.filter((a) => a.date !== null && a.date >= from && a.date <= to),
        (id) => {
          const found = subjectById.get(id)
          return found ? { name: found.name, program_id: found.program_id } : null
        },
        programHref,
      ),
      ...workoutEvents(
        sessions.filter((s) => s.date >= from && s.date <= to),
        activityName,
      ),
      ...billEvents(transactions, accounts, from, to),
      ...invoiceEvents(accounts, transactions, from, to),
      ...recurringEvents(recurring, from, to),
      ...goalEvents(goals, from, to),
      ...programEvents(programs, from, to),
      ...dietPlanEvents(dietPlans, from, to),
    ])

    return { events, byDay: groupByDay(events) }
  }, [
    subjects,
    deadlines,
    assessments,
    sessions,
    activities,
    transactions,
    accounts,
    recurring,
    goals,
    programs,
    dietPlans,
    from,
    to,
  ])
}

export type { AgendaEvent }
