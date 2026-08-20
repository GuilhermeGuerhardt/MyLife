import { describe, expect, it } from 'vitest'
import {
  basalMetabolicRate,
  bmi,
  bmiBand,
  healthyWeightRange,
  movingAverage,
  sessionCalories,
  tdeeFromActivityLevel,
  tdeeFromSessions,
} from './formulas'
import { buildDietPlan, buildMacros, projectWeightCurve, recalibrate } from './diet-plan'

describe('formulas', () => {
  it('calcula TMB por Mifflin-St Jeor', () => {
    // 10*85 + 6.25*180 - 5*25 + 5 = 850 + 1125 - 125 + 5
    expect(basalMetabolicRate({ weightKg: 85, heightCm: 180, ageYears: 25, sex: 'male' })).toBe(1855)
    expect(basalMetabolicRate({ weightKg: 65, heightCm: 165, ageYears: 30, sex: 'female' })).toBe(
      1370,
    )
  })

  it('aplica o fator de atividade no TDEE', () => {
    expect(tdeeFromActivityLevel(2000, 'sedentary')).toBe(2400)
    expect(tdeeFromActivityLevel(2000, 'moderate')).toBe(3100)
  })

  it('estima TDEE pelas sessões registradas em vez do fator declarado', () => {
    const sessions = [{ caloriesEstimated: 700 }, { caloriesEstimated: 700 }]
    // 2000 * 1.2 + 1400/7 = 2400 + 200
    expect(tdeeFromSessions(2000, sessions, 7)).toBe(2600)
  })

  it('estima calorias da sessão pelo MET', () => {
    // futvôlei ~6 MET, 85 kg, 90 min
    expect(sessionCalories(6, 85, 90)).toBe(765)
  })

  it('classifica IMC e devolve a faixa de peso saudável', () => {
    expect(bmi(85, 180)).toBe(26.2)
    expect(bmiBand(26.2)).toBe('overweight')
    const range = healthyWeightRange(180)
    expect(range.min).toBe(59.9)
    expect(range.max).toBe(80.7)
  })

  it('suaviza a série de peso com média móvel por data', () => {
    const series = movingAverage(
      [
        { date: '2026-01-01', value: 85 },
        { date: '2026-01-02', value: 86 },
        { date: '2026-01-03', value: 84 },
      ],
      7,
    )
    expect(series[0]!.average).toBe(85)
    expect(series[2]!.average).toBe(85)
  })

  it('ignora registros fora da janela da média móvel', () => {
    const series = movingAverage(
      [
        { date: '2026-01-01', value: 90 },
        { date: '2026-01-20', value: 80 },
      ],
      7,
    )
    // O registro de 01/01 está fora da janela de 7 dias do ponto de 20/01.
    expect(series[1]!.average).toBe(80)
  })
})

