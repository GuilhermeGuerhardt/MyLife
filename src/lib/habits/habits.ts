/**
 * Hábitos, sequências e aderência.
 *
 * Duas decisões definem o comportamento e valem a explicação:
 *
 * 1. **O dia de hoje não quebra sequência.** Enquanto o dia não acabou, não dá
 *    para dizer que o hábito falhou. A sequência de um hábito diário conta a
 *    partir de hoje quando já houve registro, e a partir de ontem quando não.
 *    Sem isso, todo app mostra "0 dias" pela manhã e mata a motivação que ele
 *    deveria criar.
 *
 * 2. **Hábito semanal se mede em semanas, não em dias.** "Treinar 4× por
 *    semana" não é quebrado por uma terça-feira sem treino. A sequência conta
 *    semanas que bateram a meta, e a semana corrente só entra depois de
 *    batida — antes disso ela fica pendente, não perdida.
 */

import { addDays, weekStart, weekdayOf } from '@/lib/dates'

export type HabitCadence = 'daily' | 'weekly'

export interface HabitLike {
  id: string
  cadence: HabitCadence
  /** Dias por semana esperados. Em hábito diário, vale 7. */
  target_per_week: number
}

/** Um registro por dia: repetir a mesma data não conta duas vezes. */
export function uniqueDays(dates: string[]): Set<string> {
  return new Set(dates)
}

/**
 * Dias seguidos de hábito diário, contando de hoje (ou de ontem, se hoje ainda
 * não foi registrado).
 */
export function dailyStreak(dates: string[], today: string): number {
  const days = uniqueDays(dates)
  let cursor = days.has(today) ? today : addDays(today, -1)
  let streak = 0
  while (days.has(cursor)) {
    streak++
    cursor = addDays(cursor, -1)
  }
  return streak
}

/** A maior sequência de dias consecutivos já alcançada. */
export function bestDailyStreak(dates: string[]): number {
  const sorted = [...uniqueDays(dates)].sort()
  let best = 0
  let run = 0
  let previous: string | null = null

  for (const day of sorted) {
    run = previous && addDays(previous, 1) === day ? run + 1 : 1
    if (run > best) best = run
    previous = day
  }

  return best
}

/**
 * A maior sequência de semanas que bateram a meta, em todo o histórico.
 * Só olha as semanas que têm algum registro: um intervalo vazio não é uma
 * sequência interrompida, é ausência de dado.
 */
export function bestWeeklyStreak(dates: string[], target: number): number {
  const days = uniqueDays(dates)
  if (days.size === 0 || target <= 0) return 0

  const sorted = [...days].sort()
  const perWeek = new Map<string, number>()
  for (const day of sorted) {
    const start = weekStart(day)
    perWeek.set(start, (perWeek.get(start) ?? 0) + 1)
  }

  let best = 0
  let run = 0
  const first = weekStart(sorted[0]!)
  const last = weekStart(sorted[sorted.length - 1]!)

  for (let cursor = first; cursor <= last; cursor = addDays(cursor, 7)) {
    run = (perWeek.get(cursor) ?? 0) >= target ? run + 1 : 0
    if (run > best) best = run
  }

  return best
}

export interface WeekCount {
  /** Domingo da semana. */
  start: string
  count: number
  target: number
  met: boolean
}

/** As últimas `weeks` semanas, da mais antiga para a mais recente. */
export function weeklyCounts(
  dates: string[],
  target: number,
  today: string,
  weeks: number,
): WeekCount[] {
  const days = uniqueDays(dates)
  const current = weekStart(today)

  return Array.from({ length: weeks }, (_, index) => {
    const start = addDays(current, -(weeks - 1 - index) * 7)
    let count = 0
    for (let offset = 0; offset < 7; offset++) {
      if (days.has(addDays(start, offset))) count++
    }
    return { start, count, target, met: count >= target }
  })
}

/**
 * Semanas seguidas em que a meta foi batida. A semana corrente entra quando já
 * bateu; quando ainda não, a contagem parte da semana anterior — o prazo dela
 * não venceu.
 */
export function weeklyStreak(dates: string[], target: number, today: string): number {
  if (target <= 0) return 0
  const days = uniqueDays(dates)

  const countWeek = (start: string): number => {
    let count = 0
    for (let offset = 0; offset < 7; offset++) {
      if (days.has(addDays(start, offset))) count++
    }
    return count
  }

  let cursor = weekStart(today)
  let streak = 0

  // A semana corrente não conta contra: se não bateu ainda, começa da anterior.
  if (countWeek(cursor) < target) cursor = addDays(cursor, -7)

  while (countWeek(cursor) >= target) {
    streak++
    cursor = addDays(cursor, -7)
  }

  return streak
}

