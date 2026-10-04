import { describe, expect, it } from 'vitest'
import {
  FOCO_MS,
  PAUSA_MS,
  decorrido,
  faseDoPomodoro,
  formatarCronometro,
  iniciar,
  interpretarCronometro,
  minutosParaGravar,
  pausar,
  retomar,
} from './cronometro'
import { minutosEntre, porDisciplina, resumoDoEstudo } from './tempo-de-estudo'

const MIN = 60_000
const alvo = { program_id: 'p1', subject_id: 's1', rotulo: 'Cálculo II' }

describe('cronômetro', () => {
  it('conta pelo instante de partida, não por um contador', () => {
    const estado = iniciar(alvo, 1_000, '2026-10-04')
    expect(decorrido(estado, 1_000 + 10 * MIN)).toBe(10 * MIN)
  })

  it('pausa congela e retomar continua de onde parou', () => {
    let estado = iniciar(alvo, 0, '2026-10-04')
    estado = pausar(estado, 20 * MIN)
    // Meia hora de pausa não entra.
    expect(decorrido(estado, 50 * MIN)).toBe(20 * MIN)
    estado = retomar(estado, 50 * MIN)
    expect(decorrido(estado, 60 * MIN)).toBe(30 * MIN)
  })

  it('pausar duas vezes não zera nada', () => {
    const estado = pausar(iniciar(alvo, 0, '2026-10-04'), 5 * MIN)
    expect(pausar(estado, 9 * MIN)).toBe(estado)
  })

  it('arredonda para o minuto mais próximo', () => {
    const estado = iniciar(alvo, 0, '2026-10-04')
    expect(minutosParaGravar(estado, 29_000)).toBe(0)
    expect(minutosParaGravar(estado, 31 * MIN + 40_000)).toBe(32)
  })

  it('no Pomodoro, a pausa não conta como estudo', () => {
    const estado = iniciar(alvo, 0, '2026-10-04', true)
    // Dois ciclos inteiros (60 min) e mais 10 min de foco: 25 + 25 + 10.
    expect(minutosParaGravar(estado, 70 * MIN)).toBe(60)
    // No meio da pausa do primeiro ciclo: só os 25 de foco.
    expect(minutosParaGravar(estado, 27 * MIN)).toBe(25)
  })

  it('fases do Pomodoro', () => {
    expect(faseDoPomodoro(0)).toEqual({ fase: 'foco', restante: FOCO_MS, ciclo: 1 })
    expect(faseDoPomodoro(FOCO_MS)).toEqual({ fase: 'pausa', restante: PAUSA_MS, ciclo: 1 })
    expect(faseDoPomodoro(FOCO_MS + PAUSA_MS)).toEqual({ fase: 'foco', restante: FOCO_MS, ciclo: 2 })
  })

  it('mostra horas só quando passa de uma', () => {
    expect(formatarCronometro(7 * MIN + 42_000)).toBe('07:42')
    expect(formatarCronometro(67 * MIN + 42_000)).toBe('1:07:42')
    expect(formatarCronometro(-5)).toBe('00:00')
  })

  it('o estado guardado sobrevive a lixo', () => {
    const estado = iniciar(alvo, 123, '2026-10-04', true)
    expect(interpretarCronometro(JSON.stringify(estado))).toEqual(estado)
    expect(interpretarCronometro(null)).toBeNull()
    expect(interpretarCronometro('{quebrado')).toBeNull()
    expect(interpretarCronometro(JSON.stringify({ rotulo: 'x' }))).toBeNull()
  })
})

describe('tempo de estudo', () => {
  const sessoes = [
    { program_id: 'p1', subject_id: 's1', date: '2026-09-20', minutes: 30 },
    { program_id: 'p1', subject_id: 's1', date: '2026-09-28', minutes: 50 },
    { program_id: 'p1', subject_id: 's2', date: '2026-09-30', minutes: 40 },
    { program_id: 'p1', subject_id: null, date: '2026-10-04', minutes: 25 },
  ]

  it('soma por intervalo, nas duas pontas', () => {
    expect(minutosEntre(sessoes, '2026-09-28', '2026-09-30')).toBe(90)
  })

  it('a semana vai de domingo até hoje', () => {
    // 04/10/2026 é domingo: a semana corrente só tem hoje.
    expect(resumoDoEstudo(sessoes, '2026-10-04')).toEqual({
      semana: 25,
      semanaPassada: 90,
      quatroSemanas: 145,
      total: 145,
    })
  })

  it('por disciplina, da mais estudada para a menos', () => {
    expect(porDisciplina(sessoes)).toEqual([
      { subjectId: 's1', minutos: 80 },
      { subjectId: 's2', minutos: 40 },
      { subjectId: null, minutos: 25 },
    ])
  })
})
