// @vitest-environment happy-dom

import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { Account } from '@/data/types'
import { addMonths, toCompetence } from '@/lib/finance/billing'
import { today } from '@/lib/utils'
import { limparArmazenamento, montarTela, semear } from '@/testes/montar-tela'
import { RecorrentesDoHistorico } from './recorrentes-do-historico'

/**
 * O bloco de recorrentes achadas no histórico, montado de verdade.
 *
 * O que importa: a parcela vira regra com fim, sem o "PARC 20/48" no nome, e
 * os lançamentos de origem ficam ligados a ela, para não voltarem como
 * sugestão.
 */

const conta: Account = {
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
  created_at: '2026-01-01T00:00:00.000Z',
}

// Os três últimos meses, terminando no passado: o teste vale em qualquer data.
const MES = toCompetence(today())
const meses = [-3, -2, -1].map((delta) => addMonths(MES, delta))

const lancamento = (id: string, mes: string, parcela: number) => ({
  id,
  account_id: 'cc',
  transfer_account_id: null,
  category_id: null,
  kind: 'expense',
  amount_cents: 78945,
  date: `${mes}-10`,
  competence: mes,
  description: `PAG BOLETO HONDA PARC ${parcela}/48`,
  tags: [],
  paid: true,
  installment_group_id: null,
  installment_n: null,
  installment_total: null,
  recurring_id: null,
  invoice_competence: null,
  notes: null,
})

function tabela<T>(nome: string): T[] {
  return JSON.parse(localStorage.getItem(`life:table:${nome}`) ?? '[]') as T[]
}

beforeEach(() => {
  limparArmazenamento()
  semear('accounts', [{ ...conta }])
  semear('transactions', meses.map((mes, i) => lancamento(`t${i}`, mes, 18 + i)))
})

afterEach(() => cleanup())

describe('recorrentes do histórico', () => {
  it('cria a regra da parcela, com fim e sem o número no nome, e liga a origem', async () => {
    montarTela(<RecorrentesDoHistorico contas={[conta]} categorias={[]} />)

    expect(await screen.findByText(/parcela 20 de 48/)).toBeTruthy()
    fireEvent.click(screen.getByRole('checkbox', { name: /Criar recorrente: PAG BOLETO HONDA/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Criar 1' }))

    await waitFor(() => expect(tabela('recurring_transactions')).toHaveLength(1))
    expect(tabela('recurring_transactions')[0]).toMatchObject({
      description: 'PAG BOLETO HONDA',
      amount_cents: 78945,
      day_of_month: 10,
      start_date: `${MES}-01`,
      // 28 parcelas depois da 20ª, contadas do mês da última vista.
      end_date: `${addMonths(meses[2]!, 28)}-10`,
    })
    await waitFor(() =>
      expect(tabela<{ recurring_id: string | null }>('transactions').every((t) => t.recurring_id)).toBe(true),
    )
  })

  it('a busca acha o parcelamento e diz que já está lançado, sem oferecer regra', async () => {
    semear(
      'transactions',
      meses.map((mes, i) => ({
        ...lancamento(`p${i}`, mes, 0),
        description: 'CG 160 Fan',
        paid: false,
        installment_group_id: 'moto',
        installment_n: 5 + i,
        installment_total: 48,
      })),
    )
    montarTela(<RecorrentesDoHistorico contas={[conta]} categorias={[]} />)

    fireEvent.change(await screen.findByPlaceholderText(/moto, construtora/), {
      target: { value: 'cg' },
    })
    expect(await screen.findByText('já lançado em parcelas')).toBeTruthy()
    expect(screen.getByText(/parcela 5 de 48/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Revisar e criar' })).toBeNull()
  })

  it('a busca acha o que a detecção não pegou e abre o formulário preenchido', async () => {
    semear('transactions', [lancamento('t0', meses[0]!, 18)])
    montarTela(<RecorrentesDoHistorico contas={[conta]} categorias={[]} />)

    expect(await screen.findByText(/Nada novo se repete/)).toBeTruthy()
    fireEvent.change(screen.getByPlaceholderText(/moto, construtora/), { target: { value: 'honda' } })
    fireEvent.click(await screen.findByRole('button', { name: 'Revisar e criar' }))

    expect(await screen.findByDisplayValue('PAG BOLETO HONDA')).toBeTruthy()
    expect(screen.getByDisplayValue('789,45')).toBeTruthy()
  })
})
