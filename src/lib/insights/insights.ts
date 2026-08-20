/**
 * Insights cruzando módulos.
 *
 * A promessa aqui é a mais fácil de quebrar em um app de vida: qualquer série
 * pequena produz coincidências, e uma frase confiante em cima de três semanas
 * de dado é pior do que nenhuma frase. Por isso toda regra passa por três
 * travas antes de virar texto:
 *
 * 1. **Amostra mínima** — pelo menos 3 semanas de cada lado da comparação.
 * 2. **Efeito mínimo** — diferenças abaixo de 10% são ruído, não padrão.
 * 3. **Linguagem descritiva** — "nas semanas em que X, Y foi maior". Nunca
 *    "X causa Y": os dados aqui são observacionais e não sustentam causa.
 *
 * As regras são independentes: cada uma recebe as semanas e devolve um insight
 * ou nada. Adicionar uma regra nova não mexe nas existentes.
 */

import type { WeekStats } from './weeks'
import { pearson } from './weeks'

export type InsightArea = 'health' | 'education' | 'finance' | 'routine'

export interface Insight {
  id: string
  area: InsightArea
  text: string
  /** Semanas que sustentam a afirmação. Aparece na tela junto do texto. */
  sample: number
  strength: 'forte' | 'moderada'
}

const MIN_GROUP = 3
const MIN_EFFECT_PCT = 10

interface Comparison {
  withAvg: number
  withoutAvg: number
  withCount: number
  withoutCount: number
  /** Diferença relativa, em pontos percentuais do grupo sem a condição. */
  deltaPct: number
  /** Diferença absoluta, para métricas que podem ser negativas ou zeradas. */
  deltaAbs: number
}

/**
 * Divide as semanas em dois grupos e compara a média da métrica.
 * Semanas sem a métrica ficam de fora dos dois lados.
 */
function compare(
  weeks: WeekStats[],
  predicate: (week: WeekStats) => boolean,
  metric: (week: WeekStats) => number | null,
): Comparison | null {
  const withGroup: number[] = []
  const withoutGroup: number[] = []

  for (const week of weeks) {
    const value = metric(week)
    if (value === null || !Number.isFinite(value)) continue
    if (predicate(week)) withGroup.push(value)
    else withoutGroup.push(value)
  }

  if (withGroup.length < MIN_GROUP || withoutGroup.length < MIN_GROUP) return null

  const withAvg = mean(withGroup)
  const withoutAvg = mean(withoutGroup)

  return {
    withAvg,
    withoutAvg,
    withCount: withGroup.length,
    withoutCount: withoutGroup.length,
    deltaAbs: withAvg - withoutAvg,
    deltaPct: withoutAvg !== 0 ? ((withAvg - withoutAvg) / Math.abs(withoutAvg)) * 100 : 0,
  }
}

function mean(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2
    : (sorted[middle] ?? 0)
}

function strengthOf(comparison: Comparison): 'forte' | 'moderada' {
  const sample = comparison.withCount + comparison.withoutCount
  return Math.abs(comparison.deltaPct) >= 25 && sample >= 8 ? 'forte' : 'moderada'
}

function pct(value: number): string {
  return `${Math.round(Math.abs(value))}%`
}

function decimal(value: number, digits = 1): string {
  return Math.abs(value).toFixed(digits).replace('.', ',')
}

// ---------------------------------------------------------------------------
// Regras
// ---------------------------------------------------------------------------

type Rule = (weeks: WeekStats[]) => Insight | null

/** Treino e humor. O limiar é a mediana da própria pessoa, não um número fixo. */
const moodByTraining: Rule = (weeks) => {
  const counts = weeks.map((week) => week.workouts)
  const threshold = Math.max(Math.round(median(counts)), 2)

  const result = compare(weeks, (week) => week.workouts >= threshold, (week) => week.mood)
  if (!result || Math.abs(result.deltaPct) < MIN_EFFECT_PCT) return null

  const direction = result.deltaPct > 0 ? 'maior' : 'menor'
  return {
    id: 'mood-by-training',
    area: 'health',
    text: `Nas semanas com ${threshold} treino${threshold > 1 ? 's' : ''} ou mais, seu humor médio foi ${pct(result.deltaPct)} ${direction} — ${decimal(result.withAvg)} contra ${decimal(result.withoutAvg)}.`,
    sample: result.withCount + result.withoutCount,
    strength: strengthOf(result),
  }
}

