import { describe, expect, it } from 'vitest'
import { patrimonioNoDia, patrimonioPorMes } from './patrimonio'
import type { AccountLike, TransactionLike } from './reports'

const corrente: AccountLike = { id: 'cc', kind: 'checking', initial_balance_cents: 100000, credit_limit_cents: null }
const investimento: AccountLike = { id: 'inv', kind: 'investment', initial_balance_cents: 500000, credit_limit_cents: null }
const cartao: AccountLike = {
  id: 'cartao',
  kind: 'credit',
  initial_balance_cents: 0,
  credit_limit_cents: 300000,
  closing_day: 20,
  due_day: 28,
}

const tx = (over: Partial<TransactionLike> & { id: string }): TransactionLike => ({
  account_id: 'cc',
  transfer_account_id: null,
  category_id: null,
  kind: 'expense',
  amount_cents: 1000,
  date: '2026-09-10',
  competence: '2026-09',
  paid: true,
  ...over,
})

describe('patrimônio', () => {
  it('a compra no cartão vira dívida no dia da compra, mesmo em aberto', () => {
    const lancamentos = [tx({ id: 'c', account_id: 'cartao', amount_cents: 30000, paid: false })]
    expect(patrimonioNoDia([corrente, investimento, cartao], lancamentos, '2026-09-30')).toEqual({
      contasCents: 100000,
      investimentosCents: 500000,
      dividaCents: 30000,
      totalCents: 570000,
    })
  })

  it('pagar a fatura não muda o patrimônio: sai da conta e sai da dívida', () => {
    const compra = tx({ id: 'c', account_id: 'cartao', amount_cents: 30000, paid: true })
    const pagamento = tx({
      id: 'p',
      kind: 'transfer',
      transfer_account_id: 'cartao',
      amount_cents: 30000,
      date: '2026-10-05',
      competence: '2026-10',
    })
    const contas = [corrente, cartao]
    const antes = patrimonioNoDia(contas, [compra, pagamento], '2026-09-30')
    const depois = patrimonioNoDia(contas, [compra, pagamento], '2026-10-31')
    expect(antes.totalCents).toBe(70000)
    expect(depois).toMatchObject({ contasCents: 70000, dividaCents: 0, totalCents: 70000 })
  })

  it('na conta comum, o previsto ainda não conta', () => {
    const luz = tx({ id: 'l', amount_cents: 12000, paid: false })
    expect(patrimonioNoDia([corrente], [luz], '2026-09-30').totalCents).toBe(100000)
  })

  it('um ponto por mês, a partir do primeiro lançamento, até hoje', () => {
    const lancamentos = [
      tx({ id: 'a', kind: 'income', amount_cents: 50000, date: '2026-08-05', competence: '2026-08' }),
      tx({ id: 'b', amount_cents: 20000, date: '2026-09-15' }),
      tx({ id: 'c', amount_cents: 5000, date: '2026-10-02', competence: '2026-10' }),
      tx({ id: 'd', amount_cents: 7000, date: '2026-10-20', competence: '2026-10' }),
    ]
    const pontos = patrimonioPorMes([corrente], lancamentos, '2026-10-04')
    expect(pontos.map((p) => [p.competence, p.data, p.totalCents])).toEqual([
      ['2026-08', '2026-08-31', 150000],
      ['2026-09', '2026-09-30', 130000],
      // Mês corrente: medido hoje, sem o lançamento do dia 20.
      ['2026-10', '2026-10-04', 125000],
    ])
  })

  it('a janela não passa de doze meses', () => {
    const antigo = tx({ id: 'a', date: '2024-01-10', competence: '2024-01' })
    const pontos = patrimonioPorMes([corrente], [antigo], '2026-10-04')
    expect(pontos).toHaveLength(12)
    expect(pontos[0]!.competence).toBe('2025-11')
  })
})
