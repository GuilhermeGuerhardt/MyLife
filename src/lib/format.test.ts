import { describe, expect, it } from 'vitest'
import { currency, duration, kg, relativeDay, signed } from './format'

describe('format', () => {
  it('resolve dias relativos independentemente do horário', () => {
    const base = new Date('2026-08-19T23:40:00')
    expect(relativeDay('2026-08-19', base)).toBe('hoje')
    expect(relativeDay('2026-08-20', base)).toBe('amanhã')
    expect(relativeDay('2026-08-18', base)).toBe('ontem')
    expect(relativeDay('2026-08-24', base)).toBe('em 5 dias')
    expect(relativeDay('2026-08-14', base)).toBe('há 5 dias')
  })

  it('formata valores no padrão pt-BR', () => {
    expect(currency(1234.5)).toMatch(/1\.234,50/)
    expect(kg(84.25)).toBe('84,3 kg')
    expect(signed(-2.4)).toBe('-2,4')
    expect(signed(2.4)).toBe('+2,4')
  })

  it('formata duração em horas e minutos', () => {
    expect(duration(45)).toBe('45min')
    expect(duration(60)).toBe('1h')
    expect(duration(145)).toBe('2h25')
  })
})
