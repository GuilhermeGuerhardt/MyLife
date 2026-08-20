import { useMemo } from 'react'
import {
  useCategories,
  useCourseLessons,
  useDailyMetrics,
  useDeadlines,
  useHabitLogs,
  useMealLogs,
  useMeasurements,
  useSessions,
  useTransactions,
} from '@/data/queries'
import { addDays, today, weekStart } from '@/lib/dates'
import { generateInsights, weeklyReview } from '@/lib/insights/insights'
import { buildWeeks } from '@/lib/insights/weeks'

/**
 * Monta a série semanal e roda as regras de insight sobre ela.
 *
 * O padrão de 16 semanas é o equilíbrio entre ter amostra suficiente para as
 * travas das regras e não comparar quem você é hoje com quem você era no ano
 * passado.
 */
export function useInsights(weeksBack = 16) {
  const { data: sessions } = useSessions()
  const { data: metrics } = useDailyMetrics()
  const { data: measurements } = useMeasurements()
  const { data: mealLogs } = useMealLogs()
  const { data: transactions } = useTransactions()
  const { data: deadlines } = useDeadlines()
  const { data: lessons } = useCourseLessons()
  const { data: habitLogs } = useHabitLogs()
  const { data: categories } = useCategories()

  return useMemo(() => {
    const to = today()
    const from = weekStart(addDays(to, -(weeksBack * 7 - 1)))

    const weeks = buildWeeks(
      {
        sessions,
        metrics,
        measurements,
        mealLogs,
        transactions,
        deadlines,
        // A aula não guarda data de conclusão; `updated_at` é quando ela foi
        // marcada, que é exatamente o momento em que o estudo aconteceu.
        lessons: lessons
          .filter((lesson) => lesson.done)
          .map((lesson) => ({ date: (lesson.updated_at ?? lesson.created_at).slice(0, 10) })),
        habitLogs,
      },
      from,
      to,
    )

    const categoryName = (id: string | null) =>
      id ? (categories.find((category) => category.id === id)?.name ?? null) : null

    return {
      weeks,
      review: weeklyReview(weeks),
      insights: generateInsights(weeks, categoryName),
      /** Semanas que têm algum registro — é o que a tela mostra como amostra. */
      weeksWithData: weeks.filter(
        (week) =>
          week.workouts > 0 ||
          week.expenseCents > 0 ||
          week.habitLogs > 0 ||
          week.mood !== null ||
          week.weightAvg !== null,
      ).length,
    }
  }, [
    sessions,
    metrics,
    measurements,
    mealLogs,
    transactions,
    deadlines,
    lessons,
    habitLogs,
    categories,
    weeksBack,
  ])
}
