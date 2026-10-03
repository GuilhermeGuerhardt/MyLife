// @vitest-environment happy-dom

import { beforeEach, describe, expect, it } from 'vitest'
import { migrarCartaoParaOMesDaCompra } from './migracao-cartao'

/**
 * A migração mexe no que já está gravado, então ela é testada contra o
 * armazenamento de verdade: semeia, roda, lê de volta.
 */

const agora = '2026-10-01T12:00:00.000Z'

const conta = (id: string, kind: string) => ({
  id,
  created_at: agora,
  updated_at: agora,
  name: id,
  kind,
  bank: null,
  initial_balance_cents: 0,
  credit_limit_cents: kind === 'credit' ? 500000 : null,
  closing_day: kind === 'credit' ? 20 : null,
  due_day: kind === 'credit' ? 15 : null,
  color: '#000',
  archived: false,
})

const lancamento = (over: Record<string, unknown>) => ({
  created_at: agora,
  updated_at: agora,
  transfer_account_id: null,
  category_id: null,
  kind: 'expense',
  amount_cents: 5000,
  description: 'Compra',
  tags: [],
  paid: false,
  installment_group_id: null,
  installment_n: null,
  installment_total: null,
  recurring_id: null,
  invoice_competence: null,
  notes: null,
  ...over,
})

function semear(tabela: string, linhas: unknown[]) {
  localStorage.setItem(`life:table:${tabela}`, JSON.stringify(linhas))
}

function ler(tabela: string): Array<Record<string, string>> {
  return JSON.parse(localStorage.getItem(`life:table:${tabela}`) ?? '[]')
}

beforeEach(() => localStorage.clear())

describe('migração do cartão para o mês da compra', () => {
  it('a compra depois do fechamento volta para o mês em que aconteceu', async () => {
    semear('accounts', [conta('card', 'credit')])
    semear('transactions', [
      // Era o caso da tela: comprada em 24/09, gravada em outubro.
      lancamento({ id: 't1', account_id: 'card', date: '2026-09-24', competence: '2026-10' }),
    ])

    expect(await migrarCartaoParaOMesDaCompra()).toBe(1)
    expect(ler('transactions')[0]).toMatchObject({ date: '2026-09-24', competence: '2026-09' })
  })

  it('não toca em conta que não é cartão', async () => {
    semear('accounts', [conta('corrente', 'checking')])
    semear('transactions', [
      lancamento({ id: 't1', account_id: 'corrente', date: '2026-09-24', competence: '2026-09' }),
    ])

    expect(await migrarCartaoParaOMesDaCompra()).toBe(0)
  })

  it('espalha as parcelas: cada uma na data do seu mês', async () => {
    semear('accounts', [conta('card', 'credit')])
    semear('transactions', [
      lancamento({
        id: 'p1',
        account_id: 'card',
        date: '2026-09-24',
        competence: '2026-10',
        installment_group_id: 'g1',
        installment_n: 1,
        installment_total: 3,
      }),
      lancamento({
        id: 'p2',
        account_id: 'card',
        date: '2026-09-24',
        competence: '2026-11',
        installment_group_id: 'g1',
        installment_n: 2,
        installment_total: 3,
      }),
      lancamento({
        id: 'p3',
        account_id: 'card',
        date: '2026-09-24',
        competence: '2026-12',
        installment_group_id: 'g1',
        installment_n: 3,
        installment_total: 3,
      }),
    ])

    await migrarCartaoParaOMesDaCompra()

    expect(ler('transactions').map((item) => [item.date, item.competence])).toEqual([
      ['2026-09-24', '2026-09'],
      ['2026-10-24', '2026-10'],
      ['2026-11-24', '2026-11'],
    ])
  })

  it('encolhe o dia quando o mês da parcela é curto', async () => {
    semear('accounts', [conta('card', 'credit')])
    semear('transactions', [
      lancamento({
        id: 'p1',
        account_id: 'card',
        date: '2025-12-31',
        competence: '2026-01',
        installment_group_id: 'g1',
        installment_n: 1,
        installment_total: 3,
      }),
      lancamento({
        id: 'p3',
        account_id: 'card',
        date: '2025-12-31',
        competence: '2026-03',
        installment_group_id: 'g1',
        installment_n: 3,
        installment_total: 3,
      }),
    ])

    await migrarCartaoParaOMesDaCompra()
    expect(ler('transactions').map((item) => item.date)).toEqual(['2025-12-31', '2026-02-28'])
  })

  /** Rodar de novo não pode empurrar as parcelas mais um mês para a frente. */
  it('rodar duas vezes dá o mesmo resultado', async () => {
    semear('accounts', [conta('card', 'credit')])
    semear('transactions', [
      lancamento({
        id: 'p1',
        account_id: 'card',
        date: '2026-09-24',
        competence: '2026-10',
        installment_group_id: 'g1',
        installment_n: 1,
        installment_total: 2,
      }),
      lancamento({
        id: 'p2',
        account_id: 'card',
        date: '2026-09-24',
        competence: '2026-11',
        installment_group_id: 'g1',
        installment_n: 2,
        installment_total: 2,
      }),
    ])

    await migrarCartaoParaOMesDaCompra()
    const depoisDaPrimeira = ler('transactions').map((item) => item.date)

    expect(await migrarCartaoParaOMesDaCompra()).toBe(0)
    expect(ler('transactions').map((item) => item.date)).toEqual(depoisDaPrimeira)
  })

  it('sem cartão nenhum, não faz nada', async () => {
    semear('accounts', [])
    semear('transactions', [lancamento({ id: 't1', account_id: 'x', date: '2026-09-24' })])

    expect(await migrarCartaoParaOMesDaCompra()).toBe(0)
  })
})
