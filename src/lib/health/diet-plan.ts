/**
 * Motor do plano de emagrecimento.
 *
 * Regra central: o plano nunca obedece cegamente ao prazo pedido. Se a meta
 * exigir um ritmo insalubre, ele trava no limite seguro, avisa e devolve a data
 * realista. Perder rápido demais custa massa magra e a conta volta depois.
 *
 * Limites aplicados:
 *   - ritmo de 0,5% a 1,0% do peso corporal por semana;
 *   - déficit máximo de 25% do TDEE;
 *   - piso calórico de 1500 kcal (homens) / 1200 kcal (mulheres);
 *   - meta de peso nunca abaixo do IMC 18,5.
 *
 * Estimativas baseadas em fórmulas públicas. Não substituem nutricionista.
 */

import {
  KCAL_PER_KG_FAT,
  basalMetabolicRate,
  clamp,
  healthyWeightRange,
  round,
  tdeeFromActivityLevel,
  type ActivityLevel,
  type Sex,
} from './formulas'

export const WEEKLY_RATE_MIN_PCT = 0.005
export const WEEKLY_RATE_MAX_PCT = 0.01
/** Teto absoluto, só alcançável quando o usuário pede um prazo apertado. */
export const MAX_DEFICIT_PCT = 0.25
/**
 * Teto do plano sem prazo definido. Sem uma data pedida, não há motivo para
 * partir do déficit máximo: 20% já entrega ritmo bom com adesão muito maior.
 */
export const DEFAULT_DEFICIT_PCT = 0.2
export const CALORIE_FLOOR: Record<Sex, number> = { male: 1500, female: 1200 }

/** g de proteína por kg de peso. Alto em déficit para preservar massa magra. */
export const PROTEIN_G_PER_KG = 1.8
/** g de gordura por kg — abaixo disso a produção hormonal sofre. */
export const FAT_G_PER_KG = 0.9
/** Piso de carboidrato por dia, para não zerar em déficits agressivos. */
export const MIN_CARB_G = 50

export type PlanWarningCode =
  | 'deadline_too_short'
  | 'calorie_floor_reached'
  | 'target_below_healthy_bmi'
  | 'target_above_current'
  | 'no_deficit_needed'

export interface PlanWarning {
  code: PlanWarningCode
  message: string
}

export interface Macros {
  proteinG: number
  fatG: number
  carbG: number
  proteinKcal: number
  fatKcal: number
  carbKcal: number
}

export interface DietPlanInput {
  weightKg: number
  heightCm: number
  ageYears: number
  sex: Sex
  activityLevel: ActivityLevel
  targetWeightKg: number
  /** Data desejada para a meta (ISO). Opcional: sem ela, usamos o ritmo médio seguro. */
  targetDate?: string
  /** TDEE medido pelas sessões registradas. Se vier, tem prioridade sobre o fator. */
  measuredTdee?: number
  startDate?: string
}

export interface DietPlan {
  bmr: number
  tdee: number
  /** Calorias-alvo por dia, já com todas as travas aplicadas. */
  dailyCalories: number
  dailyDeficit: number
  deficitPercent: number
  /** Ritmo real de perda semanal, em kg. */
  weeklyLossKg: number
  weeklyLossPercent: number
  totalToLoseKg: number
  estimatedWeeks: number
  estimatedDate: string
  macros: Macros
  warnings: PlanWarning[]
  safeRange: { minWeeklyKg: number; maxWeeklyKg: number }
  healthyWeight: { min: number; max: number }
}

