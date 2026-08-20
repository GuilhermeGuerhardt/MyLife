import { useMemo } from 'react'
import { useDietPlans, useMealLogs, useMeasurements, useProfile, useSessions } from '@/data/queries'
import {
  basalMetabolicRate,
  bmi as calcBmi,
  bmiBand,
  healthyWeightRange,
  movingAverage,
  tdeeFromActivityLevel,
  tdeeFromSessions,
  trend,
} from '@/lib/health/formulas'
import { addDays, ageFromBirthdate, today } from '@/lib/utils'

/**
 * Consolida tudo que as telas de saúde precisam num único cálculo memoizado.
 * As telas ficam declarativas e a lógica não se espalha em cinco componentes.
 */
export function useHealthSummary() {
  const { profile } = useProfile()
  const { data: measurements } = useMeasurements()
  const { data: sessions } = useSessions()
  const { data: plans } = useDietPlans()
  const { data: mealLogs } = useMealLogs()

  return useMemo(() => {
    const age = profile?.birthdate ? ageFromBirthdate(profile.birthdate) : 25
    const heightCm = profile?.height_cm ?? 175
    const sex = profile?.sex ?? 'male'

    const weightSeries = movingAverage(
      measurements.map((m) => ({ date: m.date, value: m.weight_kg })),
      7,
    )
    const latest = weightSeries[weightSeries.length - 1]
    const currentWeight = latest?.average ?? null
    const rawWeight = latest?.value ?? null

    // Tendência dos últimos 30 dias, sempre sobre a média móvel.
    const monthAgo = addDays(today(), -30)
    const recent = weightSeries.filter((p) => p.date >= monthAgo)
    const weightTrend = trend(recent.map((p) => p.average))

    const weekStart = addDays(today(), -6)
    const weekSessions = sessions.filter((s) => s.date >= weekStart)
    const weekMinutes = weekSessions.reduce((sum, s) => sum + s.duration_min, 0)
    const weekCalories = weekSessions.reduce((sum, s) => sum + s.calories_estimated, 0)

    const bmr = currentWeight
      ? basalMetabolicRate({ weightKg: currentWeight, heightCm, ageYears: age, sex })
      : null

    // TDEE pelas sessões reais quando há treino registrado; senão, pelo fator declarado.
    const tdee = bmr
      ? weekSessions.length > 0
        ? tdeeFromSessions(
            bmr,
            weekSessions.map((s) => ({ caloriesEstimated: s.calories_estimated })),
            7,
          )
        : tdeeFromActivityLevel(bmr, profile?.activity_level ?? 'moderate')
      : null

    const activePlan = plans.filter((p) => p.status === 'active').at(-1) ?? null

    const todayLogs = mealLogs.filter((m) => m.date === today())
    const intake = todayLogs.reduce(
      (acc, log) => ({
        kcal: acc.kcal + log.kcal,
        protein: acc.protein + log.protein_g,
        carb: acc.carb + log.carb_g,
        fat: acc.fat + log.fat_g,
      }),
      { kcal: 0, protein: 0, carb: 0, fat: 0 },
    )

    return {
      profile,
      age,
      heightCm,
      sex,
      weightSeries,
      currentWeight,
      rawWeight,
      weightTrend,
      bmi: currentWeight ? calcBmi(currentWeight, heightCm) : null,
      bmiBand: currentWeight ? bmiBand(calcBmi(currentWeight, heightCm)) : null,
      healthyRange: healthyWeightRange(heightCm),
      bmr,
      tdee,
      sessions,
      weekSessions,
      weekMinutes,
      weekCalories,
      activePlan,
      intake,
      todayLogs,
      hasProfile: Boolean(profile?.birthdate && profile?.height_cm),
    }
  }, [profile, measurements, sessions, plans, mealLogs])
}
