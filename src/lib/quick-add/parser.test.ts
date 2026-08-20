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
})