export function buildDietPlan(input: DietPlanInput): DietPlan {
  const warnings: PlanWarning[] = []
  const startDate = input.startDate ? new Date(input.startDate) : new Date()

  const bmr = basalMetabolicRate({
    weightKg: input.weightKg,
    heightCm: input.heightCm,
    ageYears: input.ageYears,
    sex: input.sex,
  })
  const tdee = input.measuredTdee ?? tdeeFromActivityLevel(bmr, input.activityLevel)
  const healthyWeight = healthyWeightRange(input.heightCm)

  // A meta não pode ficar abaixo do IMC 18,5.
  let targetWeight = input.targetWeightKg
  if (targetWeight < healthyWeight.min) {
    warnings.push({
      code: 'target_below_healthy_bmi',
      message: `A meta de ${round(targetWeight, 1)} kg fica abaixo do peso saudável para ${input.heightCm} cm. Ajustamos para ${healthyWeight.min} kg (IMC 18,5).`,
    })
    targetWeight = healthyWeight.min
  }

  const totalToLose = round(input.weightKg - targetWeight, 1)

  const safeRange = {
    minWeeklyKg: round(input.weightKg * WEEKLY_RATE_MIN_PCT, 2),
    maxWeeklyKg: round(input.weightKg * WEEKLY_RATE_MAX_PCT, 2),
  }

  // Já está na meta (ou quer ganhar peso): plano vira manutenção.
  if (totalToLose <= 0) {
    warnings.push({
      code: totalToLose === 0 ? 'no_deficit_needed' : 'target_above_current',
      message:
        totalToLose === 0
          ? 'Você já está no peso-meta. O plano abaixo é de manutenção.'
          : 'A meta está acima do peso atual. Para ganho de peso o cálculo é outro — este plano assume manutenção.',
    })
    return {
      bmr,
      tdee,
      dailyCalories: tdee,
      dailyDeficit: 0,
      deficitPercent: 0,
      weeklyLossKg: 0,
      weeklyLossPercent: 0,
      totalToLoseKg: 0,
      estimatedWeeks: 0,
      estimatedDate: toISODate(startDate),
      macros: buildMacros(tdee, input.weightKg),
      warnings,
      safeRange,
      healthyWeight,
    }
  }

  // Ritmo pedido pelo prazo, ou o meio da faixa segura quando não há prazo.
  let weeklyLoss: number
  if (input.targetDate) {
    const weeks = weeksBetween(startDate, new Date(input.targetDate))
    const requested = weeks > 0 ? totalToLose / weeks : Number.POSITIVE_INFINITY
    weeklyLoss = clamp(requested, safeRange.minWeeklyKg, safeRange.maxWeeklyKg)
    if (requested > safeRange.maxWeeklyKg) {
      warnings.push({
        code: 'deadline_too_short',
        message: `Esse prazo exigiria perder ${round(requested, 2)} kg por semana — acima do limite seguro de ${safeRange.maxWeeklyKg} kg (1% do peso). O plano usa o ritmo máximo seguro e a data foi recalculada.`,
      })
    }
  } else {
    weeklyLoss = round((safeRange.minWeeklyKg + safeRange.maxWeeklyKg) / 2, 2)
  }

  // Converte ritmo em déficit diário e aplica o teto percentual do TDEE.
  let dailyDeficit = Math.round((weeklyLoss * KCAL_PER_KG_FAT) / 7)
  const deficitCap = input.targetDate ? MAX_DEFICIT_PCT : DEFAULT_DEFICIT_PCT
  const maxDeficit = Math.round(tdee * deficitCap)
  if (dailyDeficit > maxDeficit) dailyDeficit = maxDeficit

  // Piso calórico.
  let dailyCalories = tdee - dailyDeficit
  const floor = CALORIE_FLOOR[input.sex]
  if (dailyCalories < floor) {
    dailyCalories = Math.min(floor, tdee)
    dailyDeficit = tdee - dailyCalories
    warnings.push({
      code: 'calorie_floor_reached',
      message: `O déficit calculado levaria abaixo de ${floor} kcal por dia. Travamos nesse piso — abaixo disso fica difícil bater proteína e micronutrientes, e a perda vem de massa magra.`,
    })
  }

  const effectiveWeeklyLoss = round((dailyDeficit * 7) / KCAL_PER_KG_FAT, 2)
  const estimatedWeeks = effectiveWeeklyLoss > 0 ? Math.ceil(totalToLose / effectiveWeeklyLoss) : 0
  const estimatedDate = addWeeks(startDate, estimatedWeeks)

  return {
    bmr,
    tdee,
    dailyCalories: Math.round(dailyCalories),
    dailyDeficit: Math.round(dailyDeficit),
    deficitPercent: round((dailyDeficit / tdee) * 100, 1),
    weeklyLossKg: effectiveWeeklyLoss,
    weeklyLossPercent: round((effectiveWeeklyLoss / input.weightKg) * 100, 2),
    totalToLoseKg: totalToLose,
    estimatedWeeks,
    estimatedDate: toISODate(estimatedDate),
    macros: buildMacros(dailyCalories, input.weightKg),
    warnings,
    safeRange,
    healthyWeight,
  }
}

