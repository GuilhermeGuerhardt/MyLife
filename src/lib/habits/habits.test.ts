import { describe, expect, it } from 'vitest'
import { addDays, eachDay, monthGrid, weekStart } from '@/lib/dates'
import {
  adherence,
  bestDailyStreak,
  bestWeeklyStreak,
  dailyStreak,
  habitStatus,
  heatmap,
  weeklyCounts,
  weeklyStreak,
} from './habits'

// 2026-03-15 é um domingo — âncora de todos os casos semanais.
const SUNDAY = '2026-03-15'

describe('datas', () => {
  it('a semana começa no domingo', () => {
    expect(weekStart(SUNDAY)).toBe(SUNDAY)
    expect(weekStart('2026-03-18')).toBe(SUNDAY)
    expect(weekStart('2026-03-21')).toBe(SUNDAY)
    expect(weekStart('2026-03-22')).toBe('2026-03-22')
  })

  it('soma dias atravessando o fim do mês', () => {
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
  })

  it('a grade do mês tem 6 semanas e cobre o mês inteiro', () => {
    const grid = monthGrid('2026-03')
    expect(grid).toHaveLength(42)
    expect(grid[0]).toBe('2026-03-01') // 1º de março de 2026 é domingo
    expect(grid).toContain('2026-03-31')
  })

  it('eachDay inclui as duas pontas', () => {
    expect(eachDay('2026-03-15', '2026-03-17')).toEqual(['2026-03-15', '2026-03-16', '2026-03-17'])
  })
})

describe('sequência diária', () => {
  it('conta os dias seguidos até hoje', () => {
    const dates = ['2026-03-13', '2026-03-14', '2026-03-15']
    expect(dailyStreak(dates, '2026-03-15')).toBe(3)
  })

  it('não quebra quando hoje ainda não foi registrado', () => {
    const dates = ['2026-03-13', '2026-03-14']
    expect(dailyStreak(dates, '2026-03-15')).toBe(2)
  })

  it('quebra quando ontem também faltou', () => {
    const dates = ['2026-03-10', '2026-03-11']
    expect(dailyStreak(dates, '2026-03-15')).toBe(0)
  })

  it('ignora registros repetidos no mesmo dia', () => {
    const dates = ['2026-03-15', '2026-03-15', '2026-03-14']
    expect(dailyStreak(dates, '2026-03-15')).toBe(2)
  })

  it('guarda o recorde mesmo depois de interrompido', () => {
    const dates = ['2026-03-01', '2026-03-02', '2026-03-03', '2026-03-04', '2026-03-10']
    expect(bestDailyStreak(dates)).toBe(4)
    expect(dailyStreak(dates, '2026-03-15')).toBe(0)
  })
})

describe('hábito semanal', () => {
  const target = 3

  it('a semana corrente incompleta não zera a sequência', () => {
    // Duas semanas cheias e a semana corrente só com um registro.
    const dates = [
      ...['2026-03-01', '2026-03-03', '2026-03-05'],
      ...['2026-03-08', '2026-03-10', '2026-03-12'],
      '2026-03-15',
    ]
    expect(weeklyStreak(dates, target, '2026-03-16')).toBe(2)
  })

  it('a semana corrente entra assim que bate a meta', () => {
    const dates = [
      ...['2026-03-08', '2026-03-10', '2026-03-12'],
      ...['2026-03-15', '2026-03-16', '2026-03-17'],
    ]
    expect(weeklyStreak(dates, target, '2026-03-17')).toBe(2)
  })

  it('a semana anterior abaixo da meta interrompe', () => {
    const dates = ['2026-03-08', '2026-03-10', '2026-03-15', '2026-03-16', '2026-03-17']
    expect(weeklyStreak(dates, target, '2026-03-17')).toBe(1)
  })

  it('conta as semanas do período com a meta batida', () => {
    const dates = ['2026-03-08', '2026-03-10', '2026-03-12', '2026-03-15']
    const weeks = weeklyCounts(dates, target, '2026-03-16', 2)
    expect(weeks.map((w) => w.start)).toEqual(['2026-03-08', '2026-03-15'])
    expect(weeks[0]).toMatchObject({ count: 3, met: true })
    expect(weeks[1]).toMatchObject({ count: 1, met: false })
  })

  it('o recorde semanal ignora períodos sem registro nenhum', () => {
    const dates = [
      ...['2026-01-04', '2026-01-06', '2026-01-08'],
      ...['2026-01-11', '2026-01-13', '2026-01-15'],
      // Fevereiro inteiro sem nada — não é sequência quebrada, é ausência de dado.
      ...['2026-03-08', '2026-03-10', '2026-03-12'],
    ]
    expect(bestWeeklyStreak(dates, target)).toBe(2)
  })
})