/** Sono e energia percebida. */
const energyBySleep: Rule = (weeks) => {
  const result = compare(weeks, (week) => (week.sleepHours ?? 0) >= 7, (week) => week.energy)
  if (!result || Math.abs(result.deltaPct) < MIN_EFFECT_PCT) return null

  const direction = result.deltaPct > 0 ? 'maior' : 'menor'
  return {
    id: 'energy-by-sleep',
    area: 'health',
    text: `Dormindo 7 h ou mais por noite, sua energia média na semana foi ${pct(result.deltaPct)} ${direction} (${decimal(result.withAvg)} contra ${decimal(result.withoutAvg)}).`,
    sample: result.withCount + result.withoutCount,
    strength: strengthOf(result),
  }
}

/**
 * Sono e perda de peso. Aqui a comparação é em quilos, não em percentual: a
 * variação semanal passa perto de zero e troca de sinal, e percentual sobre
 * base quase nula produz números absurdos.
 */
const weightBySleep: Rule = (weeks) => {
  const result = compare(weeks, (week) => (week.sleepHours ?? 0) >= 7, (week) => week.weightDelta)
  if (!result || Math.abs(result.deltaAbs) < 0.15) return null
  // Só vale a pena falar quando dormir mais acompanha perder mais.
  if (result.deltaAbs >= 0) return null

  return {
    id: 'weight-by-sleep',
    area: 'health',
    text: `Nas semanas em que você dormiu 7 h ou mais, o peso caiu ${decimal(result.withAvg, 2)} kg por semana, contra ${decimal(result.withoutAvg, 2)} kg nas demais.`,
    sample: result.withCount + result.withoutCount,
    strength: strengthOf(result),
  }
}

/** Semana de prova e gasto total. */
const spendingByDeadline: Rule = (weeks) => {
  const result = compare(
    weeks,
    (week) => week.deadlines > 0,
    (week) => (week.expenseCents > 0 ? week.expenseCents : null),
  )
  if (!result || Math.abs(result.deltaPct) < MIN_EFFECT_PCT) return null

  const direction = result.deltaPct > 0 ? 'subiram' : 'caíram'
  return {
    id: 'spending-by-deadline',
    area: 'finance',
    text: `Seus gastos ${direction} ${pct(result.deltaPct)} nas semanas com prova ou entrega marcada.`,
    sample: result.withCount + result.withoutCount,
    strength: strengthOf(result),
  }
}

/**
 * A categoria que mais reage às semanas de prova.
 *
 * Varrer todas as categorias e anunciar a maior diferença encontrada é
 * exatamente o tipo de busca que acha padrão em dado aleatório. O limiar aqui é
 * propositalmente mais alto (25%) e a frase continua descritiva.
 */
export function categorySpendingByDeadline(
  weeks: WeekStats[],
  categoryName: (id: string | null) => string | null,
): Insight | null {
  const ids = new Set<string | null>()
  for (const week of weeks) for (const id of week.expenseByCategory.keys()) ids.add(id)

  let best: { id: string | null; result: Comparison } | null = null

  for (const id of ids) {
    const result = compare(
      weeks,
      (week) => week.deadlines > 0,
      (week) => week.expenseByCategory.get(id) ?? null,
    )
    if (!result || result.deltaPct < 25) continue
    if (!best || result.deltaPct > best.result.deltaPct) best = { id, result }
  }

  if (!best) return null
  const name = categoryName(best.id)
  if (!name) return null

  return {
    id: 'category-by-deadline',
    area: 'finance',
    text: `Nas semanas de prova, o gasto com ${name} foi ${pct(best.result.deltaPct)} maior que nas semanas livres.`,
    sample: best.result.withCount + best.result.withoutCount,
    strength: strengthOf(best.result),
  }
}

/** Consumo calórico nas semanas de treino pesado. */
const intakeByTraining: Rule = (weeks) => {
  const minutes = weeks.map((week) => week.workoutMinutes)
  const threshold = Math.max(Math.round(median(minutes)), 60)

  const result = compare(weeks, (week) => week.workoutMinutes >= threshold, (week) => week.kcalIn)
  if (!result || Math.abs(result.deltaPct) < MIN_EFFECT_PCT) return null

  const direction = result.deltaPct > 0 ? 'come mais' : 'come menos'
  return {
    id: 'intake-by-training',
    area: 'health',
    text: `Você ${direction} nas semanas de treino mais longo: ${Math.round(result.withAvg)} kcal por dia contra ${Math.round(result.withoutAvg)} kcal.`,
    sample: result.withCount + result.withoutCount,
    strength: strengthOf(result),
  }
}

