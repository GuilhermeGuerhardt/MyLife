import { useMemo } from 'react'
import { useHabitLogs, useHabits } from '@/data/queries'
import type { Habit } from '@/data/types'
import { today } from '@/lib/dates'
import { habitStatus, heatmap, type HabitStatus, type HeatmapDay } from '@/lib/habits/habits'

export interface HabitBoardItem {
  habit: Habit
  dates: string[]
  status: HabitStatus
  weeks: HeatmapDay[][]
}

/**
 * Junta hábitos e registros num quadro pronto para a tela: cada hábito já vem
 * com sequência, meta da semana e heatmap calculados.
 */
export function useHabitBoard(heatmapDays = 182) {
  const { data: habits, create, update, remove, isLoading } = useHabits()
  const { data: logs, create: createLog, remove: removeLog } = useHabitLogs()

  const board = useMemo(() => {
    const day = today()

    const byHabit = new Map<string, string[]>()
    for (const log of logs) {
      const list = byHabit.get(log.habit_id)
      if (list) list.push(log.date)
      else byHabit.set(log.habit_id, [log.date])
    }

    const items: HabitBoardItem[] = habits
      .filter((habit) => !habit.archived)
      .sort((a, b) => a.position - b.position || a.name.localeCompare(b.name, 'pt-BR'))
      .map((habit) => {
        const dates = byHabit.get(habit.id) ?? []
        return {
          habit,
          dates,
          status: habitStatus(habit, dates, day),
          weeks: heatmap(dates, day, heatmapDays),
        }
      })

    const doneToday = items.filter((item) => item.status.doneToday).length

    return {
      items,
      archived: habits.filter((habit) => habit.archived),
      doneToday,
      // Sequência da rotina inteira, não de um hábito só.
      bestStreak: items.reduce((best, item) => Math.max(best, item.status.streak), 0),
      todayPercent: items.length > 0 ? Math.round((doneToday / items.length) * 100) : 0,
    }
  }, [habits, logs, heatmapDays])

  /** Marca ou desmarca o dia. O registro é binário: existe ou não existe. */
  const toggle = async (habitId: string, date: string) => {
    const existing = logs.find((log) => log.habit_id === habitId && log.date === date)
    if (existing) return removeLog.mutateAsync(existing.id)
    return createLog.mutateAsync({ habit_id: habitId, date })
  }

  const isDone = (habitId: string, date: string) =>
    logs.some((log) => log.habit_id === habitId && log.date === date)

  return { ...board, logs, isLoading, toggle, isDone, create, update, remove }
}
