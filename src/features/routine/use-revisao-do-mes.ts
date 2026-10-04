import { useMemo } from 'react'
import {
  useCourseLessons,
  useDailyMetrics,
  useDeadlines,
  useHabitLogs,
  useMealLogs,
  useMeasurements,
  useSessions,
  useStudySessions,
  useTasks,
  useTransactions,
} from '@/data/queries'
import type { Competence } from '@/lib/finance/billing'
import { revisaoDoMes } from '@/lib/insights/revisao-do-mes'
import { today } from '@/lib/utils'

/** Junta o que cada módulo tem e entrega a revisão do mês pronta. */
export function useRevisaoDoMes(competence: Competence) {
  const { data: transacoes } = useTransactions()
  const { data: treinos } = useSessions()
  const { data: metricas } = useDailyMetrics()
  const { data: medidas } = useMeasurements()
  const { data: refeicoes } = useMealLogs()
  const { data: estudo } = useStudySessions()
  const { data: prazos } = useDeadlines()
  const { data: registrosDeHabito } = useHabitLogs()
  const { data: tarefas } = useTasks()
  const { data: aulas } = useCourseLessons()

  return useMemo(
    () =>
      revisaoDoMes(
        {
          transacoes,
          treinos,
          metricas,
          medidas,
          refeicoes,
          estudo,
          prazos,
          registrosDeHabito,
          // Tarefa e aula não guardam quando foram concluídas. O `updated_at` é
          // o momento em que foram marcadas, que é o que a revisão quer saber; o
          // mesmo critério dos Insights.
          tarefasFeitas: tarefas
            .filter((tarefa) => tarefa.done)
            .map((tarefa) => ({ date: (tarefa.updated_at ?? tarefa.created_at).slice(0, 10) })),
          aulasFeitas: aulas
            .filter((aula) => aula.done)
            .map((aula) => ({ date: (aula.updated_at ?? aula.created_at).slice(0, 10) })),
        },
        competence,
        today(),
      ),
    [
      transacoes,
      treinos,
      metricas,
      medidas,
      refeicoes,
      estudo,
      prazos,
      registrosDeHabito,
      tarefas,
      aulas,
      competence,
    ],
  )
}
