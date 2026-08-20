import { describe, expect, it } from 'vitest'
import { parseQuickAdd } from './parser'

const activities = [
  { id: 'a1', name: 'Corrida' },
  { id: 'a2', name: 'Academia (musculação)' },
  { id: 'a3', name: 'Futvôlei' },
  { id: 'a4', name: 'Natação' },
]

describe('parseQuickAdd', () => {
  it('entende peso com vírgula e com "kg"', () => {
    expect(parseQuickAdd('peso 84,2')).toEqual({ kind: 'weight', weightKg: 84.2 })
    expect(parseQuickAdd('pesei 84.2')).toEqual({ kind: 'weight', weightKg: 84.2 })
    expect(parseQuickAdd('84,2 kg')).toEqual({ kind: 'weight', weightKg: 84.2 })
  })

  it('ignora peso fora de faixa plausível', () => {
    expect(parseQuickAdd('peso 5').kind).toBe('unknown')
  })

  it('entende água em ml e em litros', () => {
    expect(parseQuickAdd('agua 500ml')).toEqual({ kind: 'water', ml: 500 })
    expect(parseQuickAdd('bebi 2l')).toEqual({ kind: 'water', ml: 2000 })
  })

  it('entende sono com hora quebrada', () => {
    expect(parseQuickAdd('dormi 7h30')).toEqual({ kind: 'sleep', hours: 7.5 })
    expect(parseQuickAdd('sono 8h')).toEqual({ kind: 'sleep', hours: 8 })
  })

  it('entende treino com duração e distância', () => {
    expect(parseQuickAdd('corri 5km em 28min', activities)).toEqual({
      kind: 'session',
      activityId: 'a1',
      activityName: 'Corrida',
      durationMin: 28,
      distanceKm: 5,
    })
  })

  it('reconhece apelidos das atividades', () => {
    expect(parseQuickAdd('academia 1h', activities)).toMatchObject({
      kind: 'session',
      activityName: 'Academia (musculação)',
      durationMin: 60,
    })
    expect(parseQuickAdd('futvolei 1h30', activities)).toMatchObject({
      activityName: 'Futvôlei',
      durationMin: 90,
    })
    expect(parseQuickAdd('nadei 45min', activities)).toMatchObject({
      activityName: 'Natação',
      durationMin: 45,
    })
  })

  it('assume 60 min quando a duração não é informada', () => {
    expect(parseQuickAdd('futvolei', activities)).toMatchObject({ durationMin: 60 })
  })

  it('entende despesa com e sem descrição', () => {
    expect(parseQuickAdd('gastei 35 no mercado')).toEqual({
      kind: 'expense',
      amount: 35,
      description: 'mercado',
    })
    expect(parseQuickAdd('paguei R$ 120,50')).toMatchObject({ kind: 'expense', amount: 120.5 })
  })

  it('entende receita', () => {
    expect(parseQuickAdd('recebi 3500 de salario')).toEqual({
      kind: 'income',
      amount: 3500,
      description: 'salario',
    })
    expect(parseQuickAdd('entrou 1.250,50 freela')).toMatchObject({
      kind: 'income',
      amount: 1250.5,
    })
  })

  it('entende refeição com quantidade', () => {
    expect(parseQuickAdd('comi 150g de arroz')).toEqual({
      kind: 'meal',
      query: 'arroz',
      quantityG: 150,
    })
  })

  it('devolve unknown para texto solto', () => {
    expect(parseQuickAdd('blablabla', activities).kind).toBe('unknown')
  })

  describe('hábitos', () => {
    const habits = [
      { id: 'h1', name: 'Leitura diária' },
      { id: 'h2', name: 'Meditação' },
      { id: 'h3', name: 'Academia' },
    ]

    it('marca o hábito pelo verbo explícito', () => {
      expect(parseQuickAdd('feito leitura', activities, habits)).toEqual({
        kind: 'habit',
        habitId: 'h1',
        habitName: 'Leitura diária',
      })
      expect(parseQuickAdd('cumpri a meditacao', activities, habits)).toMatchObject({
        kind: 'habit',
        habitId: 'h2',
      })
    })

    it('sem o verbo, o texto continua sendo treino', () => {
      // "academia" existe como hábito e como atividade: sem "feito", vale o treino.
      expect(parseQuickAdd('academia 1h', activities, habits)).toMatchObject({
        kind: 'session',
        activityId: 'a2',
      })
    })

    it('cai no treino quando nenhum hábito casa com o texto', () => {
      expect(parseQuickAdd('fiz natacao 45min', activities, habits)).toMatchObject({
        kind: 'session',
        activityId: 'a4',
      })
    })

    it('não inventa hábito quando não há nenhum cadastrado', () => {
      expect(parseQuickAdd('feito leitura', activities).kind).toBe('unknown')
    })
  })
})
