/**
 * Fórmulas de composição corporal e gasto energético.
 *
 * Tudo aqui é função pura, sem dependência de React ou Supabase, para poder
 * ser testado isoladamente e reaproveitado num backend depois.
 *
 * São estimativas baseadas em equações populacionais publicadas. Nenhuma delas
 * substitui avaliação de nutricionista ou médico.
 */

export type Sex = 'male' | 'female'

export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'high' | 'athlete'

/** Fatores clássicos de Harris-Benedict aplicados sobre a TMB. */
export const ACTIVITY_FACTORS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  high: 1.725,
  athlete: 1.9,
}

export const ACTIVITY_LABELS: Record<ActivityLevel, string> = {
  sedentary: 'Sedentário (trabalho parado, sem treino)',
  light: 'Leve (treino 1–3× por semana)',
  moderate: 'Moderado (treino 3–5× por semana)',
  high: 'Alto (treino 6–7× por semana)',
  athlete: 'Atleta (treino pesado 2× ao dia)',
}

/** Energia de 1 kg de tecido adiposo, em kcal. Convenção usada em nutrição. */
export const KCAL_PER_KG_FAT = 7700

/**
 * Taxa Metabólica Basal — Mifflin-St Jeor (1990).
 * É a equação preditiva com menor erro médio na população geral,
 * mais confiável que Harris-Benedict para quem tem sobrepeso.
 */
export function basalMetabolicRate(input: {
  weightKg: number
  heightCm: number
  ageYears: number
  sex: Sex
}): number {
  const base = 10 * input.weightKg + 6.25 * input.heightCm - 5 * input.ageYears
  return Math.round(input.sex === 'male' ? base + 5 : base - 161)
}

/** Gasto total estimado a partir de um nível de atividade declarado. */
export function tdeeFromActivityLevel(bmr: number, level: ActivityLevel): number {
  return Math.round(bmr * ACTIVITY_FACTORS[level])
}

/**
 * Gasto total estimado a partir dos treinos realmente registrados.
 *
 * Mais honesto que o fator declarado: usa 1.2 como base (gasto do dia a dia
 * fora do treino) e soma a média diária de calorias das sessões da janela.
 */
export function tdeeFromSessions(
  bmr: number,
  sessions: Array<{ caloriesEstimated: number }>,
  windowDays = 7,
): number {
  if (windowDays <= 0) return Math.round(bmr * ACTIVITY_FACTORS.sedentary)
  const total = sessions.reduce((sum, s) => sum + (s.caloriesEstimated || 0), 0)
  return Math.round(bmr * ACTIVITY_FACTORS.sedentary + total / windowDays)
}

/**
 * Calorias de uma sessão pelo valor MET da atividade.
 * kcal = MET × peso(kg) × horas
 */
export function sessionCalories(met: number, weightKg: number, durationMin: number): number {
  return Math.round(met * weightKg * (durationMin / 60))
}

export function bmi(weightKg: number, heightCm: number): number {
  const m = heightCm / 100
  return round(weightKg / (m * m), 1)
}

export type BmiBand = 'underweight' | 'normal' | 'overweight' | 'obese1' | 'obese2' | 'obese3'

export function bmiBand(value: number): BmiBand {
  if (value < 18.5) return 'underweight'
  if (value < 25) return 'normal'
  if (value < 30) return 'overweight'
  if (value < 35) return 'obese1'
  if (value < 40) return 'obese2'
  return 'obese3'
}

export const BMI_LABELS: Record<BmiBand, string> = {
  underweight: 'Abaixo do peso',
  normal: 'Peso normal',
  overweight: 'Sobrepeso',
  obese1: 'Obesidade grau I',
  obese2: 'Obesidade grau II',
  obese3: 'Obesidade grau III',
}

/** Faixa de peso com IMC entre 18,5 e 24,9 para a altura informada. */
export function healthyWeightRange(heightCm: number): { min: number; max: number } {
  const m = heightCm / 100
  return { min: round(18.5 * m * m, 1), max: round(24.9 * m * m, 1) }
}

/** Relação cintura/quadril — indicador de risco cardiovascular. */
export function waistToHipRatio(waistCm: number, hipCm: number): number {
  if (!hipCm) return 0
  return round(waistCm / hipCm, 2)
}

/**
 * Média móvel de N dias sobre uma série de pesagens.
 *
 * O peso diário oscila 1–2 kg por água, sal e intestino. A média móvel é o
 * número que mostra tendência real — é ela que o app exibe como "peso atual".
 * Aceita dias faltando: a janela é por data, não por quantidade de registros.
 */
export function movingAverage(
  points: Array<{ date: string; value: number }>,
  windowDays = 7,
): Array<{ date: string; value: number; average: number }> {
  const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date))
  const msWindow = (windowDays - 1) * 86_400_000

  return sorted.map((point, index) => {
    const end = new Date(point.date).getTime()
    let sum = 0
    let count = 0
    for (let i = index; i >= 0; i--) {
      const previous = sorted[i]!
      if (end - new Date(previous.date).getTime() > msWindow) break
      sum += previous.value
      count++
    }
    return { ...point, average: round(sum / count, 2) }
  })
}

/**
 * Variação entre o primeiro e o último ponto de uma série (em unidade absoluta
 * e em %). Usada nos cards de tendência.
 */
export function trend(values: number[]): { delta: number; percent: number } {
  const first = values[0]
  const last = values[values.length - 1]
  if (first === undefined || last === undefined || first === 0) {
    return { delta: 0, percent: 0 }
  }
  return { delta: round(last - first, 2), percent: round(((last - first) / first) * 100, 1) }
}

export function round(value: number, decimals = 0): number {
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}