/**
 * Distribui as calorias em macros: proteína e gordura por kg de peso,
 * carboidrato no que sobra. Se sobrar pouco, o carbo trava no piso e a
 * gordura cede (proteína é a última a ser reduzida em déficit).
 */
export function buildMacros(dailyCalories: number, weightKg: number): Macros {
  const proteinG = Math.round(PROTEIN_G_PER_KG * weightKg)
  let fatG = Math.round(FAT_G_PER_KG * weightKg)

  let remaining = dailyCalories - proteinG * 4 - fatG * 9
  let carbG = Math.round(remaining / 4)

  if (carbG < MIN_CARB_G) {
    carbG = MIN_CARB_G
    remaining = dailyCalories - proteinG * 4 - carbG * 4
    fatG = Math.max(Math.round(remaining / 9), Math.round(0.5 * weightKg))
  }

  return {
    proteinG,
    fatG,
    carbG,
    proteinKcal: proteinG * 4,
    fatKcal: fatG * 9,
    carbKcal: carbG * 4,
  }
}

export interface ProjectionPoint {
  date: string
  week: number
  projectedKg: number
}

/** Curva semanal esperada, do peso atual até a meta. */
export function projectWeightCurve(
  plan: Pick<DietPlan, 'weeklyLossKg' | 'estimatedWeeks'>,
  startWeightKg: number,
  targetWeightKg: number,
  startDate = new Date(),
): ProjectionPoint[] {
  const points: ProjectionPoint[] = []
  for (let week = 0; week <= plan.estimatedWeeks; week++) {
    const projected = Math.max(startWeightKg - plan.weeklyLossKg * week, targetWeightKg)
    points.push({
      date: toISODate(addWeeks(startDate, week)),
      week,
      projectedKg: round(projected, 2),
    })
  }
  return points
}

export type RecalibrationStatus = 'on_track' | 'too_slow' | 'too_fast' | 'insufficient_data'

export interface Recalibration {
  status: RecalibrationStatus
  actualWeeklyLossKg: number
  expectedWeeklyLossKg: number
  /** Ajuste sugerido nas calorias diárias (negativo = cortar). */
  calorieAdjustment: number
  suggestedDailyCalories: number
  message: string
}

/**
 * Compara a perda real com a projetada e sugere ajuste.
 *
 * É o que impede o plano de virar peça de museu: metabolismo adapta, o TDEE cai
 * junto com o peso, e um alvo fixo para de funcionar por volta da 4ª semana.
 * Usa média móvel do início e do fim da janela para não reagir a ruído diário.
 */