describe('plano de emagrecimento', () => {
  const base = {
    weightKg: 92,
    heightCm: 180,
    ageYears: 26,
    sex: 'male' as const,
    activityLevel: 'moderate' as const,
    targetWeightKg: 80,
    startDate: '2026-01-01',
  }

  it('mantém o ritmo dentro da faixa segura sem prazo definido', () => {
    const plan = buildDietPlan(base)
    expect(plan.weeklyLossKg).toBeGreaterThanOrEqual(plan.safeRange.minWeeklyKg - 0.05)
    expect(plan.weeklyLossKg).toBeLessThanOrEqual(plan.safeRange.maxWeeklyKg)
    expect(plan.dailyCalories).toBeLessThan(plan.tdee)
    expect(plan.warnings).toHaveLength(0)
  })

  it('trava o ritmo e recalcula a data quando o prazo é curto demais', () => {
    const plan = buildDietPlan({ ...base, targetDate: '2026-02-15' }) // 12 kg em ~6,5 semanas
    expect(plan.warnings.map((w) => w.code)).toContain('deadline_too_short')
    expect(plan.weeklyLossKg).toBeLessThanOrEqual(plan.safeRange.maxWeeklyKg)
    expect(new Date(plan.estimatedDate).getTime()).toBeGreaterThan(new Date('2026-02-15').getTime())
  })

  it('nunca ultrapassa 25% de déficit, mesmo com prazo impossível', () => {
    const plan = buildDietPlan({ ...base, targetDate: '2026-01-20' })
    expect(plan.deficitPercent).toBeLessThanOrEqual(25.01)
  })

  it('sem prazo, não parte do déficit máximo', () => {
    const plan = buildDietPlan(base)
    expect(plan.deficitPercent).toBeLessThanOrEqual(20.01)
    expect(plan.warnings).toHaveLength(0)
  })

  it('respeita o piso calórico', () => {
    const plan = buildDietPlan({
      weightKg: 55,
      heightCm: 160,
      ageYears: 45,
      sex: 'female',
      activityLevel: 'sedentary',
      targetWeightKg: 50,
      targetDate: '2026-02-01',
      startDate: '2026-01-01',
    })
    expect(plan.dailyCalories).toBeGreaterThanOrEqual(1200)
  })

  it('sobe a meta quando ela fica abaixo do IMC saudável', () => {
    const plan = buildDietPlan({ ...base, targetWeightKg: 55 })
    expect(plan.warnings.map((w) => w.code)).toContain('target_below_healthy_bmi')
    expect(plan.totalToLoseKg).toBeCloseTo(92 - 59.9, 1)
  })

  it('vira plano de manutenção quando já está na meta', () => {
    const plan = buildDietPlan({ ...base, targetWeightKg: 92 })
    expect(plan.dailyDeficit).toBe(0)
    expect(plan.dailyCalories).toBe(plan.tdee)
  })

  it('distribui macros priorizando proteína', () => {
    const macros = buildMacros(2000, 90)
    expect(macros.proteinG).toBe(162)
    expect(macros.proteinKcal + macros.fatKcal + macros.carbKcal).toBeCloseTo(2000, -1)
    expect(macros.carbG).toBeGreaterThanOrEqual(50)
  })

  it('não zera carboidrato em déficit agressivo', () => {
    const macros = buildMacros(1200, 110)
    expect(macros.carbG).toBe(50)
    expect(macros.fatG).toBeGreaterThan(0)
  })

  it('projeta a curva até a meta sem ultrapassá-la', () => {
    const plan = buildDietPlan(base)
    const curve = projectWeightCurve(plan, 92, 80, new Date('2026-01-01'))
    expect(curve[0]!.projectedKg).toBe(92)
    expect(curve[curve.length - 1]!.projectedKg).toBe(80)
  })
})

describe('recalibração', () => {
  const plan = { weeklyLossKg: 0.7, dailyCalories: 2200 }

  const series = (values: number[]) =>
    values.map((value, i) => ({
      date: new Date(2026, 0, 1 + i).toISOString().slice(0, 10),
      value,
    }))

  it('pede mais dados quando a janela é curta', () => {
    const result = recalibrate(plan, series([92, 91.8, 91.9, 91.7]))
    expect(result.status).toBe('insufficient_data')
    expect(result.calorieAdjustment).toBe(0)
  })

  it('reconhece que está no ritmo', () => {
    // 14 dias perdendo ~0,1 kg/dia = 0,7 kg/semana
    const values = Array.from({ length: 15 }, (_, i) => 92 - i * 0.1)
    const result = recalibrate(plan, series(values))
    expect(result.status).toBe('on_track')
    expect(result.suggestedDailyCalories).toBe(2200)
  })

  it('corta calorias quando a perda está lenta', () => {
    const values = Array.from({ length: 15 }, (_, i) => 92 - i * 0.01)
    const result = recalibrate(plan, series(values))
    expect(result.status).toBe('too_slow')
    expect(result.suggestedDailyCalories).toBeLessThan(2200)
    expect(result.calorieAdjustment).toBeGreaterThanOrEqual(-250)
  })

  it('sobe calorias quando a perda está rápida demais', () => {
    const values = Array.from({ length: 15 }, (_, i) => 92 - i * 0.3)
    const result = recalibrate(plan, series(values))
    expect(result.status).toBe('too_fast')
    expect(result.suggestedDailyCalories).toBeGreaterThan(2200)
  })

  it('nunca sugere abaixo do piso calórico', () => {
    const values = Array.from({ length: 15 }, (_, i) => 60 - i * 0.001)
    const result = recalibrate({ weeklyLossKg: 0.5, dailyCalories: 1250 }, series(values), {
      sex: 'female',
    })
    expect(result.suggestedDailyCalories).toBeGreaterThanOrEqual(1200)
  })
})
