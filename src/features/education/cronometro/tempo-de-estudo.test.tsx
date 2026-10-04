// @vitest-environment happy-dom

import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { TempoDeEstudo } from './tempo-de-estudo'
import { today } from '@/lib/utils'
import { limparArmazenamento, montarTela, semear } from '@/testes/montar-tela'

/**
 * O bloco de tempo de estudo, montado de verdade.
 *
 * O que importa aqui é o carimbo: a tabela de estudo é a primeira que apaga
 * gravando `deleted_at`. O apagado tem de sumir da tela e continuar no banco,
 * que é o que um dia vai contar ao outro aparelho que ele saiu.
 */

const disciplinas = [
  { id: 'calc', name: 'Cálculo' },
  { id: 'fis', name: 'Física' },
]

beforeEach(() => {
  limparArmazenamento()
  semear('study_sessions', [
    { id: 's1', program_id: 'p1', subject_id: 'calc', date: today(), minutes: 50, notes: null, deleted_at: null },
    { id: 's2', program_id: 'p1', subject_id: 'fis', date: today(), minutes: 30, notes: null, deleted_at: null },
    { id: 's3', program_id: 'p1', subject_id: 'calc', date: today(), minutes: 45, notes: null, deleted_at: '2026-01-01T00:00:00.000Z' },
    { id: 's4', program_id: 'outro', subject_id: null, date: today(), minutes: 99, notes: null, deleted_at: null },
  ])
})

afterEach(() => cleanup())

function linhasNoBanco(): Array<{ id: string; deleted_at: string | null }> {
  return JSON.parse(localStorage.getItem('life:table:study_sessions') ?? '[]')
}

describe('tempo de estudo', () => {
  it('soma só o que vale, só deste curso', async () => {
    montarTela(<TempoDeEstudo programId="p1" disciplinas={disciplinas} />)
    // 50 + 30. O apagado (45) e o do outro curso (99) ficam de fora.
    expect(await screen.findAllByText('1h20')).not.toHaveLength(0)
    expect(screen.queryByText('2h05')).toBeNull()
    expect(screen.queryByText('1h39')).toBeNull()
  })

  it('apagar grava o carimbo em vez de tirar a linha', async () => {
    montarTela(<TempoDeEstudo programId="p1" disciplinas={disciplinas} />)
    const [primeiro] = await screen.findAllByRole('button', { name: /Apagar o estudo de/ })
    fireEvent.click(primeiro!)

    await waitFor(() => {
      const apagados = linhasNoBanco().filter((linha) => linha.deleted_at !== null)
      expect(apagados).toHaveLength(2)
    })
    // Continua tudo no banco: quatro linhas, duas com carimbo.
    expect(linhasNoBanco()).toHaveLength(4)
    await waitFor(() =>
      expect(screen.getAllByRole('button', { name: /Apagar o estudo de/ })).toHaveLength(1),
    )
  })

  it('lançar à mão grava na disciplina escolhida', async () => {
    montarTela(<TempoDeEstudo programId="p1" disciplinas={disciplinas} />)
    fireEvent.click(await screen.findByRole('button', { name: /Lançar à mão/ }))
    fireEvent.change(screen.getByPlaceholderText('90'), { target: { value: '40' } })
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'fis' } })
    fireEvent.click(screen.getByRole('button', { name: 'Lançar' }))

    await waitFor(() => expect(linhasNoBanco()).toHaveLength(5))
    expect(linhasNoBanco().at(-1)).toMatchObject({
      program_id: 'p1',
      subject_id: 'fis',
      minutes: 40,
      date: today(),
      deleted_at: null,
    })
  })
})
