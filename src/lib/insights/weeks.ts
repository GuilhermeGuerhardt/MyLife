/**
 * Agregação semanal dos módulos.
 *
 * A semana é a unidade certa para cruzar áreas da vida: o dia é ruído puro
 * (um treino a menos, uma pizza, uma noite mal dormida) e o mês esconde o que
 * mudou. Sete dias já cancelam a oscilação diária e ainda são curtos o
 * bastante para o padrão aparecer.
 *
 * Cada campo é `null` quando a semana não tem dado, e não `0` — "não registrei
 * o sono" é diferente de "dormi zero", e tratar os dois igual é o jeito mais
 * rápido de gerar uma conclusão falsa.
 */

import { addDays, weekStart } from '@/lib/dates'

export interface WeekInput {
  sessions: Array<{ date: string; duration_min: number; calories_estimated: number }>
  metrics: Array<{
    date: string
    sleep_hours: number | null
    mood: number | null
    energy: number | null
    steps: number | null
  }>
  measurements: Array<{ date: string; weight_kg: number }>
  mealLogs: Array<{ date: string; kcal: number }>
  transactions: Array<{
    date: string
    kind: 'income' | 'expense' | 'transfer'
    amount_cents: number
    category_id: string | null
  }>
  /** Provas e entregas com data — marcam as semanas de pressão acadêmica. */
  deadlines: Array<{ date: string; kind: string }>
  lessons: Array<{ date: string }>
  habitLogs: Array<{ date: string }>
}

export interface WeekStats {
  /** Domingo da semana. */
  start: string
  end: string
  workouts: number
  workoutMinutes: number
  sleepHours: number | null
  mood: number | null
  energy: number | null
  steps: number | null
  weightAvg: number | null
  /** Variação do peso médio em relação à semana anterior. Negativo = perdeu. */
  weightDelta: number | null
  kcalIn: number | null
  expenseCents: number
  expenseByCategory: Map<string | null, number>
  /** Provas e entregas na semana. */
  deadlines: number
  lessons: number
  habitLogs: number
}

function average(values: number[]): number | null {
  if (values.length === 0) return null
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

/** As semanas completas do intervalo, da mais antiga para a mais recente. */
export function buildWeeks(input: WeekInput, from: string, to: string): WeekStats[] {
  const weeks: WeekStats[] = []
  let previousWeight: number | null = null

  for (let start = weekStart(from); start <= to; start = addDays(start, 7)) {
    const end = addDays(start, 6)
    const within = (date: string) => date >= start && date <= end

    const sessions = input.sessions.filter((s) => within(s.date))
    const metrics = input.metrics.filter((m) => within(m.date))
    const weights = input.measurements.filter((m) => within(m.date)).map((m) => m.weight_kg)
    const meals = input.mealLogs.filter((m) => within(m.date))

    const expenseByCategory = new Map<string | null, number>()
    let expenseCents = 0
    for (const tx of input.transactions) {
      if (!within(tx.date) || tx.kind !== 'expense') continue
      expenseCents += tx.amount_cents
      expenseByCategory.set(
        tx.category_id,
        (expenseByCategory.get(tx.category_id) ?? 0) + tx.amount_cents,
      )
    }

    const weightAvg = average(weights)
    // O consumo diário só faz sentido dividido pelos dias com registro: quem
    // anotou três dias na semana não comeu 3/7 do normal.
    const daysWithMeals = new Set(meals.map((m) => m.date)).size
    const kcalIn =
      daysWithMeals > 0 ? meals.reduce((sum, m) => sum + m.kcal, 0) / daysWithMeals : null

    weeks.push({
      start,
      end,
      workouts: sessions.length,
      workoutMinutes: sessions.reduce((sum, s) => sum + s.duration_min, 0),
      sleepHours: average(metrics.map((m) => m.sleep_hours).filter(isNumber)),
      mood: average(metrics.map((m) => m.mood).filter(isNumber)),
      energy: average(metrics.map((m) => m.energy).filter(isNumber)),
      steps: average(metrics.map((m) => m.steps).filter(isNumber)),
      weightAvg,
      weightDelta: weightAvg !== null && previousWeight !== null ? weightAvg - previousWeight : null,
      kcalIn,
      expenseCents,
      expenseByCategory,
      deadlines: input.deadlines.filter((d) => within(d.date) && d.kind !== 'aula').length,
      lessons: input.lessons.filter((l) => within(l.date)).length,
      habitLogs: input.habitLogs.filter((h) => within(h.date)).length,
    })

    if (weightAvg !== null) previousWeight = weightAvg
  }

  return weeks
}

function isNumber(value: number | null): value is number {
  return value !== null && Number.isFinite(value)
}

/** Correlação de Pearson. `null` quando não há variação para correlacionar. */
export function pearson(pairs: Array<[number, number]>): number | null {
  const n = pairs.length
  if (n < 3) return null

  let sumX = 0
  let sumY = 0
  for (const [x, y] of pairs) {
    sumX += x
    sumY += y
  }
  const meanX = sumX / n
  const meanY = sumY / n

  let covariance = 0
  let varianceX = 0
  let varianceY = 0
  for (const [x, y] of pairs) {
    const dx = x - meanX
    const dy = y - meanY
    covariance += dx * dy
    varianceX += dx * dx
    varianceY += dy * dy
  }

  // Série constante não correlaciona com nada — devolver 0 sugeriria conclusão.
  if (varianceX === 0 || varianceY === 0) return null

  return covariance / Math.sqrt(varianceX * varianceY)
}
