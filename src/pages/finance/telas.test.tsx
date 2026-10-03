// @vitest-environment happy-dom

import { screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { AccountsPage } from './accounts'
import { BudgetPage } from './budget'
import { TransactionsPage } from './transactions'
import { limparArmazenamento, montarTela, semear } from '@/testes/montar-tela'

/**
 * As outras telas do financeiro, só de montagem.
 *
 * Cada uma é testada duas vezes: com dados e sem nada. O vazio é o estado que
 * mais quebra na prática — é onde um `.map` encontra `undefined` e onde o
 * primeiro uso do app acontece.
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

const compra = {
  account_id: 'accounts-1',
  transfer_account_id: null,
  category_id: null,
  kind: 'expense',
  amount_cents: 32000,
  date: '2026-09-24',
  competence: '2026-10',
  description: 'Compra no cartao',
  tags: [],
  paid: false,
  installment_group_id: null,
  installment_n: null,
  installment_total: null,
  recurring_id: null,
  notes: null,
}

beforeEach(limparArmazenamento)
afterEach(limparArmazenamento)

describe('contas e cartões', () => {
  it('monta com conta, cartão e a conferência de extrato', async () => {
    semear('accounts', [conta, cartao])
    semear('transactions', [compra])

    montarTela(<AccountsPage />)

    expect(await screen.findByText('Saldo total')).toBeTruthy()
    expect(screen.getByText('Conta Corrente')).toBeTruthy()
    expect(screen.getByText(/extrato nunca conferido/i)).toBeTruthy()
    expect(screen.getByText(/total da fatura/i)).toBeTruthy()
  })

  it('sem conta nenhuma, mostra o estado vazio', async () => {
    montarTela(<AccountsPage />)

    expect(await screen.findByText(/nenhuma conta cadastrada/i)).toBeTruthy()
  })

  it('mostra a conferência já registrada', async () => {
    semear('accounts', [conta])
    semear('account_checks', [
      { account_id: 'accounts-0', date: '2026-09-30', balance_cents: 500000, difference_cents: 0 },
    ])

    montarTela(<AccountsPage />)

    expect(await screen.findByText(/conferido até 30\/09/i)).toBeTruthy()
  })
})

describe('orçamento e metas', () => {
  it('monta vazio, com os dois convites', async () => {
    montarTela(<BudgetPage />)

    expect(await screen.findByText(/nenhum envelope neste mês/i)).toBeTruthy()
    expect(screen.getByText(/nenhuma meta/i)).toBeTruthy()
  })

  it('monta com meta e envelope', async () => {
    semear('accounts', [conta])
    semear('categories', [
      { name: 'Mercado', kind: 'expense', icon: 'cart', color: '#22c55e', archived: false },
    ])
    semear('budgets', [
      { category_id: 'categories-0', competence: '2026-10', limit_cents: 80000 },
    ])
    semear('financial_goals', [
      {
        name: 'Reserva',
        target_cents: 1000000,
        current_cents: 250000,
        target_date: null,
        account_id: 'accounts-0',
        color: '#22c55e',
        done: false,
      },
    ])

    montarTela(<BudgetPage />)

    expect(await screen.findByText('Reserva')).toBeTruthy()
    expect(screen.getByText('Mercado')).toBeTruthy()
  })
})

describe('lançamentos', () => {
  it('lista o que existe no mês', async () => {
    semear('accounts', [conta, cartao])
    semear('transactions', [compra])

    montarTela(<TransactionsPage />)

    expect(await screen.findByText('Compra no cartao')).toBeTruthy()
  })

  it('sem lançamento, explica o vazio em vez de mostrar lista seca', async () => {
    semear('accounts', [conta])

    montarTela(<TransactionsPage />)

    expect(await screen.findByText(/nenhum lançamento/i)).toBeTruthy()
  })
})
