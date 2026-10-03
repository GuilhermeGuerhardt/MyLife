// @vitest-environment happy-dom

import { screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { Dashboard } from './dashboard'
import { HealthOverview } from './health/overview'
import { HabitsPage } from './routine/habits'
import { TarefasPage } from './routine/tarefas'
import { limparArmazenamento, montarTela, semear } from '@/testes/montar-tela'

/**
 * Uma montagem por módulo, no estado vazio.
 *
 * É o estado de quem instala o app hoje, e o que mais quebra quando uma
 * mudança de interface passa por todas as telas de uma vez — foi o caso da
 * troca de escala de texto e do painel de números, que tocaram quase todos os
 * arquivos do app num commit só.
 */

beforeEach(limparArmazenamento)
afterEach(limparArmazenamento)

describe('as telas de cada módulo sobem vazias', () => {
  it('início', async () => {
    montarTela(<Dashboard onOpenPalette={() => {}} />)

    expect(await screen.findByText(/registrar rápido/i)).toBeTruthy()
  })

  it('saúde', async () => {
    montarTela(<HealthOverview />)

    expect(await screen.findByText(/peso \(média 7 dias\)/i)).toBeTruthy()
    expect(screen.getByText('IMC')).toBeTruthy()
  })

  it('hábitos', async () => {
    montarTela(<HabitsPage />)

    expect(await screen.findByText(/nenhum hábito ainda/i)).toBeTruthy()
  })

  it('tarefas', async () => {
    montarTela(<TarefasPage />)

    expect((await screen.findAllByText(/a fazer/i)).length).toBeGreaterThan(0)
  })
})

describe('saúde com dados', () => {
  it('monta o painel de números com a pesagem registrada', async () => {
    semear('profiles', [
      {
        name: 'Teste',
        birthdate: '1996-01-01',
        sex: 'male',
        height_cm: 175,
        activity_level: 'moderate',
        avatar_url: null,
      },
    ])
    semear('body_measurements', [{ date: '2026-10-01', weight_kg: 78.4, body_fat_pct: null }])

    montarTela(<HealthOverview />)

    // O peso aparece no número do topo e no histórico de medidas.
    expect((await screen.findAllByText(/78,4/)).length).toBeGreaterThan(0)
  })
})