export function recalibrate(
  plan: Pick<DietPlan, 'weeklyLossKg' | 'dailyCalories'>,
  weighIns: Array<{ date: string; value: number }>,
  options: { windowDays?: number; sex?: Sex; toleranceKg?: number } = {},
): Recalibration {
  const windowDays = options.windowDays ?? 14
  const tolerance = options.toleranceKg ?? 0.15
  const floor = CALORIE_FLOOR[options.sex ?? 'male']

  const sorted = [...weighIns].sort((a, b) => a.date.localeCompare(b.date))
  const last = sorted[sorted.length - 1]
  const first = sorted[0]

  if (!first || !last || sorted.length < 4) {
    return insufficient(plan, 'Registre o peso por pelo menos 2 semanas para o ajuste automático.')
  }

  const spanDays = daysBetween(new Date(first.date), new Date(last.date))
  if (spanDays < windowDays - 3) {
    return insufficient(
      plan,
      `Faltam ${Math.max(windowDays - spanDays, 1)} dias de registro para recalibrar.`,
    )
  }

  // Média dos 3 primeiros e dos 3 últimos registros amortece a oscilação diária.
  const startAvg = average(sorted.slice(0, 3).map((p) => p.value))
  const endAvg = average(sorted.slice(-3).map((p) => p.value))
  const actualWeekly = round(((startAvg - endAvg) / spanDays) * 7, 2)
  const expected = plan.weeklyLossKg
  const gap = actualWeekly - expected

  if (Math.abs(gap) <= tolerance) {
    return {
      status: 'on_track',
      actualWeeklyLossKg: actualWeekly,
      expectedWeeklyLossKg: expected,
      calorieAdjustment: 0,
      suggestedDailyCalories: plan.dailyCalories,
      message: `No ritmo: ${fmtKg(actualWeekly)} por semana contra ${fmtKg(expected)} projetados. Mantenha as calorias.`,
    }
  }

  // Converte a diferença de ritmo em kcal/dia, limitada a 250 kcal por ajuste
  // para não dar solavanco no plano.
  const raw = Math.round((gap * KCAL_PER_KG_FAT) / 7)
  const adjustment = clamp(raw, -250, 250)
  const suggested = Math.max(plan.dailyCalories + adjustment, floor)

  if (gap < 0) {
    return {
      status: 'too_slow',
      actualWeeklyLossKg: actualWeekly,
      expectedWeeklyLossKg: expected,
      calorieAdjustment: suggested - plan.dailyCalories,
      suggestedDailyCalories: suggested,
      message: `Perda abaixo do projetado (${fmtKg(actualWeekly)} vs ${fmtKg(expected)} por semana). Sugestão: ${suggested} kcal por dia, ou manter as calorias e adicionar um treino na semana.`,
    }
  }

  return {
    status: 'too_fast',
    actualWeeklyLossKg: actualWeekly,
    expectedWeeklyLossKg: expected,
    calorieAdjustment: suggested - plan.dailyCalories,
    suggestedDailyCalories: suggested,
    message: `Perda acima do projetado (${fmtKg(actualWeekly)} vs ${fmtKg(expected)} por semana). Rápido demais custa massa magra — sugestão: subir para ${suggested} kcal por dia.`,
  }
}

function insufficient(
  plan: Pick<DietPlan, 'weeklyLossKg' | 'dailyCalories'>,
  message: string,
): Recalibration {
  return {
    status: 'insufficient_data',
    actualWeeklyLossKg: 0,
    expectedWeeklyLossKg: plan.weeklyLossKg,
    calorieAdjustment: 0,
    suggestedDailyCalories: plan.dailyCalories,
    message,
  }
}

function fmtKg(value: number): string {
  return `${value.toFixed(2).replace('.', ',')} kg`
}

function average(values: number[]): number {
  if (!values.length) return 0
  return values.reduce((a, b) => a + b, 0) / values.length
}

export function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86_400_000)
}

export function weeksBetween(a: Date, b: Date): number {
  return daysBetween(a, b) / 7
}

export function addWeeks(date: Date, weeks: number): Date {
  const next = new Date(date)
  next.setDate(next.getDate() + Math.round(weeks * 7))
  return next
}

export function toISODate(date: Date): string {
  return date.toISOString().slice(0, 10)
}