export interface HabitStatus {
  doneToday: boolean
  /** Dias, em hábito diário; semanas, em hábito semanal. */
  streak: number
  streakUnit: 'dia' | 'semana'
  best: number
  weekCount: number
  weekTarget: number
  weekPercent: number
  /** Quantos registros ainda faltam nesta semana. */
  missing: number
  /** Dias que restam na semana, hoje incluído. */
  daysLeft: number
  /** Ainda dá para bater a meta, mas só se não falhar mais nenhum dia. */
  atRisk: boolean
  /** A meta da semana já é impossível. */
  lost: boolean
  total: number
}

export function habitStatus(habit: HabitLike, dates: string[], today: string): HabitStatus {
  const days = uniqueDays(dates)
  const target = habit.cadence === 'daily' ? 7 : Math.min(Math.max(habit.target_per_week, 1), 7)

  const start = weekStart(today)
  let weekCount = 0
  for (let offset = 0; offset < 7; offset++) {
    if (days.has(addDays(start, offset))) weekCount++
  }

  const missing = Math.max(target - weekCount, 0)
  const daysLeft = 7 - weekdayOf(today)

  return {
    doneToday: days.has(today),
    streak:
      habit.cadence === 'daily'
        ? dailyStreak(dates, today)
        : weeklyStreak(dates, target, today),
    streakUnit: habit.cadence === 'daily' ? 'dia' : 'semana',
    // O recorde é medido na mesma unidade da sequência, senão a comparação
    // "6 dias / recorde 3" não quer dizer nada.
    best:
      habit.cadence === 'daily'
        ? bestDailyStreak(dates)
        : bestWeeklyStreak(dates, target),
    weekCount,
    weekTarget: target,
    weekPercent: Math.min(Math.round((weekCount / target) * 100), 100),
    missing,
    daysLeft,
    atRisk: missing > 0 && missing === daysLeft,
    lost: missing > daysLeft,
    total: days.size,
  }
}

export interface HeatmapDay {
  date: string
  count: number
  /** 0 (vazio) a 4 (mais intenso) — a escala de cor da célula. */
  level: 0 | 1 | 2 | 3 | 4
}

/**
 * Heatmap estilo GitHub: colunas de domingo a sábado.
 *
 * O intervalo é estendido até o sábado da semana corrente para a última coluna
 * ficar completa; os dias futuros vêm com `count: -1` e a tela os desenha
 * vazios. Sem isso a grade termina no meio de uma coluna e fica torta.
 */
export function heatmap(dates: string[], end: string, days: number): HeatmapDay[][] {
  const counts = new Map<string, number>()
  for (const date of dates) counts.set(date, (counts.get(date) ?? 0) + 1)

  const max = Math.max(...counts.values(), 1)
  const from = weekStart(addDays(end, -(days - 1)))
  const to = addDays(weekStart(end), 6)

  const weeks: HeatmapDay[][] = []
  for (let cursor = from; cursor <= to; cursor = addDays(cursor, 7)) {
    weeks.push(
      Array.from({ length: 7 }, (_, offset) => {
        const date = addDays(cursor, offset)
        if (date > end) return { date, count: -1, level: 0 as const }
        const count = counts.get(date) ?? 0
        return { date, count, level: levelFor(count, max) }
      }),
    )
  }

  return weeks
}

function levelFor(count: number, max: number): 0 | 1 | 2 | 3 | 4 {
  if (count <= 0) return 0
  if (max <= 1) return 4
  const ratio = count / max
  if (ratio <= 0.25) return 1
  if (ratio <= 0.5) return 2
  if (ratio <= 0.75) return 3
  return 4
}

/** Percentual de dias com registro no intervalo — a adesão sem julgamento. */
export function adherence(dates: string[], from: string, to: string): number {
  const days = uniqueDays(dates)
  let hit = 0
  let total = 0
  for (let cursor = from; cursor <= to; cursor = addDays(cursor, 1)) {
    total++
    if (days.has(cursor)) hit++
  }
  return total > 0 ? Math.round((hit / total) * 1000) / 10 : 0
}
