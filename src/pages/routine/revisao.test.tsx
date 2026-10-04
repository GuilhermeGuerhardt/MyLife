// @vitest-environment happy-dom

import { cleanup, fireEvent, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { RevisaoPage } from './revisao'
import { addMonths, toCompetence } from '@/lib/finance/billing'
import { today } from '@/lib/utils'
import { limparArmazenamento, montarTela, semear } from '@/testes/montar-tela'

/** A revisão do mês montada de verdade: vazia, e com dados de mais de um módulo. */

const MES_PASSADO = addMonths(toCompetence(today()), -1)

beforeEach(limparArmazenamento)
afterEach(() => {
  cleanup()
  limparArmazenamento()
})

describe('revisão do mês', () => {
  it('sem nada registrado, explica em vez de mostrar zeros', async () => {
    montarTela(<RevisaoPage />)
    expect(await screen.findByText('Nada registrado neste mês')).toBeTruthy()
  })

  it('mostra só as áreas com registro, e volta para o mês anterior', async () => {
    semear('workout_sessions', [
      {
        activity_type_id: 'a',
        date: `${MES_PASSADO}-10`,
        duration_min: 45,
        rpe: null,
        calories_estimated: 300,
        distance_km: null,
        notes: null,
      },
    ])
    semear('study_sessions', [
      { program_id: 'p', subject_id: null, date: `${MES_PASSADO}-12`, minutes: 90, notes: null, deleted_at: null },
      // Apagado: não conta.
      { program_id: 'p', subject_id: null, date: `${MES_PASSADO}-13`, minutes: 500, notes: null, deleted_at: '2026-01-01T00:00:00.000Z' },
    ])

    montarTela(<RevisaoPage />)
    fireEvent.click(await screen.findByRole('button', { name: 'Mês anterior' }))

    expect(await screen.findByText('Saúde')).toBeTruthy()
    expect(screen.getByText('Estudos')).toBeTruthy()
    expect(screen.queryByText('Financeiro')).toBeNull()
    expect(screen.getByText('1h30')).toBeTruthy()
    expect(screen.getByText('45min')).toBeTruthy()
  })
})
