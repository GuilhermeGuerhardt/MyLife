// @vitest-environment happy-dom

import { fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { FinanceOverview } from './overview'
import { limparArmazenamento, montarTela, semear } from '@/testes/montar-tela'

/**
 * Testes de montagem da visão geral.
 *
 * Não conferem conta — para isso existem os testes de `reports` e `open-month`.
 * Conferem que a tela sobe: foi aqui que uma prop esquecida derrubou a rota
 * inteira com "Cannot read properties of undefined", sem que tipo ou teste de
 * cálculo dissessem nada.
 */

const conta = {
  name: 'Conta Corrente',
  kind: 'checking',
  bank: 'Banco',
  initial_balance_cents: 500000,
  credit_limit_cents: null,
  closing_day: null,
  due_day: null,
  color: '#3b82f6',
  archived: false,
}

const cartao = {
  name: 'Cartao',
  kind: 'credit',
  bank: 'Banco',
  initial_balance_cents: 0,
  credit_limit_cents: 500000,
  closing_day: 20,
  due_day: 15,
  color: '#a855f7',
  archived: false,
}

const lancamento = (over: Record<string, unknown>) => ({
  transfer_account_id: null,
  category_id: null,
  kind: 'expense',
  tags: [],
  paid: false,
  installment_group_id: null,
  installment_n: null,
  installment_total: null,
  recurring_id: null,
  notes: null,
  ...over,
})

beforeEach(limparArmazenamento)
afterEach(limparArmazenamento)

describe('visão geral do financeiro', () => {
  it('sem conta cadastrada, chama para cadastrar a primeira', async () => {
    montarTela(<FinanceOverview />)

    expect(await screen.findByText(/cadastre sua primeira conta/i)).toBeTruthy()
  })

  it('com contas e lançamentos, monta a tela inteira', async () => {
    semear('accounts', [conta, cartao])
    semear('transactions', [
      lancamento({
        account_id: 'accounts-0',
        description: 'Salario',
        kind: 'income',
        amount_cents: 450000,
        date: '2026-10-01',
        competence: '2026-10',
        paid: true,
      }),
      lancamento({
        account_id: 'accounts-1',
        description: 'Compra no cartao',
        amount_cents: 32000,
        date: '2026-09-24',
        competence: '2026-10',
      }),
    ])

    montarTela(<FinanceOverview />)

    expect(await screen.findByText('Saldo em contas')).toBeTruthy()
    expect(screen.getByText('Receitas do mês')).toBeTruthy()
    expect(screen.getByText('Últimos lançamentos')).toBeTruthy()
  })

  /**
   * A compra no cartão não é conta a pagar: ela espera a fatura. O selo é o
   * sinal visível dessa regra, e foi o que estava errado antes.
   */
  it('a compra no cartão aparece como "na fatura", nunca como vencida', async () => {
    semear('accounts', [conta, cartao])
    semear('transactions', [
      lancamento({
        account_id: 'accounts-1',
        description: 'Compra no cartao',
        amount_cents: 32000,
        date: '2026-09-24',
        competence: '2026-10',
      }),
    ])

    montarTela(<FinanceOverview />)

    expect(await screen.findByText('na fatura')).toBeTruthy()
    expect(screen.queryByText('vencido')).toBeNull()
  })

  it('o painel do mês monta com a fatura que vence nele', async () => {
    semear('accounts', [conta, cartao])
    semear('transactions', [
      lancamento({
        account_id: 'accounts-1',
        description: 'Compra no cartao',
        amount_cents: 32000,
        date: '2026-08-24',
        // Fatura de setembro, que vence em 15 de outubro.
        competence: '2026-09',
      }),
    ])

    montarTela(<FinanceOverview />)

    await waitFor(() => expect(screen.getByText('Saldo em contas')).toBeTruthy())
    fireEvent.click(screen.getAllByRole('tab', { name: /ainda esse mês/i })[0]!)

    expect(await screen.findByText(/fatura que vence neste mês/i)).toBeTruthy()
  })
})
