// @vitest-environment happy-dom

import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AReceberPage } from './a-receber'
import { confirmar } from '@/lib/avisos'
import { today } from '@/lib/utils'
import { limparArmazenamento, montarTela, semear } from '@/testes/montar-tela'

/**
 * A tela de quem te deve, montada de verdade.
 *
 * O que dá prejuízo se quebrar: receber sem a receita entrar no extrato (o
 * saldo do app fica atrás do banco), e desfazer deixando a receita para trás
 * (o dinheiro aparece duas vezes quando a pessoa receber de novo).
 */

vi.mock('@/lib/avisos', () => ({ confirmar: vi.fn() }))

const conta = {
  id: 'cc',
  name: 'Conta Corrente',
  kind: 'checking',
  bank: 'Banco',
  initial_balance_cents: 0,
  credit_limit_cents: null,
  closing_day: null,
  due_day: null,
  color: '#3b82f6',
  archived: false,
}

const divida = (id: string, description: string, amount_cents: number, person = 'Ana') => ({
  id,
  person,
  description,
  amount_cents,
  date: '2026-09-20',
  transaction_id: null,
  received_at: null,
  received_transaction_id: null,
  deleted_at: null,
})

function tabela<T>(nome: string): T[] {
  return JSON.parse(localStorage.getItem(`life:table:${nome}`) ?? '[]') as T[]
}

beforeEach(() => {
  limparArmazenamento()
  semear('accounts', [conta])
  semear('categories', [
    { id: 'reemb', name: 'Reembolso', kind: 'income', color: '#999', icon: 'Undo2', keywords: [] },
  ])
})

afterEach(() => cleanup())

describe('a receber', () => {
  it('sem ninguém devendo, convida a anotar', async () => {
    montarTela(<AReceberPage />)
    expect(await screen.findByText('Ninguém te deve nada')).toBeTruthy()
  })

  it('agrupa por pessoa e recebe tudo numa receita só', async () => {
    semear('receivables', [
      divida('r1', 'Jantar', 6000),
      divida('r2', 'Ingresso', 4000, 'ana '),
      divida('r3', 'Uber', 1500, 'Bruno'),
    ])
    montarTela(<AReceberPage />)

    fireEvent.click(await screen.findByRole('button', { name: 'Recebi tudo' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Registrar' }))

    await waitFor(() => expect(tabela('transactions')).toHaveLength(1))
    expect(tabela('transactions')[0]).toMatchObject({
      account_id: 'cc',
      kind: 'income',
      amount_cents: 10000,
      category_id: 'reemb',
      paid: true,
      date: today(),
    })

    const itens = tabela<{ id: string; received_at: string | null }>('receivables')
    await waitFor(() =>
      expect(tabela<{ received_at: string | null }>('receivables').filter((i) => i.received_at)).toHaveLength(2),
    )
    expect(itens.find((item) => item.id === 'r3')?.received_at ?? null).toBeNull()
  })

  it('desfazer apaga a receita e reabre os itens que ela pagou', async () => {
    vi.mocked(confirmar).mockResolvedValue(true)
    semear('transactions', [
      {
        id: 'tx-reembolso',
        account_id: 'cc',
        transfer_account_id: null,
        category_id: 'reemb',
        kind: 'income',
        amount_cents: 10000,
        date: '2026-10-01',
        competence: '2026-10',
        description: 'Reembolso de Ana',
        tags: [],
        paid: true,
        installment_group_id: null,
        installment_n: null,
        installment_total: null,
        recurring_id: null,
        invoice_competence: null,
        notes: null,
      },
    ])
    semear('receivables', [
      { ...divida('r1', 'Jantar', 6000), received_at: '2026-10-01', received_transaction_id: 'tx-reembolso' },
      { ...divida('r2', 'Ingresso', 4000), received_at: '2026-10-01', received_transaction_id: 'tx-reembolso' },
    ])
    montarTela(<AReceberPage />)

    const [desfazer] = await screen.findAllByRole('button', { name: /Desfazer o recebimento/ })
    fireEvent.click(desfazer!)

    await waitFor(() => expect(tabela('transactions')).toHaveLength(0))
    await waitFor(() =>
      expect(
        tabela<{ received_at: string | null }>('receivables').every((item) => item.received_at === null),
      ).toBe(true),
    )
  })
})