/** Constância nos hábitos e humor — correlação, não comparação de grupos. */
const habitsAndMood: Rule = (weeks) => {
  const pairs = weeks
    .filter((week) => week.mood !== null && week.habitLogs > 0)
    .map((week) => [week.habitLogs, week.mood!] as [number, number])

  const r = pearson(pairs)
  if (r === null || Math.abs(r) < 0.5 || pairs.length < 6) return null

  return {
    id: 'habits-and-mood',
    area: 'routine',
    text:
      r > 0
        ? `Quanto mais hábitos você cumpre na semana, melhor tende a ser seu humor (correlação de ${decimal(r, 2)} em ${pairs.length} semanas).`
        : `Semanas com mais hábitos cumpridos vieram com humor pior (correlação de −${decimal(r, 2)}). Vale olhar se a rotina está apertada demais.`,
    sample: pairs.length,
    strength: Math.abs(r) >= 0.7 && pairs.length >= 8 ? 'forte' : 'moderada',
  }
}

/** Aulas de curso concluídas nas semanas de prova — o estudo livre costuma parar. */
const lessonsByDeadline: Rule = (weeks) => {
  const result = compare(weeks, (week) => week.deadlines > 0, (week) => week.lessons)
  if (!result || Math.abs(result.deltaPct) < MIN_EFFECT_PCT) return null

  const direction = result.deltaPct > 0 ? 'avança mais' : 'avança menos'
  return {
    id: 'lessons-by-deadline',
    area: 'education',
    text: `Nas semanas com prova ou entrega, você ${direction} nos cursos livres: ${decimal(result.withAvg)} aulas contra ${decimal(result.withoutAvg)}.`,
    sample: result.withCount + result.withoutCount,
    strength: strengthOf(result),
  }
}

const RULES: Rule[] = [
  moodByTraining,
  energyBySleep,
  weightBySleep,
  intakeByTraining,
  spendingByDeadline,
  lessonsByDeadline,
  habitsAndMood,
]

/** Os insights que sobrevivem às travas, do mais forte para o mais fraco. */
export function generateInsights(
  weeks: WeekStats[],
  categoryName: (id: string | null) => string | null = () => null,
): Insight[] {
  const found = RULES.map((rule) => rule(weeks))
  found.push(categorySpendingByDeadline(weeks, categoryName))

  return found
    .filter((insight): insight is Insight => insight !== null)
    .sort((a, b) => {
      if (a.strength !== b.strength) return a.strength === 'forte' ? -1 : 1
      return b.sample - a.sample
    })
}

// ---------------------------------------------------------------------------
// Revisão semanal
// ---------------------------------------------------------------------------

export interface ReviewMetric {
  label: string
  value: string
  /** Variação em relação à semana anterior. */
  delta: number | null
  /** Se subir é bom. Define a cor na tela. */
  higherIsBetter: boolean
  unit?: string
}

/**
 * Comparação da última semana fechada com a anterior. Diferente dos insights,
 * aqui não há inferência nenhuma: são dois números lado a lado.
 */
export function weeklyReview(weeks: WeekStats[]): {
  week: WeekStats | null
  previous: WeekStats | null
  metrics: ReviewMetric[]
} {
  const week = weeks[weeks.length - 1] ?? null
  const previous = weeks[weeks.length - 2] ?? null
  if (!week) return { week: null, previous: null, metrics: [] }

  const delta = (current: number | null, before: number | null): number | null =>
    current !== null && before !== null ? current - before : null

  return {
    week,
    previous,
    metrics: [
      {
        label: 'Treinos',
        value: String(week.workouts),
        delta: delta(week.workouts, previous?.workouts ?? null),
        higherIsBetter: true,
      },
      {
        label: 'Minutos de treino',
        value: String(week.workoutMinutes),
        delta: delta(week.workoutMinutes, previous?.workoutMinutes ?? null),
        higherIsBetter: true,
        unit: 'min',
      },
      {
        label: 'Sono médio',
        value: week.sleepHours !== null ? decimal(week.sleepHours) : '—',
        delta: delta(week.sleepHours, previous?.sleepHours ?? null),
        higherIsBetter: true,
        unit: 'h',
      },
      {
        label: 'Peso',
        value: week.weightAvg !== null ? decimal(week.weightAvg) : '—',
        delta: week.weightDelta,
        higherIsBetter: false,
        unit: 'kg',
      },
      {
        label: 'Gasto',
        value: (week.expenseCents / 100).toFixed(0),
        delta: delta(week.expenseCents, previous?.expenseCents ?? null),
        higherIsBetter: false,
        unit: 'R$',
      },
      {
        label: 'Hábitos cumpridos',
        value: String(week.habitLogs),
        delta: delta(week.habitLogs, previous?.habitLogs ?? null),
        higherIsBetter: true,
      },
    ],
  }
}