describe('status do hábito', () => {
  const weekly = { id: 'h1', cadence: 'weekly' as const, target_per_week: 4 }

  it('avisa quando a meta só é possível sem falhar mais nenhum dia', () => {
    // Quinta-feira: restam quinta, sexta e sábado; faltam 3 registros.
    const status = habitStatus(weekly, ['2026-03-15'], '2026-03-19')
    expect(status.missing).toBe(3)
    expect(status.daysLeft).toBe(3)
    expect(status.atRisk).toBe(true)
    expect(status.lost).toBe(false)
  })

  it('marca a meta como perdida quando não cabe mais nos dias restantes', () => {
    // Sexta-feira: restam sexta e sábado; faltariam 4.
    const status = habitStatus(weekly, [], '2026-03-20')
    expect(status.daysLeft).toBe(2)
    expect(status.lost).toBe(true)
  })

  it('hábito diário tem meta 7 e sequência em dias', () => {
    const daily = { id: 'h2', cadence: 'daily' as const, target_per_week: 1 }
    const status = habitStatus(daily, ['2026-03-15', '2026-03-16'], '2026-03-16')
    expect(status.weekTarget).toBe(7)
    expect(status.streakUnit).toBe('dia')
    expect(status.streak).toBe(2)
    expect(status.doneToday).toBe(true)
  })
})

describe('heatmap', () => {
  it('devolve colunas completas de domingo a sábado', () => {
    const weeks = heatmap(['2026-03-16', '2026-03-17'], '2026-03-18', 30)
    expect(weeks.every((week) => week.length === 7)).toBe(true)
    expect(weeks[0]?.[0]).toMatchObject({ date: weekStart(weeks[0]![0]!.date) })
  })

  it('marca os dias futuros como vazios em vez de zerados', () => {
    const weeks = heatmap(['2026-03-16'], '2026-03-18', 14)
    const last = weeks[weeks.length - 1]!
    // Quinta em diante ainda não aconteceu.
    expect(last[5]?.count).toBe(-1)
    expect(last[6]?.count).toBe(-1)
  })

  it('gradua a intensidade pela contagem do dia', () => {
    const dates = ['2026-03-16', '2026-03-17', '2026-03-17', '2026-03-17', '2026-03-17']
    const weeks = heatmap(dates, '2026-03-18', 14)
    const days = weeks.flat()
    expect(days.find((d) => d.date === '2026-03-16')?.level).toBe(1)
    expect(days.find((d) => d.date === '2026-03-17')?.level).toBe(4)
    expect(days.find((d) => d.date === '2026-03-18')?.level).toBe(0)
  })
})

describe('adesão', () => {
  it('é o percentual de dias com registro no intervalo', () => {
    const dates = ['2026-03-15', '2026-03-17', '2026-03-19', '2026-03-21']
    expect(adherence(dates, '2026-03-15', '2026-03-21')).toBeCloseTo(57.1, 1)
  })

  it('não divide por zero em intervalo invertido', () => {
    expect(adherence([], '2026-03-21', '2026-03-15')).toBe(0)
  })
})
